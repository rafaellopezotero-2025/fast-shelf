import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { money, num, labelMetodo, isoDay } from "@/lib/format";
import { calcularRango, RANGOS, type RangoKey } from "@/lib/rango";
import { estadoStock } from "@/lib/stock";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gestión de Librería" },
      { name: "description", content: "Resumen de ventas, ingresos, fotocopias y alertas de stock." },
      { property: "og:title", content: "Dashboard — Gestión de Librería" },
      { property: "og:description", content: "Resumen de ventas, ingresos, fotocopias y alertas de stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});

type DetalleRow = {
  cantidad: number;
  subtotal: number;
  descripcion: string;
  producto_id: string | null;
  servicio_id: string | null;
  ventas: { fecha: string; estado: string; metodo_pago: string } | null;
  categorias: { nombre: string } | null;
  servicios: { clase: string } | null;
};

function Panel() {
  const [rango, setRango] = useState<RangoKey>("30dias");
  const [desdeStr, setDesdeStr] = useState(isoDay(new Date()));
  const [hastaStr, setHastaStr] = useState(isoDay(new Date()));
  const { desde, hasta } = calcularRango(rango, desdeStr, hastaStr);

  const ventasQ = useQuery({
    queryKey: ["panel-ventas", desde.toISOString(), hasta.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("id,numero,fecha,total,metodo_pago,estado")
        .gte("fecha", desde.toISOString())
        .lte("fecha", hasta.toISOString())
        .eq("estado", "confirmada")
        .order("fecha");
      if (error) throw error;
      return data;
    },
  });

  const detallesQ = useQuery({
    queryKey: ["panel-detalles", desde.toISOString(), hasta.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("detalle_ventas")
        .select(
          "cantidad,subtotal,descripcion,producto_id,servicio_id,ventas!inner(fecha,estado,metodo_pago),categorias(nombre),servicios(clase)",
        )
        .gte("ventas.fecha", desde.toISOString())
        .lte("ventas.fecha", hasta.toISOString())
        .eq("ventas.estado", "confirmada");
      if (error) throw error;
      return data as unknown as DetalleRow[];
    },
  });

  const productosQ = useQuery({
    queryKey: ["panel-productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id,nombre,stock_actual,stock_minimo,punto_reposicion,stock_objetivo,activo")
        .eq("activo", true);
      if (error) throw error;
      return data;
    },
  });

  const ventas = ventasQ.data ?? [];
  const detalles = detallesQ.data ?? [];
  const productos = productosQ.data ?? [];

  const hoyKey = new Date().toDateString();
  const mesActual = new Date().getMonth();
  const anioActual = new Date().getFullYear();

  const totalRango = ventas.reduce((a, v) => a + Number(v.total), 0);
  const ventasHoy = ventas.filter((v) => new Date(v.fecha).toDateString() === hoyKey);
  const ventasMes = ventas.filter(
    (v) => new Date(v.fecha).getMonth() === mesActual && new Date(v.fecha).getFullYear() === anioActual,
  );

  const fotocopias = detalles.filter((d) => d.servicios?.clase === "fotocopia");
  const totalFotocopias = fotocopias.reduce((a, d) => a + Number(d.cantidad), 0);

  const sinStock = productos.filter((p) => estadoStock(p) === "sin_stock").length;
  const criticos = productos.filter((p) => estadoStock(p) === "critico").length;
  const reponer = productos.filter((p) => estadoStock(p) === "reponer").length;

  const porDia = Object.values(
    ventas.reduce<Record<string, { dia: string; total: number; ventas: number }>>((acc, v) => {
      const k = isoDay(new Date(v.fecha));
      acc[k] ??= { dia: k.slice(5), total: 0, ventas: 0 };
      acc[k]!.total += Number(v.total);
      acc[k]!.ventas += 1;
      return acc;
    }, {}),
  );

  const fotocopiasPorDia = Object.values(
    fotocopias.reduce<Record<string, { dia: string; cantidad: number }>>((acc, d) => {
      const k = isoDay(new Date(d.ventas!.fecha));
      acc[k] ??= { dia: k.slice(5), cantidad: 0 };
      acc[k]!.cantidad += Number(d.cantidad);
      return acc;
    }, {}),
  );

  const porCategoria = Object.values(
    detalles.reduce<Record<string, { nombre: string; total: number }>>((acc, d) => {
      const k = d.categorias?.nombre ?? (d.servicio_id ? "Servicios" : "Sin categoría");
      acc[k] ??= { nombre: k, total: 0 };
      acc[k]!.total += Number(d.subtotal);
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  const topProductos = Object.values(
    detalles
      .filter((d) => d.producto_id)
      .reduce<Record<string, { nombre: string; cantidad: number; total: number }>>((acc, d) => {
        acc[d.descripcion] ??= { nombre: d.descripcion, cantidad: 0, total: 0 };
        acc[d.descripcion]!.cantidad += Number(d.cantidad);
        acc[d.descripcion]!.total += Number(d.subtotal);
        return acc;
      }, {}),
  )
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 8);

  const porMetodo = Object.values(
    ventas.reduce<Record<string, { nombre: string; total: number }>>((acc, v) => {
      const k = labelMetodo(v.metodo_pago);
      acc[k] ??= { nombre: k, total: 0 };
      acc[k]!.total += Number(v.total);
      return acc;
    }, {}),
  );

  const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen del negocio en el período seleccionado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={rango} onValueChange={(v) => setRango(v as RangoKey)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rango === "personalizado" && (
              <>
                <Input type="date" value={desdeStr} onChange={(e) => setDesdeStr(e.target.value)} className="w-40" />
                <Input type="date" value={hastaStr} onChange={(e) => setHastaStr(e.target.value)} className="w-40" />
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ventas del día" value={money(ventasHoy.reduce((a, v) => a + Number(v.total), 0))} hint={`${ventasHoy.length} operaciones`} />
        <StatCard label="Ventas del mes" value={money(ventasMes.reduce((a, v) => a + Number(v.total), 0))} hint={`${ventasMes.length} operaciones`} />
        <StatCard label="Total del período" value={money(totalRango)} hint={`${ventas.length} operaciones`} tone="info" />
        <StatCard label="Fotocopias del período" value={num(totalFotocopias)} hint="copias registradas" />
        <StatCard label="Sin stock" value={num(sinStock)} tone="danger" hint="productos agotados" />
        <StatCard label="Stock crítico" value={num(criticos)} tone="warning" hint="por debajo del mínimo" />
        <StatCard label="En punto de reposición" value={num(reponer)} tone="info" hint="conviene reponer" />
        <StatCard
          label="Ticket promedio"
          value={money(ventas.length ? totalRango / ventas.length : 0)}
          hint="por operación"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por día</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dia" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="total" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por categoría</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="nombre" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="nombre" width={140} fontSize={11} />
                <Tooltip formatter={(v: number) => num(v)} />
                <Bar dataKey="cantidad" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fotocopias por día</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fotocopiasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dia" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => num(v)} />
                <Bar dataKey="cantidad" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ventas por método de pago</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porMetodo} dataKey="total" nameKey="nombre" outerRadius={90} label>
                  {porMetodo.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
