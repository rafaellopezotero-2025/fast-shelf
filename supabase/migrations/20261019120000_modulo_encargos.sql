CREATE TYPE public.estado_encargo AS ENUM ('pendiente','en_proceso','listo','finalizado','cancelado');

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS stock_reservado numeric NOT NULL DEFAULT 0;

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellido text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cli_select ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY cli_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (length(trim(nombre)) > 0);
CREATE POLICY cli_update ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (length(trim(nombre)) > 0);

CREATE SEQUENCE public.encargo_numero_seq;

CREATE TABLE public.encargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid REFERENCES public.clientes(id),
  telefono text NOT NULL DEFAULT '',
  usuario_id uuid,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  pagado numeric NOT NULL DEFAULT 0 CHECK (pagado >= 0),
  estado public.estado_encargo NOT NULL DEFAULT 'pendiente',
  fecha_retiro timestamptz,
  observaciones text,
  venta_id uuid UNIQUE REFERENCES public.ventas(id),
  entregado_at timestamptz,
  entregado_por uuid,
  cancelado_at timestamptz,
  cancelado_por uuid,
  motivo_cancelacion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pagado <= total OR estado = 'cancelado')
);
CREATE TABLE public.encargo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_id uuid NOT NULL REFERENCES public.encargos(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id),
  servicio_id uuid REFERENCES public.servicios(id),
  descripcion text NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0),
  subtotal numeric NOT NULL,
  CHECK ((producto_id IS NULL) <> (servicio_id IS NULL))
);
CREATE TABLE public.encargo_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_id uuid NOT NULL REFERENCES public.encargos(id),
  importe numeric NOT NULL CHECK (importe > 0),
  metodo_pago public.metodo_pago NOT NULL,
  usuario_id uuid,
  caja_id uuid REFERENCES public.cajas(id),
  fecha timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.encargo_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encargo_id uuid NOT NULL REFERENCES public.encargos(id),
  usuario_id uuid,
  accion text NOT NULL,
  detalle text,
  fecha timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.encargos (estado, created_at DESC);
CREATE INDEX ON public.encargo_items (encargo_id);
CREATE INDEX ON public.encargo_pagos (encargo_id);
CREATE INDEX ON public.encargo_historial (encargo_id);
CREATE INDEX ON public.clientes (telefono);

GRANT SELECT ON public.encargos, public.encargo_items, public.encargo_pagos, public.encargo_historial TO authenticated;
GRANT ALL ON public.encargos, public.encargo_items, public.encargo_pagos, public.encargo_historial TO service_role;
ALTER TABLE public.encargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encargo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encargo_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encargo_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY enc_select ON public.encargos FOR SELECT TO authenticated USING (true);
CREATE POLICY enci_select ON public.encargo_items FOR SELECT TO authenticated USING (true);
CREATE POLICY encp_select ON public.encargo_pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY ench_select ON public.encargo_historial FOR SELECT TO authenticated USING (true);

-- Libera las reservas de un encargo (uso interno)
CREATE OR REPLACE FUNCTION public._encargo_liberar_reservas(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT producto_id, sum(cantidad) c FROM public.encargo_items
           WHERE encargo_id = p_id AND producto_id IS NOT NULL GROUP BY producto_id ORDER BY producto_id LOOP
    UPDATE public.productos SET stock_reservado = greatest(0, stock_reservado - r.c), updated_at = now() WHERE id = r.producto_id;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public._encargo_liberar_reservas(uuid) FROM PUBLIC, anon, authenticated;

-- Crear o modificar un encargo
CREATE OR REPLACE FUNCTION public.guardar_encargo(
  p_id uuid, p_cliente_id uuid, p_telefono text, p_items jsonb,
  p_fecha_retiro timestamptz, p_observaciones text
) RETURNS public.encargos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enc public.encargos; v_item jsonb; v_prod public.productos; v_total numeric := 0;
  v_cant numeric; v_precio numeric; v_nombre text; v_neg boolean; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'El encargo no tiene ítems'; END IF;
  SELECT COALESCE((SELECT valor = 'true' FROM public.configuracion WHERE clave = 'permitir_stock_negativo'), false) INTO v_neg;

  IF p_id IS NULL THEN
    INSERT INTO public.encargos (numero, cliente_id, telefono, usuario_id, fecha_retiro, observaciones)
    VALUES ('ENC-' || lpad(nextval('public.encargo_numero_seq')::text, 6, '0'), p_cliente_id,
            COALESCE(p_telefono,''), auth.uid(), p_fecha_retiro, p_observaciones)
    RETURNING * INTO v_enc;
    INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle) VALUES (v_enc.id, auth.uid(), 'creado', 'Encargo registrado');
  ELSE
    SELECT * INTO v_enc FROM public.encargos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Encargo inexistente'; END IF;
    IF v_enc.estado IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'El encargo ya está % y no se puede modificar', v_enc.estado; END IF;
    PERFORM public._encargo_liberar_reservas(p_id);
    DELETE FROM public.encargo_items WHERE encargo_id = p_id;
    UPDATE public.encargos SET cliente_id = p_cliente_id, telefono = COALESCE(p_telefono,''),
      fecha_retiro = p_fecha_retiro, observaciones = p_observaciones, updated_at = now()
    WHERE id = p_id RETURNING * INTO v_enc;
    INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle) VALUES (p_id, auth.uid(), 'modificado', 'Se modificaron los datos o ítems');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := (v_item->>'cantidad')::numeric;
    v_precio := (v_item->>'precio_unitario')::numeric;
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
    IF v_precio IS NULL OR v_precio < 0 THEN RAISE EXCEPTION 'Precio inválido'; END IF;
    IF (v_item->>'producto_id') IS NOT NULL THEN
      SELECT nombre INTO v_nombre FROM public.productos WHERE id = (v_item->>'producto_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Producto inexistente'; END IF;
      INSERT INTO public.encargo_items (encargo_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (v_enc.id, (v_item->>'producto_id')::uuid, v_nombre, v_cant, v_precio, v_cant * v_precio);
    ELSE
      SELECT nombre INTO v_nombre FROM public.servicios WHERE id = (v_item->>'servicio_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Servicio inexistente'; END IF;
      INSERT INTO public.encargo_items (encargo_id, servicio_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (v_enc.id, (v_item->>'servicio_id')::uuid, COALESCE(v_item->>'descripcion', v_nombre), v_cant, v_precio, v_cant * v_precio);
    END IF;
    v_total := v_total + v_cant * v_precio;
  END LOOP;

  -- Reservar stock con bloqueo por producto (orden fijo para evitar interbloqueos)
  FOR r IN SELECT producto_id, sum(cantidad) c FROM public.encargo_items
           WHERE encargo_id = v_enc.id AND producto_id IS NOT NULL GROUP BY producto_id ORDER BY producto_id LOOP
    SELECT * INTO v_prod FROM public.productos WHERE id = r.producto_id FOR UPDATE;
    IF NOT v_neg AND v_prod.stock_actual - v_prod.stock_reservado < r.c THEN
      RAISE EXCEPTION 'Stock insuficiente de %: disponible %', v_prod.nombre, v_prod.stock_actual - v_prod.stock_reservado;
    END IF;
    UPDATE public.productos SET stock_reservado = stock_reservado + r.c, updated_at = now() WHERE id = r.producto_id;
  END LOOP;

  IF v_enc.pagado > v_total THEN
    RAISE EXCEPTION 'El nuevo total ($%) es menor que lo ya abonado ($%)', v_total, v_enc.pagado;
  END IF;
  UPDATE public.encargos SET total = v_total, updated_at = now() WHERE id = v_enc.id RETURNING * INTO v_enc;
  PERFORM public.log_auditoria(CASE WHEN p_id IS NULL THEN 'crear' ELSE 'modificar' END, 'encargos', v_enc.id,
    'Encargo ' || v_enc.numero || ' por $' || v_total);
  RETURN v_enc;
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_pago_encargo(p_id uuid, p_importe numeric, p_metodo public.metodo_pago)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enc public.encargos; v_caja uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_importe IS NULL OR p_importe <= 0 THEN RAISE EXCEPTION 'El importe debe ser mayor a cero'; END IF;
  SELECT * INTO v_enc FROM public.encargos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo inexistente'; END IF;
  IF v_enc.estado IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'No se pueden registrar pagos en un encargo %', v_enc.estado; END IF;
  IF v_enc.pagado + p_importe > v_enc.total THEN
    RAISE EXCEPTION 'El pago supera el saldo pendiente ($%)', v_enc.total - v_enc.pagado;
  END IF;
  v_caja := public.caja_abierta_actual();
  INSERT INTO public.encargo_pagos (encargo_id, importe, metodo_pago, usuario_id, caja_id)
  VALUES (p_id, p_importe, p_metodo, auth.uid(), v_caja);
  INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, metodo_pago, importe)
  VALUES (v_caja, auth.uid(), 'ingreso', 'Seña encargo ' || v_enc.numero, p_metodo, p_importe);
  UPDATE public.encargos SET pagado = pagado + p_importe, updated_at = now() WHERE id = p_id;
  INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle)
  VALUES (p_id, auth.uid(), 'pago', 'Pago anticipado de $' || p_importe || ' (' || p_metodo || ')');
  PERFORM public.log_auditoria('pago', 'encargos', p_id, 'Seña de $' || p_importe || ' en ' || v_enc.numero);
END; $$;

CREATE OR REPLACE FUNCTION public.cambiar_estado_encargo(p_id uuid, p_estado public.estado_encargo)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enc public.encargos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_enc FROM public.encargos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo inexistente'; END IF;
  IF p_estado NOT IN ('pendiente','en_proceso','listo') OR v_enc.estado NOT IN ('pendiente','en_proceso','listo') THEN
    RAISE EXCEPTION 'Cambio de estado no permitido';
  END IF;
  IF v_enc.estado = p_estado THEN RETURN; END IF;
  UPDATE public.encargos SET estado = p_estado, updated_at = now() WHERE id = p_id;
  INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle)
  VALUES (p_id, auth.uid(), 'estado', v_enc.estado || ' → ' || p_estado);
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_encargo(p_id uuid, p_motivo text, p_devolver boolean, p_metodo public.metodo_pago)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enc public.encargos; v_det text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'El motivo es obligatorio'; END IF;
  SELECT * INTO v_enc FROM public.encargos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo inexistente'; END IF;
  IF v_enc.estado IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'El encargo ya está %', v_enc.estado; END IF;
  PERFORM public._encargo_liberar_reservas(p_id);
  v_det := 'Motivo: ' || p_motivo;
  IF v_enc.pagado > 0 THEN
    IF p_devolver THEN
      INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, metodo_pago, importe)
      VALUES (public.caja_abierta_actual(), auth.uid(), 'retiro', 'Devolución seña ' || v_enc.numero, COALESCE(p_metodo,'efectivo'), -v_enc.pagado);
      v_det := v_det || '. Se devolvieron $' || v_enc.pagado;
    ELSE
      v_det := v_det || '. Pagos por $' || v_enc.pagado || ' quedan pendientes de resolver (no se devolvieron)';
    END IF;
  END IF;
  UPDATE public.encargos SET estado = 'cancelado', cancelado_at = now(), cancelado_por = auth.uid(),
    motivo_cancelacion = v_det, updated_at = now() WHERE id = p_id;
  INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle) VALUES (p_id, auth.uid(), 'cancelado', v_det);
  PERFORM public.log_auditoria('cancelar', 'encargos', p_id, 'Canceló ' || v_enc.numero || '. ' || v_det);
END; $$;

CREATE OR REPLACE FUNCTION public.finalizar_encargo(p_id uuid, p_metodo public.metodo_pago)
RETURNS public.ventas LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enc public.encargos; v_venta public.ventas; v_numero text; v_saldo numeric; v_it record; v_prod public.productos; v_metodo public.metodo_pago;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_enc FROM public.encargos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encargo inexistente'; END IF;
  IF v_enc.estado IN ('finalizado','cancelado') OR v_enc.venta_id IS NOT NULL THEN
    RAISE EXCEPTION 'El encargo ya fue % ', v_enc.estado;
  END IF;
  v_saldo := v_enc.total - v_enc.pagado;
  v_metodo := COALESCE(p_metodo, (SELECT metodo_pago FROM public.encargo_pagos WHERE encargo_id = p_id ORDER BY fecha DESC LIMIT 1), 'efectivo');
  v_numero := 'VENTA-' || lpad(nextval('public.venta_numero_seq')::text, 6, '0');

  INSERT INTO public.ventas (numero, usuario_id, caja_id, subtotal, descuento, total, metodo_pago, observaciones)
  VALUES (v_numero, auth.uid(), public.caja_abierta_actual(), v_enc.total, 0, v_enc.total, v_metodo,
          'Encargo ' || v_enc.numero || CASE WHEN v_enc.pagado > 0 THEN ' (señas previas $' || v_enc.pagado || ')' ELSE '' END)
  RETURNING * INTO v_venta;

  FOR v_it IN SELECT * FROM public.encargo_items WHERE encargo_id = p_id ORDER BY producto_id NULLS LAST LOOP
    IF v_it.producto_id IS NOT NULL THEN
      SELECT * INTO v_prod FROM public.productos WHERE id = v_it.producto_id FOR UPDATE;
      INSERT INTO public.detalle_ventas (venta_id, producto_id, descripcion, categoria_id, cantidad, precio_unitario, costo_unitario, subtotal)
      VALUES (v_venta.id, v_prod.id, v_it.descripcion, v_prod.categoria_id, v_it.cantidad, v_it.precio_unitario, v_prod.precio_costo, v_it.subtotal);
      UPDATE public.productos SET stock_actual = stock_actual - v_it.cantidad,
        stock_reservado = greatest(0, stock_reservado - v_it.cantidad), updated_at = now() WHERE id = v_prod.id;
      INSERT INTO public.movimientos_stock (producto_id, usuario_id, tipo, cantidad, stock_resultante, motivo, referencia_id)
      VALUES (v_prod.id, auth.uid(), 'venta', -v_it.cantidad, v_prod.stock_actual - v_it.cantidad, 'Venta ' || v_numero || ' (encargo ' || v_enc.numero || ')', v_venta.id);
    ELSE
      INSERT INTO public.detalle_ventas (venta_id, servicio_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (v_venta.id, v_it.servicio_id, v_it.descripcion, v_it.cantidad, v_it.precio_unitario, v_it.subtotal);
    END IF;
  END LOOP;

  -- Solo ingresa a caja el saldo; las señas ya se registraron al cobrarlas
  IF v_saldo > 0 THEN
    INSERT INTO public.encargo_pagos (encargo_id, importe, metodo_pago, usuario_id, caja_id)
    VALUES (p_id, v_saldo, v_metodo, auth.uid(), v_venta.caja_id);
    INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, metodo_pago, importe, venta_id)
    VALUES (v_venta.caja_id, auth.uid(), 'venta', 'Saldo encargo ' || v_enc.numero || ' / ' || v_numero, v_metodo, v_saldo, v_venta.id);
  END IF;

  UPDATE public.encargos SET estado = 'finalizado', pagado = total, venta_id = v_venta.id,
    entregado_at = now(), entregado_por = auth.uid(), updated_at = now() WHERE id = p_id;
  INSERT INTO public.encargo_historial (encargo_id, usuario_id, accion, detalle)
  VALUES (p_id, auth.uid(), 'finalizado', 'Retirado. Venta ' || v_numero || '. Cobrado al retirar: $' || v_saldo);
  PERFORM public.log_auditoria('finalizar', 'encargos', p_id, 'Entregó ' || v_enc.numero || ' — venta ' || v_numero);
  RETURN v_venta;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guardar_encargo(uuid, uuid, text, jsonb, timestamptz, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pago_encargo(uuid, numeric, public.metodo_pago) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cambiar_estado_encargo(uuid, public.estado_encargo) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_encargo(uuid, text, boolean, public.metodo_pago) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalizar_encargo(uuid, public.metodo_pago) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_encargo(uuid, uuid, text, jsonb, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_encargo(uuid, numeric, public.metodo_pago) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_encargo(uuid, public.estado_encargo) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_encargo(uuid, text, boolean, public.metodo_pago) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_encargo(uuid, public.metodo_pago) TO authenticated;

-- Ventas comunes: no vender unidades reservadas por encargos
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
      INSERT INTO public.detalle_ventas (venta_id, servicio_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (v_venta.id, (v_item->>'servicio_id')::uuid, COALESCE(v_item->>'descripcion', v_nombre, 'Servicio'), v_cant, v_precio, v_cant * v_precio);
    END IF;
  END LOOP;
  INSERT INTO public.movimientos_caja (caja_id, usuario_id, tipo, concepto, metodo_pago, importe, venta_id)
  VALUES (v_venta.caja_id, auth.uid(), 'venta', 'Venta ' || v_numero, p_metodo, v_venta.total, v_venta.id);
  PERFORM public.log_auditoria('crear', 'ventas', v_venta.id, 'Registró la venta ' || v_numero || ' por $' || v_venta.total);
  RETURN v_venta;
END; $function$;