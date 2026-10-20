export type EstadoEncargo = "pendiente" | "en_proceso" | "listo" | "finalizado" | "cancelado";

export const ESTADOS_ENCARGO: { value: EstadoEncargo; label: string; className: string }[] = [
  { value: "pendiente", label: "Pendiente", className: "bg-muted text-foreground border-border" },
  { value: "en_proceso", label: "En proceso", className: "bg-info/10 text-info border-info/25" },
  { value: "listo", label: "Listo para retirar", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  { value: "finalizado", label: "Finalizado / Retirado", className: "bg-success/10 text-success border-success/25" },
  { value: "cancelado", label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
];

export const estadoInfo = (e: string) => ESTADOS_ENCARGO.find((x) => x.value === e) ?? ESTADOS_ENCARGO[0];

export const editable = (e: string) => e === "pendiente" || e === "en_proceso" || e === "listo";

/** Saldo pendiente = total − pagos registrados (nunca negativo). */
export const saldoEncargo = (total: number | string, pagado: number | string) =>
  Math.max(0, Number(total) - Number(pagado));
