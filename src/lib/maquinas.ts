import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMaquinas() {
  return useQuery({
    queryKey: ["maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maquinas").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export type EstadoComparacion = "coincide" | "diferencia" | "incompleto";

/** Compara lo que marcó el contador con lo registrado en ventas + encargos realizados. */
export function compararTurno(segunContador: number | null, ventas: number, encargos: number) {
  const registrados = Number(ventas) + Number(encargos);
  if (segunContador === null || segunContador === undefined)
    return { registrados, diferencia: null as number | null, estado: "incompleto" as EstadoComparacion };
  const diferencia = Number(segunContador) - registrados;
  return { registrados, diferencia, estado: (diferencia === 0 ? "coincide" : "diferencia") as EstadoComparacion };
}
