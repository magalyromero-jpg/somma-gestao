import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, Building2, LineChart, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, gestor: true },
  { to: "/familias", label: "Famílias", icon: Users, gestor: false },
  { to: "/imoveis", label: "Imóveis", icon: Building2, gestor: false },
  { to: "/mercado", label: "Mercado", icon: LineChart, gestor: false },
  { to: "/atualizacoes", label: "Atualizações", icon: RefreshCw, gestor: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, gestor: true },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-md bg-gradient-gold grid place-items-center font-bold text-sidebar-primary-foreground">
            S
          </div>
          <div>
            <div className="text-base font-semibold leading-tight text-white">Somma MFO</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/70">
              Gestão de Ativos
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-white border-l-2 border-sidebar-primary -ml-[2px] pl-[14px]"
                    : "text-sidebar-foreground/85",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          v1.0 · Mock data
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar text-white">
          <div className="h-8 w-8 rounded-md bg-gradient-gold grid place-items-center font-bold text-sidebar-primary-foreground">
            S
          </div>
          <div className="font-semibold">Somma MFO</div>
        </header>
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
