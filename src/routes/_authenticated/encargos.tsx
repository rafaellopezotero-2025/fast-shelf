import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCatalogo } from "@/components/Carrito";
import { fechaHora, labelMetodo, money, METODOS_PAGO } from "@/lib/format";
import { ESTADOS_ENCARGO, editable, estadoInfo, saldoEncargo, type EstadoEncargo } from "@/lib/encargos";

export const Route = createFileRoute("/_authenticated/encargos")({
  head: () => ({
    meta: [
      { title: "Encargos — Gestión de Librería" },
      { name: "description", content: "Pedidos con seña, saldo pendiente y retiro." },
      { property: "og:title", content: "Encargos — Gestión de Librería" },
      { property: "og:description", content: "Pedidos con seña, saldo pendiente y retiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Encargos,
});

type Encargo = {
  id: string;
  numero: string;
  cliente_id: string | null;
  telefono: string;
  total: number;
  pagado: number;
  estado: EstadoEncargo;
  fecha_retiro: string | null;
  observaciones: string | null;
  created_at: string;
  entregado_at: string | null;
  motivo_cancelacion: string | null;
  venta_id: string | null;
  clientes: { nombre: string; apellido: string; telefono: string } | null;
};

type Item = {
  key: string;
  producto_id: string | null;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

const errMsg = (e: { message: string }) =>
  e.message.includes("could not serialize") || e.message.includes("deadlock")
    ? "Otro usuario estaba modificando lo mismo. Volvé a intentar."
    : e.message;

function EstadoBadge({ e }: { e: string }) {
  const i = estadoInfo(e);
  return (
    <Badge variant="outline" className={i.className}>
      {i.label}
    </Badge>
  );
}

function Encargos() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("activos");
  const [desde, setDesde] = useState("");
  const [formId, setFormId] = useState<string | null | undefined>(undefined); // undefined = cerrado, null = nuevo
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const encQ = useQuery({
    queryKey: ["encargos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encargos")
        .select("*, clientes(nombre,apellido,telefono)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Encargo[];
    },
  });

  const filtrados = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (encQ.data ?? []).filter((e) => {
      if (estado === "activos" && !editable(e.estado)) return false;
      if (estado !== "activos" && estado !== "todos" && e.estado !== estado) return false;
      if (desde && e.created_at.slice(0, 10) < desde) return false;
      if (!n) return true;
      const c = e.clientes;
      return `${e.numero} ${c?.nombre ?? ""} ${c?.apellido ?? ""} ${c?.telefono ?? ""} ${e.telefono}`
        .toLowerCase()
        .includes(n);
    });
  }, [encQ.data, q, estado, desde]);

  return (
    <div>
      <PageHeader
        title="Encargos"
        description="Pedidos presenciales o por WhatsApp, con seña y retiro."
        actions={
          <Button onClick={() => setFormId(null)}>
            <Plus className="size-4" /> Nuevo encargo
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Número, cliente o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activos">Activos (sin finalizar)</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {ESTADOS_ENCARGO.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-44" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde fecha" />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Retiro previsto</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => setDetalleId(e.id)}>
                <TableCell className="font-medium">{e.numero}</TableCell>
                <TableCell>
                  {e.clientes ? `${e.clientes.nombre} ${e.clientes.apellido}`.trim() : "-"}
                  <div className="text-xs text-muted-foreground">{e.telefono || e.clientes?.telefono}</div>
                </TableCell>
                <TableCell>{fechaHora(e.created_at)}</TableCell>
                <TableCell>{fechaHora(e.fecha_retiro)}</TableCell>
                <TableCell className="text-right tabular">{money(e.total)}</TableCell>
                <TableCell className="text-right tabular">
                  {e.estado === "finalizado" || e.estado === "cancelado" ? "-" : money(saldoEncargo(e.total, e.pagado))}
                </TableCell>
                <TableCell>
                  <EstadoBadge e={e.estado} />
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {encQ.isLoading ? "Cargando..." : "No hay encargos para mostrar."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {formId !== undefined && (
        <FormEncargo
          id={formId}
          onClose={(nuevoId) => {
            setFormId(undefined);
            if (nuevoId) setDetalleId(nuevoId);
          }}
        />
      )}
      {detalleId && (
        <DetalleEncargo
          id={detalleId}
          onClose={() => setDetalleId(null)}
          onEditar={() => {
            setFormId(detalleId);
            setDetalleId(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Formulario crear / modificar ---------------- */

function FormEncargo({ id, onClose }: { id: string | null; onClose: (nuevoId?: string) => void }) {
  const qc = useQueryClient();
  const { productosQ, serviciosQ } = useCatalogo();
  const [cargado, setCargado] = useState(id === null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [telefono, setTelefono] = useState("");
  const [retiro, setRetiro] = useState("");
  const [obs, setObs] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [buscar, setBuscar] = useState("");
  const [buscarCli, setBuscarCli] = useState("");
  const [nuevoCli, setNuevoCli] = useState<{ nombre: string; apellido: string; telefono: string } | null>(null);
  const [sena, setSena] = useState("");
  const [metodoSena, setMetodoSena] = useState("efectivo");
  const [guardando, setGuardando] = useState(false);

  const clientesQ = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const reservasQ = useQuery({
    queryKey: ["reservas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("id,stock_reservado").gt("stock_reservado", 0);
      if (error) throw error;
      return Object.fromEntries(data.map((p) => [p.id, Number(p.stock_reservado)]));
    },
  });

  useQuery({
    queryKey: ["encargo-edit", id],
    enabled: id !== null && !cargado,
    queryFn: async () => {
      const [{ data: e, error }, { data: its }] = await Promise.all([
        supabase.from("encargos").select("*").eq("id", id!).single(),
        supabase.from("encargo_items").select("*").eq("encargo_id", id!),
      ]);
      if (error) throw error;
      setClienteId(e.cliente_id);
      setTelefono(e.telefono);
      setRetiro(e.fecha_retiro ? toLocalInput(e.fecha_retiro) : "");
      setObs(e.observaciones ?? "");
      setItems(
        (its ?? []).map((i) => ({
          key: i.id,
          producto_id: i.producto_id,
          servicio_id: i.servicio_id,
          descripcion: i.descripcion,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
        })),
      );
      setCargado(true);
      return e;
    },
  });

  const cliente = clientesQ.data?.find((c) => c.id === clienteId);
  const total = items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0);

  const resultados = useMemo(() => {
    const n = buscar.trim().toLowerCase();
    if (!n) return [];
    const prods = (productosQ.data ?? [])
      .filter((p) => p.nombre.toLowerCase().includes(n) || p.sku.toLowerCase().includes(n) || (p.codigo_barras ?? "").includes(n))
      .slice(0, 8)
      .map((p) => {
        const disp = Number(p.stock_actual) - (reservasQ.data?.[p.id] ?? 0);
        return { tipo: "p" as const, id: p.id, nombre: p.nombre, precio: Number(p.precio_venta), extra: `disponible ${disp}` };
      });
    const servs = (serviciosQ.data ?? [])
      .filter((s) => s.nombre.toLowerCase().includes(n))
      .slice(0, 6)
      .map((s) => ({ tipo: "s" as const, id: s.id, nombre: s.nombre, precio: Number(s.precio_unitario), extra: "servicio" }));
    return [...prods, ...servs];
  }, [buscar, productosQ.data, serviciosQ.data, reservasQ.data]);

  const clientesFiltrados = useMemo(() => {
    const n = buscarCli.trim().toLowerCase();
    if (!n) return [];
    return (clientesQ.data ?? [])
      .filter((c) => `${c.nombre} ${c.apellido} ${c.telefono}`.toLowerCase().includes(n))
      .slice(0, 6);
  }, [buscarCli, clientesQ.data]);

  const agregar = (r: (typeof resultados)[number]) => {
    setItems((prev) => {
      const k = r.tipo === "p" ? "producto_id" : "servicio_id";
      const f = prev.find((i) => i[k] === r.id);
      if (f) return prev.map((i) => (i === f ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [
        ...prev,
        {
          key: `${r.tipo}-${r.id}`,
          producto_id: r.tipo === "p" ? r.id : null,
          servicio_id: r.tipo === "s" ? r.id : null,
          descripcion: r.nombre,
          cantidad: 1,
          precio_unitario: r.precio,
        },
      ];
    });
    setBuscar("");
  };

  const guardarCliente = async () => {
    if (!nuevoCli || !nuevoCli.nombre.trim()) return toast.error("El nombre del cliente es obligatorio");
    const { data, error } = await supabase
      .from("clientes")
      .insert({ nombre: nuevoCli.nombre.trim(), apellido: nuevoCli.apellido.trim(), telefono: nuevoCli.telefono.trim() })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["clientes"] });
    setClienteId(data.id);
    if (!telefono) setTelefono(data.telefono);
    setNuevoCli(null);
    setBuscarCli("");
    toast.success("Cliente registrado");
  };

  const guardar = async () => {
    if (!items.length) return toast.error("Agregá al menos un producto o servicio");
    if (items.some((i) => !(i.cantidad > 0) || !(i.precio_unitario >= 0)))
      return toast.error("Revisá cantidades y precios: deben ser números válidos");
    const senaN = sena.trim() ? Number(sena) : 0;
    if (!Number.isFinite(senaN) || senaN < 0) return toast.error("La seña debe ser un número no negativo");
    if (senaN > total) return toast.error("La seña no puede superar el total del encargo");
    setGuardando(true);
    const { data, error } = await supabase.rpc("guardar_encargo", {
      p_id: id as string,
      p_cliente_id: clienteId as string,
      p_telefono: telefono,
      p_items: items.map(({ key: _k, ...i }) => i),
      p_fecha_retiro: retiro ? new Date(retiro).toISOString() : (null as unknown as string),
      p_observaciones: obs,
    });
    if (error) {
      setGuardando(false);
      return toast.error(errMsg(error));
    }
    const enc = data as unknown as { id: string; numero: string };
    if (senaN > 0) {
      const { error: e2 } = await supabase.rpc("registrar_pago_encargo", {
        p_id: enc.id,
        p_importe: senaN,
        p_metodo: metodoSena as never,
      });
      if (e2) toast.error(`Encargo guardado, pero la seña no se registró: ${errMsg(e2)}`);
    }
    setGuardando(false);
    toast.success(`Encargo ${enc.numero} guardado`);
    void qc.invalidateQueries();
    onClose(enc.id);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{id ? "Modificar encargo" : "Nuevo encargo"}</DialogTitle>
        </DialogHeader>
        {!cargado ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Cliente</Label>
              {cliente ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {cliente.nombre} {cliente.apellido} · {cliente.telefono || "sin teléfono"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setClienteId(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : nuevoCli ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Nombre *" value={nuevoCli.nombre} onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} />
                  <Input placeholder="Apellido" value={nuevoCli.apellido} onChange={(e) => setNuevoCli({ ...nuevoCli, apellido: e.target.value })} />
                  <Input placeholder="Teléfono" value={nuevoCli.telefono} onChange={(e) => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} />
                  <div className="flex gap-2 sm:col-span-3">
                    <Button size="sm" onClick={() => void guardarCliente()}>Guardar cliente</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNuevoCli(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input placeholder="Buscar por nombre, apellido o teléfono" value={buscarCli} onChange={(e) => setBuscarCli(e.target.value)} />
                    <Button variant="outline" onClick={() => setNuevoCli({ nombre: buscarCli, apellido: "", telefono: "" })}>
                      Nuevo cliente
                    </Button>
                  </div>
                  {clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      className="block w-full rounded-md border px-3 py-1.5 text-left text-sm hover:border-primary"
                      onClick={() => {
                        setClienteId(c.id);
                        if (!telefono) setTelefono(c.telefono);
                      }}
                    >
                      {c.nombre} {c.apellido} · {c.telefono}
                    </button>
                  ))}
                </>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Teléfono de contacto</Label>
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Retiro previsto</Label>
                  <Input type="datetime-local" value={retiro} onChange={(e) => setRetiro(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Ítems */}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Productos y servicios</Label>
              <Input placeholder="Buscar producto o servicio..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              {resultados.map((r) => (
                <button
                  key={`${r.tipo}${r.id}`}
                  className="flex w-full justify-between rounded-md border px-3 py-1.5 text-left text-sm hover:border-primary"
                  onClick={() => agregar(r)}
                >
                  <span>{r.nombre}</span>
                  <span className="text-muted-foreground">
                    {money(r.precio)} · {r.extra}
                  </span>
                </button>
              ))}
              {items.map((i) => (
                <div key={i.key} className="grid grid-cols-[1fr_80px_110px_100px_32px] items-center gap-2">
                  <span className="text-sm">{i.descripcion}</span>
                  <Input
                    type="number"
                    min="1"
                    aria-label="Cantidad"
                    value={i.cantidad}
                    onChange={(e) => setItems((p) => p.map((x) => (x.key === i.key ? { ...x, cantidad: Number(e.target.value) } : x)))}
                  />
                  <Input
                    type="number"
                    min="0"
                    aria-label="Precio unitario"
                    value={i.precio_unitario}
                    onChange={(e) =>
                      setItems((p) => p.map((x) => (x.key === i.key ? { ...x, precio_unitario: Number(e.target.value) } : x)))
                    }
                  />
                  <span className="text-right text-sm tabular">{money(i.cantidad * i.precio_unitario)}</span>
                  <button aria-label="Quitar" onClick={() => setItems((p) => p.filter((x) => x.key !== i.key))}>
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular">{money(total)}</span>
              </div>
            </div>

            {id === null && (
              <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Seña o pago anticipado (opcional)</Label>
                  <Input type="number" min="0" value={sena} onChange={(e) => setSena(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Método de pago</Label>
                  <Select value={metodoSena} onValueChange={setMetodoSena}>
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
                </div>
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Saldo pendiente: <b className="tabular">{money(saldoEncargo(total, Number(sena) || 0))}</b>
                </p>
              </div>
            )}

            <Textarea placeholder="Observaciones" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose()}>Cerrar</Button>
          <Button disabled={guardando || !cargado} onClick={() => void guardar()}>
            {guardando ? "Guardando..." : "Guardar encargo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- Detalle ---------------- */

function DetalleEncargo({ id, onClose, onEditar }: { id: string; onClose: () => void; onEditar: () => void }) {
  const qc = useQueryClient();
  const [pago, setPago] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [metodoSaldo, setMetodoSaldo] = useState("efectivo");
  const [modo, setModo] = useState<"ver" | "retiro" | "cancelar">("ver");
  const [motivo, setMotivo] = useState("");
  const [devolver, setDevolver] = useState<"no" | "si">("no");
  const [ocupado, setOcupado] = useState(false);

  const dQ = useQuery({
    queryKey: ["encargo", id],
    queryFn: async () => {
      const [e, it, pg, hi] = await Promise.all([
        supabase.from("encargos").select("*, clientes(nombre,apellido,telefono)").eq("id", id).single(),
        supabase.from("encargo_items").select("*").eq("encargo_id", id),
        supabase.from("encargo_pagos").select("*").eq("encargo_id", id).order("fecha"),
        supabase.from("encargo_historial").select("*").eq("encargo_id", id).order("fecha"),
      ]);
      if (e.error) throw e.error;
      return { e: e.data as unknown as Encargo, items: it.data ?? [], pagos: pg.data ?? [], hist: hi.data ?? [] };
    },
  });

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    if (ocupado) return;
    setOcupado(true);
    const { error } = await fn();
    setOcupado(false);
    if (error) return toast.error(errMsg(error));
    toast.success(ok);
    setModo("ver");
    setPago("");
    void qc.invalidateQueries();
  };

  if (!dQ.data)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        </DialogContent>
      </Dialog>
    );

  const { e, items, pagos, hist } = dQ.data;
  const saldo = saldoEncargo(e.total, e.pagado);
  const activo = editable(e.estado);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Encargo {e.numero} <EstadoBadge e={e.estado} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p>Cliente: <b>{e.clientes ? `${e.clientes.nombre} ${e.clientes.apellido}` : "-"}</b></p>
          <p>Teléfono: {e.telefono || e.clientes?.telefono || "-"}</p>
          <p>Creado: {fechaHora(e.created_at)}</p>
          <p>Retiro previsto: {fechaHora(e.fecha_retiro)}</p>
          {e.entregado_at && <p>Entregado: {fechaHora(e.entregado_at)}</p>}
          {e.observaciones && <p className="sm:col-span-2">Observaciones: {e.observaciones}</p>}
          {e.motivo_cancelacion && <p className="text-destructive sm:col-span-2">{e.motivo_cancelacion}</p>}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ítem</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.descripcion}</TableCell>
                <TableCell className="text-right tabular">{Number(i.cantidad)}</TableCell>
                <TableCell className="text-right tabular">{money(i.precio_unitario)}</TableCell>
                <TableCell className="text-right tabular">{money(i.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
          <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold tabular">{money(e.total)}</p></div>
          <div><p className="text-xs text-muted-foreground">Pagado</p><p className="font-semibold tabular">{money(e.pagado)}</p></div>
          <div><p className="text-xs text-muted-foreground">Saldo</p><p className="font-semibold tabular">{money(e.estado === "finalizado" ? 0 : saldo)}</p></div>
        </div>

        {pagos.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 font-medium">Pagos</p>
            {pagos.map((p) => (
              <p key={p.id} className="text-muted-foreground">
                {fechaHora(p.fecha)} · {money(p.importe)} · {labelMetodo(p.metodo_pago)}
              </p>
            ))}
          </div>
        )}

        {activo && modo === "ver" && (
          <div className="space-y-3 border-t pt-3">
            {saldo > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Registrar seña / pago</Label>
                  <Input type="number" min="0" className="w-36" value={pago} onChange={(x) => setPago(x.target.value)} />
                </div>
                <Select value={metodo} onValueChange={setMetodo}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={ocupado || !(Number(pago) > 0)}
                  onClick={() => {
                    if (Number(pago) > saldo) return toast.error(`El pago supera el saldo pendiente (${money(saldo)})`);
                    void run(() => supabase.rpc("registrar_pago_encargo", { p_id: id, p_importe: Number(pago), p_metodo: metodo as never }), "Pago registrado");
                  }}
                >
                  Registrar pago
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {e.estado !== "en_proceso" && (
                <Button variant="outline" size="sm" disabled={ocupado}
                  onClick={() => void run(() => supabase.rpc("cambiar_estado_encargo", { p_id: id, p_estado: "en_proceso" }), "Estado: En proceso")}>
                  Pasar a En proceso
                </Button>
              )}
              {e.estado !== "listo" && (
                <Button variant="outline" size="sm" disabled={ocupado}
                  onClick={() => void run(() => supabase.rpc("cambiar_estado_encargo", { p_id: id, p_estado: "listo" }), "Estado: Listo para retirar")}>
                  Marcar listo para retirar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onEditar}>Modificar</Button>
              <Button size="sm" onClick={() => setModo("retiro")}>Registrar retiro</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setModo("cancelar")}>Cancelar encargo</Button>
            </div>
          </div>
        )}

        {modo === "retiro" && (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">Confirmar retiro</p>
            <p>Total del encargo: <b>{money(e.total)}</b></p>
            <p>Pagos anticipados: <b>{money(e.pagado)}</b></p>
            <p>Saldo pendiente / a cobrar ahora: <b>{money(saldo)}</b></p>
            {saldo > 0 && (
              <Select value={metodoSaldo} onValueChange={setMetodoSaldo}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button disabled={ocupado}
                onClick={() => void run(() => supabase.rpc("finalizar_encargo", { p_id: id, p_metodo: (saldo > 0 ? metodoSaldo : null) as never }), "Encargo entregado y venta registrada")}>
                {ocupado ? "Registrando..." : saldo > 0 ? `Cobrar ${money(saldo)} y finalizar` : "Finalizar sin cobrar"}
              </Button>
              <Button variant="ghost" onClick={() => setModo("ver")}>Volver</Button>
            </div>
          </div>
        )}

        {modo === "cancelar" && (
          <div className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
            <p className="font-medium">Cancelar encargo</p>
            <Textarea placeholder="Motivo (obligatorio)" rows={2} value={motivo} onChange={(x) => setMotivo(x.target.value)} />
            {Number(e.pagado) > 0 && (
              <div className="space-y-1">
                <p>Este encargo tiene pagos por <b>{money(e.pagado)}</b>. ¿Qué se hace con ese importe?</p>
                <Select value={devolver} onValueChange={(v) => setDevolver(v as "no" | "si")}>
                  <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Se devolvió al cliente ahora (sale de caja)</SelectItem>
                    <SelectItem value="no">Queda pendiente de resolver (no se devuelve ahora)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="destructive" disabled={ocupado || !motivo.trim()}
                onClick={() => void run(() => supabase.rpc("cancelar_encargo", { p_id: id, p_motivo: motivo, p_devolver: devolver === "si", p_metodo: "efectivo" }), "Encargo cancelado")}>
                Confirmar cancelación
              </Button>
              <Button variant="ghost" onClick={() => setModo("ver")}>Volver</Button>
            </div>
          </div>
        )}

        <div className="border-t pt-3 text-sm">
          <p className="mb-1 font-medium">Historial</p>
          {hist.map((h) => (
            <p key={h.id} className="text-muted-foreground">
              {fechaHora(h.fecha)} · {h.accion}{h.detalle ? ` — ${h.detalle}` : ""}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
