import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fechaHora } from "@/lib/format";
import { useMaquinas } from "@/lib/maquinas";

/** Copias / impresiones de un encargo efectivamente realizadas, con fecha y máquina. */
export function TrabajosRealizados({
  encargoId,
  activo,
  items,
}: {
  encargoId: string;
  activo: boolean;
  items: { id: string; descripcion: string; cantidad: number }[];
}) {
  const qc = useQueryClient();
  const maquinasQ = useMaquinas();
  const [form, setForm] = useState<Record<string, { cant: string; maq: string }>>({});
  const [ocupado, setOcupado] = useState(false);
  const tQ = useQuery({
    queryKey: ["encargo-trabajos", encargoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encargo_trabajos")
        .select("id,encargo_item_id,cantidad,fecha,maquinas(nombre)")
        .eq("encargo_id", encargoId)
        .order("fecha");
      if (error) throw error;
      return data;
    },
  });
  if (items.length === 0) return null;
  const trabajos = tQ.data ?? [];

  const registrar = async (itemId: string) => {
    const f = form[itemId] ?? { cant: "", maq: "" };
    const n = Number(f.cant);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a cero");
      return;
    }
    setOcupado(true);
    const { error } = await supabase.rpc("registrar_trabajo_encargo", {
      p_item_id: itemId,
      p_cantidad: n,
      p_maquina_id: (f.maq || null) as string,
    });
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trabajo registrado");
    setForm((p) => ({ ...p, [itemId]: { cant: "", maq: f.maq } }));
    void qc.invalidateQueries();
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">Copias / impresiones realizadas</p>
      {items.map((i) => {
        const hechos = trabajos.filter((t) => t.encargo_item_id === i.id);
        const total = hechos.reduce((a, t) => a + Number(t.cantidad), 0);
        const f = form[i.id] ?? { cant: "", maq: "" };
        return (
          <div key={i.id} className="space-y-1 border-b pb-2 last:border-0">
            <p>
              {i.descripcion}: <b>{total}</b> de {Number(i.cantidad)} realizadas
            </p>
            {hechos.map((t) => (
              <p key={t.id} className="text-xs text-muted-foreground">
                {fechaHora(t.fecha)} · {Number(t.cantidad)} · {t.maquinas?.nombre ?? "Sin máquina asignada"}
              </p>
            ))}
            {activo && total < Number(i.cantidad) && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  className="h-8 w-24"
                  placeholder="Cant."
                  value={f.cant}
                  onChange={(x) => setForm((p) => ({ ...p, [i.id]: { ...f, cant: x.target.value } }))}
                />
                <select
                  aria-label="Máquina utilizada"
                  className="h-8 rounded border bg-background px-2 text-sm"
                  value={f.maq}
                  onChange={(x) => setForm((p) => ({ ...p, [i.id]: { ...f, maq: x.target.value } }))}
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
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => void registrar(i.id)}>
                  Registrar realizado
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
