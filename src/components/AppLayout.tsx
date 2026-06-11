import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Building2, LineChart, Search, RefreshCw, Settings, LogOut, Gavel, UserPlus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import logoWhite from "@/assets/somma-logo-white.png";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Building2, LineChart, Search, RefreshCw, Settings, LogOut, Gavel, UserPlus, UserCog, ListTodo } from "lucide-react";


const nav: Array<{ to: string; label: string; icon: any; allowed?: AppRole[] }> = [
  { to: "/dashboard",            label: "Dashboard",           icon: LayoutDashboard, allowed: ["admin", "gestor"] },
  { to: "/familias",             label: "Famílias",            icon: Users },
  { to: "/imoveis",              label: "Imóveis",             icon: Building2 },
  { to: "/mercado",              label: "Mercado",             icon: LineChart },
  { to: "/pesquisa-mercado",     label: "Pesquisa de Mercado", icon: Search },
  { to: "/analise-leilao",       label: "Análise de Leilão",   icon: Gavel,           allowed: ["admin", "gestor"] },
  { to: "/onboarding",           label: "Onboarding",          icon: UserPlus },
  { to: "/atualizacoes",         label: "Atualizações",        icon: RefreshCw,       allowed: ["admin", "gestor"] },
  { to: "/configuracoes/usuarios", label: "Usuários",          icon: UserCog,         allowed: ["admin"] },
  
  { to: "/configuracoes",         label: "Configurações",     icon: Settings,        allowed: ["admin", "gestor"] },
];
{ to: "/operacional", label: "Operacional", icon: ListTodo, allowed: ["admin", "gestor", "analista"] },

export default function AppLayout() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initials =
    (profile?.nome ?? profile?.email ?? "U")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const items = nav.filter((n) => !n.allowed || (role && n.allowed.includes(role)));

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
          <img src={logoWhite} alt="Somma" className="h-9 w-auto brightness-0 invert" />
          <div className="min-w-0">
            <div className="text-sm font-light leading-tight text-white truncate">Somma MFO</div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-light text-white/60">
              Gestão de Ativos
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-light transition-colors",
                  "hover:bg-white/5",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/65",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-gold grid place-items-center text-[11px] font-medium text-gold-foreground shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-light text-white truncate">{profile?.nome ?? profile?.email ?? "Usuário"}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">{role ?? "—"}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-sidebar text-white">
          <div className="flex items-center gap-2">
            <img src={logoWhite} alt="Somma" className="h-7 brightness-0 invert" />
            <div className="font-light text-sm">Somma MFO</div>
          </div>
          <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-white/10" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
