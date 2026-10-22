import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { fecha as fmtFecha, fechaHora, isoDay } from "@/lib/format";
import { compararTurno, useMaquinas, type EstadoComparacion } from "@/lib/maquinas";

export const Route = createFileRoute("/_authenticated/contadores")({
  head: () => ({
    meta: [
      { title: "Contadores de máquinas — Gestión de Librería" },
      { name: "description", content: "Control de contadores de fotocopiadoras e impresoras por turno." },
      { property: "og:title", content: "Contadores de máquinas — Gestión de Librería" },
      { property: "og:description", content: "Control de contadores por turno y comparación con ventas y encargos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contadores,
});

type Turno = "manana" | "tarde";
const TURNO_LABEL: Record<Turno, string> = { manana: "Mañana", tarde: "Tarde" };
const ord = (f: string, t: string) => `${f}-${t === "manana" ? 0 : 1}`;

type Fila = {
  maquina_id: string | null;
  maquina: string;
  activo: boolean;
  contador_inicial: number | null;
  contador_final: number | null;
  segun_contador: number | null;
  ventas: number;
  encargos: number;
};

function EstadoBadge({ e }: { e: EstadoComparacion }) {
  if (e === "coincide") return <Badge variant="outline" className="border-success/25 bg-success/10 text-success">Coincidente</Badge>;
  if (e === "diferencia") return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Diferencia detectada</Badge>;
  return <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning-foreground">Información incompleta</Badge>;
}

const useComparacion = (fecha: string, turno: Turno) =>
  useQuery({
    queryKey: ["comparar-contadores", fecha, turno],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("comparar_contadores", { p_fecha: fecha, p_turno: turno });
      if (error) throw error;
      return data as unknown as Fila[];
    },
  });

function Contadores() {
  const { isAdmin } = useAuth();
  const [fecha, setFecha] = useState(isoDay(new Date()));
  const [turno, setTurno] = useState<Turno>(new Date().getHours() < 14 ? "manana" : "tarde");

  return (
    <div>
      <PageHeader title="Contadores de máquinas" description="Registro manual por turno y comparación con ventas y encargos realizados." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="date" className="w-44" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
        {(["manana", "tarde"] as Turno[]).map((t) => (
          <Button key={t} variant={turno === t ? "default" : "outline"} onClick={() => setTurno(t)}>
            Turno {TURNO_LABEL[t].toLowerCase()}
          </Button>
        ))}
      </div>
      <Tabs defaultValue="turno">
        <TabsList>
          <TabsTrigger value="turno">Turno</TabsTrigger>
          <TabsTrigger value="dia">Resumen del día</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          {isAdmin && <TabsTrigger value="maquinas">Máquinas</TabsTrigger>}
        </TabsList>
        <TabsContent value="turno" className="mt-3">
          <CargaTurno fecha={fecha} turno={turno} />
        </TabsContent>
        <TabsContent value="dia" className="mt-3">
          <ResumenDia fecha={fecha} />
        </TabsContent>
        <TabsContent value="historial" className="mt-3">
          <Historial />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="maquinas" className="mt-3">
            <Maquinas />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ---------------- Carga y comparación del turno ---------------- */

function CargaTurno({ fecha, turno }: { fecha: string; turno: Turno }) {
  const qc = useQueryClient();
  const compQ = useComparacion(fecha, turno);
  const previosQ = useQuery({
    queryKey: ["contadores-previos", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contadores")
        .select("maquina_id,fecha,turno,contador_final")
        .lte("fecha", fecha)
        .not("contador_final", "is", null)
        .order("fecha", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });
  const [edit, setEdit] = useState<Record<string, { ini: string; fin: string; obs: string }>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const filas = compQ.data ?? [];
  const actual = ord(fecha, turno);

  // Valores iniciales del formulario: lo guardado o, si no hay, el final del turno anterior de esa máquina
  useEffect(() => {
    if (!compQ.data || !previosQ.data) return;
    const next: Record<string, { ini: string; fin: string; obs: string }> = {};
    for (const f of compQ.data) {
      if (!f.maquina_id) continue;
      const prev = previosQ.data
        .filter((p) => p.maquina_id === f.maquina_id && ord(p.fecha, p.turno) < actual)
        .sort((a, b) => (ord(b.fecha, b.turno) > ord(a.fecha, a.turno) ? 1 : -1))[0];
      next[f.maquina_id] = {
        ini: f.contador_inicial !== null ? String(f.contador_inicial) : prev ? String(prev.contador_final) : "",
        fin: f.contador_final !== null ? String(f.contador_final) : "",
        obs: "",
      };
    }
    setEdit(next);
  }, [compQ.data, previosQ.data, actual]);

  const guardar = async (maquinaId: string) => {
    const v = edit[maquinaId];
    if (!v) return;
    const ini = Number(v.ini);
    const fin = v.fin.trim() === "" ? null : Number(v.fin);
    if (v.ini.trim() === "" || !Number.isInteger(ini) || ini < 0) {
      toast.error("El contador inicial debe ser un número entero no negativo");
      return;
    }
    if (fin !== null && (!Number.isInteger(fin) || fin < 0)) {
      toast.error("El contador final debe ser un número entero no negativo");
      return;
    }
    if (fin !== null && fin < ini) {
      toast.error("El contador final no puede ser menor que el inicial");
      return;
    }
    setGuardando(maquinaId);
    const { error } = await supabase.rpc("guardar_contador", {
      p_maquina_id: maquinaId,
      p_fecha: fecha,
      p_turno: turno,
      p_inicial: ini,
      p_final: fin as number,
      p_observaciones: v.obs,
    });
    setGuardando(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contador guardado");
    void qc.invalidateQueries({ queryKey: ["comparar-contadores"] });
    void qc.invalidateQueries({ queryKey: ["contadores-previos"] });
    void qc.invalidateQueries({ queryKey: ["contadores-historial"] });
  };

  const sinMaquina = filas.find((f) => f.maquina_id === null);
  const haySinMaquina = sinMaquina && Number(sinMaquina.ventas) + Number(sinMaquina.encargos) > 0;

  return (
    <div className="space-y-3">
      {haySinMaquina && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          Hay trabajos sin máquina asignada en este turno. La comparación por máquina puede estar incompleta.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Máquina</TableHead>
              <TableHead>Contador inicial</TableHead>
              <TableHead>Contador final</TableHead>
              <TableHead className="text-right">Según contador</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Encargos realizados</TableHead>
              <TableHead className="text-right">Total registrado</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => {
              const c = compararTurno(f.segun_contador, f.ventas, f.encargos);
              const v = f.maquina_id ? edit[f.maquina_id] : undefined;
              if (!f.maquina_id) {
                if (!haySinMaquina) return null;
                return (
                  <TableRow key="sin">
                    <TableCell className="font-medium">Sin máquina asignada</TableCell>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground">No se puede comparar con un contador</TableCell>
                    <TableCell className="text-right tabular">{Number(f.ventas)}</TableCell>
                    <TableCell className="text-right tabular">{Number(f.encargos)}</TableCell>
                    <TableCell className="text-right tabular">{c.registrados}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell><EstadoBadge e="incompleto" /></TableCell>
                    <TableCell />
                  </TableRow>
                );
              }
              return (
                <TableRow key={f.maquina_id}>
                  <TableCell className="font-medium">
                    {f.maquina}
                    {!f.activo && <span className="ml-1 text-xs text-muted-foreground">(inactiva)</span>}
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="1" className="h-8 w-28" aria-label={`Inicial ${f.maquina}`}
                      value={v?.ini ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [f.maquina_id!]: { ...p[f.maquina_id!]!, ini: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="1" className="h-8 w-28" aria-label={`Final ${f.maquina}`}
                      value={v?.fin ?? ""} onChange={(e) => setEdit((p) => ({ ...p, [f.maquina_id!]: { ...p[f.maquina_id!]!, fin: e.target.value } }))} />
                  </TableCell>
                  <TableCell className="text-right tabular">{f.segun_contador ?? "-"}</TableCell>
                  <TableCell className="text-right tabular">{Number(f.ventas)}</TableCell>
                  <TableCell className="text-right tabular">{Number(f.encargos)}</TableCell>
                  <TableCell className="text-right tabular">{c.registrados}</TableCell>
                  <TableCell className={`text-right tabular ${c.diferencia ? "font-semibold text-destructive" : ""}`}>
                    {c.diferencia === null ? "-" : c.diferencia > 0 ? `+${c.diferencia}` : c.diferencia}
                  </TableCell>
                  <TableCell><EstadoBadge e={c.estado} /></TableCell>
                  <TableCell className="space-y-1">
                    <Input className="h-8 w-36" placeholder="Observaciones" value={v?.obs ?? ""}
                      onChange={(e) => setEdit((p) => ({ ...p, [f.maquina_id!]: { ...p[f.maquina_id!]!, obs: e.target.value } }))} />
                    <Button size="sm" className="w-36" disabled={guardando === f.maquina_id} onClick={() => void guardar(f.maquina_id!)}>
                      {guardando === f.maquina_id ? "Guardando..." : "Guardar"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        El contador inicial se completa con el final del turno anterior de cada máquina; verificalo antes de guardar.
        Diferencia positiva: la máquina marcó más trabajos que los registrados. Las ventas que cierran un encargo no se cuentan
        aparte: sus copias se toman de "Encargos realizados".
      </p>
    </div>
  );
}

/* ---------------- Resumen diario ---------------- */

function ResumenDia({ fecha }: { fecha: string }) {
  const m = useComparacion(fecha, "manana");
  const t = useComparacion(fecha, "tarde");
  const filas = useMemo(() => {
    const map = new Map<string, { nombre: string; seg: number | null; v: number; e: number; incompleto: boolean }>();
    for (const f of [...(m.data ?? []), ...(t.data ?? [])]) {
      const k = f.maquina_id ?? "sin";
      const r = map.get(k) ?? { nombre: f.maquina, seg: 0, v: 0, e: 0, incompleto: false };
      if (f.maquina_id) {
        if (f.segun_contador === null) r.incompleto = true;
        else r.seg = (r.seg ?? 0) + Number(f.segun_contador);
      }
      r.v += Number(f.ventas);
      r.e += Number(f.encargos);
      map.set(k, r);
    }
    return [...map.entries()].filter(([k, r]) => k !== "sin" || r.v + r.e > 0);
  }, [m.data, t.data]);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Máquina</TableHead>
            <TableHead className="text-right">Según contadores</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Encargos realizados</TableHead>
            <TableHead className="text-right">Total registrado</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map(([k, r]) => {
            const c = compararTurno(k === "sin" || r.incompleto ? null : r.seg, r.v, r.e);
            return (
              <TableRow key={k}>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell className="text-right tabular">{k === "sin" ? "-" : r.seg}</TableCell>
                <TableCell className="text-right tabular">{r.v}</TableCell>
                <TableCell className="text-right tabular">{r.e}</TableCell>
                <TableCell className="text-right tabular">{c.registrados}</TableCell>
                <TableCell className="text-right tabular">{c.diferencia ?? "-"}</TableCell>
                <TableCell><EstadoBadge e={c.estado} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="p-3 text-xs text-muted-foreground">Resumen de {fmtFecha(fecha + "T12:00:00")}: suma los turnos mañana y tarde; cada trabajo pertenece a un solo turno.</p>
    </div>
  );
}

/* ---------------- Historial ---------------- */

function Historial() {
  const maquinasQ = useMaquinas();
  const [maq, setMaq] = useState("");
  const hQ = useQuery({
    queryKey: ["contadores-historial", maq],
    queryFn: async () => {
      let q = supabase
        .from("contadores")
        .select("id,fecha,turno,contador_inicial,contador_final,observaciones,updated_at,maquinas(nombre),contadores_historial(id,fecha,inicial_anterior,final_anterior,inicial_nuevo,final_nuevo,observaciones)")
        .order("fecha", { ascending: false })
        .order("turno", { ascending: false })
        .limit(200);
      if (maq) q = q.eq("maquina_id", maq);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const perfilesQ = useQuery({
    queryKey: ["perfiles-nombres"],
    queryFn: async () => (await supabase.from("profiles").select("id,nombre,apellido")).data ?? [],
  });
  void perfilesQ;

  return (
    <div className="space-y-3">
      <select aria-label="Filtrar por máquina" className="h-9 rounded-md border bg-background px-2 text-sm" value={maq} onChange={(e) => setMaq(e.target.value)}>
        <option value="">Todas las máquinas</option>
        {(maquinasQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      </select>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Inicial</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead className="text-right">Trabajos</TableHead>
              <TableHead>Correcciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(hQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtFecha(r.fecha + "T12:00:00")}</TableCell>
                <TableCell>{TURNO_LABEL[r.turno as Turno]}</TableCell>
                <TableCell>{r.maquinas?.nombre}</TableCell>
                <TableCell className="text-right tabular">{r.contador_inicial}</TableCell>
                <TableCell className="text-right tabular">{r.contador_final ?? "-"}</TableCell>
                <TableCell className="text-right tabular">
                  {r.contador_final !== null ? Number(r.contador_final) - Number(r.contador_inicial) : "-"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(r.contadores_historial ?? [])
                    .filter((h) => h.inicial_anterior !== null || h.final_anterior !== null)
                    .map((h) => (
                      <div key={h.id}>
                        {fechaHora(h.fecha)}: {h.inicial_anterior}/{h.final_anterior ?? "-"} → {h.inicial_nuevo}/{h.final_nuevo ?? "-"}
                        {h.observaciones ? ` (${h.observaciones})` : ""}
                      </div>
                    ))}
                </TableCell>
              </TableRow>
            ))}
            {(hQ.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Sin registros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------- Máquinas (administrador) ---------------- */

function Maquinas() {
  const qc = useQueryClient();
  const maquinasQ = useMaquinas();
  const [nuevo, setNuevo] = useState({ nombre: "", tipo: "Fotocopiadora" });
  const [cambios, setCambios] = useState<Record<string, { nombre: string; tipo: string }>>({});

  const refrescar = () => void qc.invalidateQueries({ queryKey: ["maquinas"] }).then(() => qc.invalidateQueries({ queryKey: ["comparar-contadores"] }));

  const agregar = async () => {
    if (!nuevo.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const { error } = await supabase.from("maquinas").insert({ nombre: nuevo.nombre.trim(), tipo: nuevo.tipo.trim() || "Fotocopiadora" });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya existe una máquina con ese nombre" : error.message);
      return;
    }
    toast.success("Máquina agregada");
    setNuevo({ nombre: "", tipo: "Fotocopiadora" });
    refrescar();
  };

  const actualizar = async (id: string, datos: { nombre?: string; tipo?: string; activo?: boolean }) => {
    if (datos.nombre !== undefined && !datos.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const { error } = await supabase.from("maquinas").update(datos).eq("id", id);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya existe una máquina con ese nombre" : error.message);
      return;
    }
    toast.success("Máquina actualizada");
    setCambios((p) => {
      const { [id]: _omit, ...rest } = p;
      return rest;
    });
    refrescar();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="w-48" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Input className="w-48" placeholder="Tipo" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} />
        <Button onClick={() => void agregar()}>Agregar máquina</Button>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(maquinasQ.data ?? []).map((m) => {
              const c = cambios[m.id] ?? { nombre: m.nombre, tipo: m.tipo };
              const modificado = c.nombre !== m.nombre || c.tipo !== m.tipo;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <Input className="h-8 w-48" value={c.nombre} onChange={(e) => setCambios((p) => ({ ...p, [m.id]: { ...c, nombre: e.target.value } }))} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-8 w-48" value={c.tipo} onChange={(e) => setCambios((p) => ({ ...p, [m.id]: { ...c, tipo: e.target.value } }))} />
                  </TableCell>
                  <TableCell>{m.activo ? "Activa" : "Inactiva"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {modificado && <Button size="sm" onClick={() => void actualizar(m.id, c)}>Guardar</Button>}
                    <Button size="sm" variant="outline" onClick={() => void actualizar(m.id, { activo: !m.activo })}>
                      {m.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Las máquinas desactivadas conservan todo su historial.</p>
    </div>
  );
}
