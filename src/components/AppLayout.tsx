import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Copy,
  ClipboardList,
  Package,
  Boxes,
  RefreshCw,
  Truck,
  Building2,
  Wallet,
  BarChart3,
  Users,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/panel", label: "Dashboard", icon: LayoutDashboard },
  { to: "/venta", label: "Nueva venta", icon: ShoppingCart },
  { to: "/ventas", label: "Ventas", icon: Receipt },
  { to: "/fotocopias", label: "Fotocopias", icon: Copy },
  { to: "/encargos", label: "Encargos", icon: ClipboardList },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/reposicion", label: "Reposición", icon: RefreshCw },
  { to: "/compras", label: "Compras", icon: Truck, adminOnly: true },
  { to: "/proveedores", label: "Proveedores", icon: Building2, adminOnly: true },
  { to: "/caja", label: "Caja", icon: Wallet },
  { to: "/reportes", label: "Reportes", icon: BarChart3, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { to: "/auditoria", label: "Auditoría", icon: ScrollText, adminOnly: true },
  { to: "/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { perfil, rol, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {items.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const aside = (
    <div className="flex h-full w-64 flex-col bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-4">
        <div>
          <p className="font-display text-base font-semibold text-sidebar-foreground">Librería</p>
          <p className="text-xs text-sidebar-foreground/60">Sistema de gestión</p>
        </div>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
          <X className="size-5 text-sidebar-foreground" />
        </button>
      </div>
      {nav}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() || perfil.email : "Usuario"}
          </p>
          <p className="text-xs capitalize text-sidebar-foreground/60">{rol ?? "-"}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => void signOut()}
        >
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen lg:block">{aside}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{aside}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold">Librería</span>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
