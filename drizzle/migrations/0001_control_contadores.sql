CREATE TYPE public.turno AS ENUM ('manana','tarde');

CREATE TABLE public.maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE CHECK (length(trim(nombre)) > 0),
  tipo text NOT NULL DEFAULT 'Fotocopiadora',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.maquinas TO authenticated;
GRANT ALL ON public.maquinas TO service_role;
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY maq_select ON public.maquinas FOR SELECT TO authenticated USING (true);
CREATE POLICY maq_admin_ins ON public.maquinas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY maq_admin_upd ON public.maquinas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.maquinas (nombre) VALUES ('Máquina 1'),('Máquina 2'),('Máquina 3'),('Máquina 4'),('Máquina 5')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.configuracion (clave, valor) VALUES ('turno_corte', '14:00') ON CONFLICT (clave) DO NOTHING;

CREATE TABLE public.contadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid NOT NULL REFERENCES public.maquinas(id),
  fecha date NOT NULL,
  turno public.turno NOT NULL,
  contador_inicial bigint NOT NULL CHECK (contador_inicial >= 0),
  contador_final bigint CHECK (contador_final >= 0),
  usuario_id uuid,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maquina_id, fecha, turno),
  CHECK (contador_final IS NULL OR contador_final >= contador_inicial)
);
CREATE TABLE public.contadores_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contador_id uuid NOT NULL REFERENCES public.contadores(id),
  usuario_id uuid,
  inicial_anterior bigint, final_anterior bigint,
  inicial_nuevo bigint, final_nuevo bigint,
  observaciones text,
  fecha timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contadores, public.contadores_historial TO authenticated;
GRANT ALL ON public.contadores, public.contadores_historial TO service_role;
ALTER TABLE public.contadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contadores_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY cont_select ON public.contadores FOR SELECT TO authenticated USING (true);
CREATE POLICY conth_select ON public.contadores_historial FOR SELECT TO authenticated USING (true);

-- Máquina usada en ventas de servicios
ALTER TABLE public.detalle_ventas ADD COLUMN IF NOT EXISTS maquina_id uuid REFERENCES public.maquinas(id);

-- Trabajos de encargos efectivamente realizados
CREATE TABLE public.encargo_trabajos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_item_id uuid NOT NULL REFERENCES public.encargo_items(id),
  encargo_id uuid NOT NULL REFERENCES public.encargos(id),
  servicio_id uuid NOT NULL REFERENCES public.servicios(id),
  maquina_id uuid REFERENCES public.maquinas(id),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  usuario_id uuid,
  fecha timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.encargo_trabajos (fecha);
CREATE INDEX ON public.encargo_trabajos (encargo_id);
GRANT SELECT ON public.encargo_trabajos TO authenticated;
GRANT ALL ON public.encargo_trabajos TO service_role;
ALTER TABLE public.encargo_trabajos ENABLE ROW LEVEL SECURITY;
CREATE POLICY enct_select ON public.encargo_trabajos FOR SELECT TO authenticated USING (true);

-- Rango horario de un turno (hora de Argentina)
CREATE OR REPLACE FUNCTION public.rango_turno(p_fecha date, p_turno public.turno, OUT desde timestamptz, OUT hasta timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_corte time;
BEGIN
  SELECT COALESCE((SELECT valor::time FROM public.configuracion WHERE clave = 'turno_corte'), '14:00'::time) INTO v_corte;
  IF p_turno = 'manana' THEN
    desde := (p_fecha::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires';
    hasta := (p_fecha + v_corte) AT TIME ZONE 'America/Argentina/Buenos_Aires';
  ELSE
    desde := (p_fecha + v_corte) AT TIME ZONE 'America/Argentina/Buenos_Aires';
    hasta := ((p_fecha + 1)::timestamp) AT TIME ZONE 'America/Argentina/Buenos_Aires';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.guardar_contador(
  p_maquina_id uuid, p_fecha date, p_turno public.turno, p_inicial bigint, p_final bigint, p_observaciones text
) RETURNS public.contadores LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.contadores; v_new public.contadores;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_inicial IS NULL OR p_inicial < 0 THEN RAISE EXCEPTION 'El contador inicial debe ser un entero no negativo'; END IF;
  IF p_final IS NOT NULL AND p_final < p_inicial THEN RAISE EXCEPTION 'El contador final no puede ser menor que el inicial'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.maquinas WHERE id = p_maquina_id) THEN RAISE EXCEPTION 'Máquina inexistente'; END IF;
  SELECT * INTO v_old FROM public.contadores WHERE maquina_id = p_maquina_id AND fecha = p_fecha AND turno = p_turno FOR UPDATE;
  IF FOUND THEN
    UPDATE public.contadores SET contador_inicial = p_inicial, contador_final = p_final, observaciones = p_observaciones,
      usuario_id = auth.uid(), updated_at = now() WHERE id = v_old.id RETURNING * INTO v_new;
    IF v_old.contador_inicial IS DISTINCT FROM p_inicial OR v_old.contador_final IS DISTINCT FROM p_final THEN
      INSERT INTO public.contadores_historial (contador_id, usuario_id, inicial_anterior, final_anterior, inicial_nuevo, final_nuevo, observaciones)
      VALUES (v_old.id, auth.uid(), v_old.contador_inicial, v_old.contador_final, p_inicial, p_final, p_observaciones);
    END IF;
  ELSE
    INSERT INTO public.contadores (maquina_id, fecha, turno, contador_inicial, contador_final, usuario_id, observaciones)
    VALUES (p_maquina_id, p_fecha, p_turno, p_inicial, p_final, auth.uid(), p_observaciones) RETURNING * INTO v_new;
    INSERT INTO public.contadores_historial (contador_id, usuario_id, inicial_nuevo, final_nuevo, observaciones)
    VALUES (v_new.id, auth.uid(), p_inicial, p_final, 'Alta');
  END IF;
  RETURN v_new;
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_trabajo_encargo(p_item_id uuid, p_cantidad numeric, p_maquina_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_it public.encargo_items; v_enc public.encargos; v_hecho numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_cantidad <> trunc(p_cantidad) THEN RAISE EXCEPTION 'La cantidad debe ser un entero mayor a cero'; END IF;
  SELECT * INTO v_it FROM public.encargo_items WHERE id = p_item_id;
  IF NOT FOUND OR v_it.servicio_id IS NULL THEN RAISE EXCEPTION 'Solo se registran trabajos de fotocopias o impresiones'; END IF;
  SELECT * INTO v_enc FROM public.encargos WHERE id = v_it.encargo_id FOR UPDATE;
  IF v_enc.estado = 'cancelado' THEN RAISE EXCEPTION 'El encargo está cancelado'; END IF;
  SELECT COALESCE(sum(cantidad),0) INTO v_hecho FROM public.encargo_trabajos WHERE encargo_item_id = p_item_id;
  IF v_hecho + p_cantidad > v_it.cantidad THEN
    RAISE EXCEPTION 'Supera lo pedido: ya se realizaron % de %', v_hecho, v_it.cantidad;
  END IF;
  INSERT INTO public.encargo_trabajos (encargo_item_id, encargo_id, servicio_id, maquina_id, cantidad, usuario_id)
  VALUES (p_item_id, v_it.encargo_id, v_it.servicio_id, p_maquina_id, p_cantidad, auth.uid());
  INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle)
  VALUES (v_it.encargo_id, auth.uid(), 'trabajo', 'Realizadas ' || p_cantidad || ' de ' || v_it.descripcion ||
    COALESCE(' en ' || (SELECT nombre FROM public.maquinas WHERE id = p_maquina_id), ' (sin máquina asignada)'));
END; $$;

-- Comparación por máquina y turno. Ventas que provienen de un encargo se excluyen
-- (sus trabajos se cuentan por encargo_trabajos) para no contar dos veces.
CREATE OR REPLACE FUNCTION public.comparar_contadores(p_fecha date, p_turno public.turno)
RETURNS TABLE (maquina_id uuid, maquina text, activo boolean, contador_inicial bigint, contador_final bigint,
               segun_contador bigint, ventas numeric, encargos numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT * FROM public.rango_turno(p_fecha, p_turno)),
  v AS (
    SELECT dv.maquina_id, sum(dv.cantidad) c FROM public.detalle_ventas dv
    JOIN public.ventas ve ON ve.id = dv.venta_id, r
    WHERE dv.servicio_id IS NOT NULL AND ve.estado = 'confirmada'
      AND ve.fecha >= r.desde AND ve.fecha < r.hasta
      AND NOT EXISTS (SELECT 1 FROM public.encargos e WHERE e.venta_id = ve.id)
    GROUP BY dv.maquina_id),
  t AS (
    SELECT et.maquina_id, sum(et.cantidad) c FROM public.encargo_trabajos et, r
    WHERE et.fecha >= r.desde AND et.fecha < r.hasta GROUP BY et.maquina_id)
  SELECT m.id, m.nombre, m.activo, c.contador_inicial, c.contador_final,
         CASE WHEN c.contador_final IS NOT NULL THEN c.contador_final - c.contador_inicial END,
         COALESCE(v.c,0), COALESCE(t.c,0)
  FROM public.maquinas m
  LEFT JOIN public.contadores c ON c.maquina_id = m.id AND c.fecha = p_fecha AND c.turno = p_turno
  LEFT JOIN v ON v.maquina_id = m.id LEFT JOIN t ON t.maquina_id = m.id
  WHERE m.activo OR c.id IS NOT NULL OR v.c IS NOT NULL OR t.c IS NOT NULL
  UNION ALL
  SELECT NULL, 'Sin máquina asignada', true, NULL, NULL, NULL,
         COALESCE((SELECT c FROM v WHERE v.maquina_id IS NULL),0), COALESCE((SELECT c FROM t WHERE t.maquina_id IS NULL),0)
$$;

REVOKE EXECUTE ON FUNCTION public.rango_turno(date, public.turno) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guardar_contador(uuid, date, public.turno, bigint, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_trabajo_encargo(uuid, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.comparar_contadores(date, public.turno) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rango_turno(date, public.turno) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_contador(uuid, date, public.turno, bigint, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_trabajo_encargo(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comparar_contadores(date, public.turno) TO authenticated;

-- crear_venta: guardar la máquina usada en servicios (cambio mínimo)
CREATE OR REPLACE FUNCTION public.crear_venta(p_items jsonb, p_metodo metodo_pago, p_descuento numeric DEFAULT 0, p_observaciones text DEFAULT NULL::text)
 RETURNS ventas LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_venta public.ventas; v_item jsonb; v_subtotal numeric := 0; v_numero text; v_prod public.productos;
  v_cant numeric; v_precio numeric; v_permitir_negativo boolean; v_nombre text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'La venta no tiene items'; END IF;
  SELECT COALESCE((SELECT valor = 'true' FROM public.configuracion WHERE clave = 'permitir_stock_negativo'), false) INTO v_permitir_negativo;
  v_numero := 'VENTA-' || lpad(nextval('public.venta_numero_seq')::text, 6, '0');
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := (v_item->>'cantidad')::numeric; v_precio := (v_item->>'precio_unitario')::numeric;
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
    v_subtotal := v_subtotal + (v_cant * v_precio);
  END LOOP;
  INSERT INTO public.ventas (numero, usuario_id, caja_id, subtotal, descuento, total, metodo_pago, observaciones)
  VALUES (v_numero, auth.uid(), public.caja_abierta_actual(), v_subtotal, COALESCE(p_descuento,0), v_subtotal - COALESCE(p_descuento,0), p_metodo, p_observaciones)
  RETURNING * INTO v_venta;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := (v_item->>'cantidad')::numeric; v_precio := (v_item->>'precio_unitario')::numeric;
    IF (v_item->>'producto_id') IS NOT NULL THEN
      SELECT * INTO v_prod FROM public.productos WHERE id = (v_item->>'producto_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Producto inexistente'; END IF;
      IF NOT v_permitir_negativo AND v_prod.stock_actual - v_prod.stock_reservado < v_cant THEN
        RAISE EXCEPTION 'Stock insuficiente de %: disponible % (reservado para encargos: %)', v_prod.nombre, v_prod.stock_actual - v_prod.stock_reservado, v_prod.stock_reservado;
      END IF;
      INSERT INTO public.detalle_ventas (venta_id, producto_id, descripcion, categoria_id, cantidad, precio_unitario, costo_unitario, subtotal)
      VALUES (v_venta.id, v_prod.id, v_prod.nombre, v_prod.categoria_id, v_cant, v_precio, v_prod.precio_costo, v_cant * v_precio);
      UPDATE public.productos SET stock_actual = stock_actual - v_cant, updated_at = now() WHERE id = v_prod.id;
      INSERT INTO public.movimientos_stock (producto_id, usuario_id, tipo, cantidad, stock_resultante, motivo, referencia_id)
      VALUES (v_prod.id, auth.uid(), 'venta', -v_cant, v_prod.stock_actual - v_cant, 'Venta ' || v_numero, v_venta.id);
    ELSE
      SELECT nombre INTO v_nombre FROM public.servicios WHERE id = (v_item->>'servicio_id')::uuid;
      INSERT INTO public.detalle_ventas (venta_id, servicio_id, descripcion, cantidad, precio_unitario, subtotal, maquina_id)
      VALUES (v_venta.id, (v_item->>'servicio_id')::uuid, COALESCE(v_item->>'descripcion', v_nombre, 'Servicio'), v_cant, v_precio, v_cant * v_precio,
              NULLIF(v_item->>'maquina_id','')::uuid);
    END IF;
  END LOOP;
  INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, metodo_pago, importe, venta_id)
  VALUES (v_venta.caja_id, auth.uid(), 'venta', 'Venta ' || v_numero, p_metodo, v_venta.total, v_venta.id);
  PERFORM public.log_auditoria('crear', 'ventas', v_venta.id, 'Registró la venta ' || v_numero || ' por $' || v_venta.total);
  RETURN v_venta;
END; $function$;