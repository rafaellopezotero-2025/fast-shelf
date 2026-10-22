import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, METODOS_PAGO } from "@/lib/format";
import { useMaquinas } from "@/lib/maquinas";

export type ItemCarrito = {
  key: string;
  producto_id: string | null;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  stock?: number;
  maquina_id?: string | null;
};

export function useCatalogo() {
  const productosQ = useQuery({
    queryKey: ["catalogo-productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id,nombre,sku,codigo_barras,precio_venta,stock_actual,stock_minimo,punto_reposicion,stock_objetivo,categoria_id,categorias(nombre)")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const serviciosQ = useQuery({
    queryKey: ["catalogo-servicios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicios")
        .select("id,nombre,clase,tamano,color,doble_faz,precio_unitario")
        .eq("activo", true)
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  return { productosQ, serviciosQ };
}

export function Carrito({
  items,
  setItems,
  titulo = "Carrito",
}: {
  items: ItemCarrito[];
  setItems: (fn: (prev: ItemCarrito[]) => ItemCarrito[]) => void;
  titulo?: string;
}) {
  const qc = useQueryClient();
  const maquinasQ = useMaquinas();
  const [metodo, setMetodo] = useState<string>("efectivo");
  const [descuento, setDescuento] = useState("0");
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);

  const subtotal = items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);
  const desc = Math.max(0, Number(descuento) || 0);
  const total = Math.max(0, subtotal - desc);

  const cambiar = (key: string, delta: number) =>
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        const c = i.cantidad + delta;
        return c <= 0 ? [] : [{ ...i, cantidad: c }];
      }),
    );

  const confirmar = async () => {
    if (!items.length) return;
    setGuardando(true);
    const { data, error } = await supabase.rpc("crear_venta", {
      p_items: items.map((i) => ({
        producto_id: i.producto_id,
        servicio_id: i.servicio_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        maquina_id: i.maquina_id ?? null,
      })),
      p_metodo: metodo as never,
      p_descuento: desc,
      ...(obs ? { p_observaciones: obs } : {}),
    });
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const venta = data as unknown as { numero: string; total: number };
    toast.success(`Venta ${venta.numero} registrada por ${money(venta.total)}`);
    setItems(() => []);
    setDescuento("0");
    setObs("");
    void qc.invalidateQueries();
  };

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="size-4" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Agregá productos o servicios.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {items.map((i) => (
              <div key={i.key} className="rounded-lg border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{i.descripcion}</p>
                    {i.servicio_id && (
                      <select
                        aria-label="Máquina utilizada"
                        className="mt-1 rounded border bg-background px-1 py-0.5 text-xs"
                        value={i.maquina_id ?? ""}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) => (x.key === i.key ? { ...x, maquina_id: e.target.value || null } : x)),
                          )
                        }
                      >
                        <option value="">Sin máquina asignada</option>
                        {(maquinasQ.data ?? [])
                          .filter((m) => m.activo)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nombre}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                  <button
                    aria-label="Quitar"
                    onClick={() => setItems((prev) => prev.filter((x) => x.key !== i.key))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7" onClick={() => cambiar(i.key, -1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-10 text-center text-sm tabular">{i.cantidad}</span>
                    <Button variant="outline" size="icon" className="size-7" onClick={() => cambiar(i.key, 1)}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold tabular">{money(i.cantidad * i.precio_unitario)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular">{money(subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="descuento" className="text-sm text-muted-foreground">
              Descuento
            </Label>
            <Input
              id="descuento"
              type="number"
              min="0"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              className="h-8 text-right"
            />
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span className="tabular">{money(total)}</span>
          </div>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METODOS_PAGO.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Observaciones (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
          />
          <Button className="w-full" disabled={!items.length || guardando} onClick={() => void confirmar()}>
            {guardando ? "Registrando..." : "Confirmar venta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

