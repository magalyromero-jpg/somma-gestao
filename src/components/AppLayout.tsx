import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ListTodo, LineChart, Search, RefreshCw, Settings, LogOut, Gavel, UserCog, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import logoAsset from "@/assets/somma-logo-branco.png.asset.json";
const logoWhite = logoAsset.url;
import { Button } from "@/components/ui/button";

const nav: Array<{ to: string; label: string; icon: any; allowed?: AppRole[]; grupo?: string }> = [
  { to: "/dashboard",            label: "Dashboard",           icon: LayoutDashboard, allowed: ["admin", "gestor"], grupo: "Visão geral" },
  { to: "/operacional",          label: "Operacional",         icon: ListTodo,          allowed: ["admin", "gestor", "analista"], grupo: "Visão geral" },


  { to: "/admin/zen-tower",      label: "Zen Tower",           icon: Landmark,        allowed: ["admin", "gestor"], grupo: "Carteira" },
  { to: "/mercado",              label: "Mercado",             icon: LineChart, allowed: ["admin", "gestor", "analista"], grupo: "Inteligência de mercado" },
  { to: "/pesquisa-mercado",     label: "Pesquisa de Mercado", icon: Search, allowed: ["admin", "gestor", "analista"], grupo: "Inteligência de mercado" },
  { to: "/analise-leilao",       label: "Análise de Leilão",   icon: Gavel,           allowed: ["admin", "gestor"], grupo: "Inteligência de mercado" },

  { to: "/area-cliente",         label: "Área do Cliente",     icon: Landmark,        allowed: ["familia"] },
  { to: "/atualizacoes",         label: "Atualizações",        icon: RefreshCw,       allowed: ["admin", "gestor"], grupo: "Administração" },
  { to: "/configuracoes/usuarios", label: "Usuários",          icon: UserCog,         allowed: ["admin"], grupo: "Administração" },
  
  { to: "/configuracoes",         label: "Configurações",     icon: Settings,        allowed: ["admin", "gestor"], grupo: "Administração" },
];

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
    <div className="portal-shell flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-7">
          <img src={logoWhite} alt="Somma Multi-Family Office" className="h-9 w-auto" />
          <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
            Gestão de Ativos
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {items.map((item, index) => (
            <div key={item.to}>
            {item.grupo && item.grupo !== items[index - 1]?.grupo && <div className="px-6 pb-2 pt-5 text-[10px] uppercase tracking-wider text-sidebar-foreground/55">{item.grupo}</div>}
            <NavLink
              to={item.to}
              end={item.to === "/configuracoes"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 border-l-[3px] px-6 py-3 text-[13px] font-light transition-colors",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "border-gold bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "border-transparent text-sidebar-foreground/75",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  
                </>
              )}
            </NavLink>
            </div>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-gold grid place-items-center text-[11px] font-medium text-gold-foreground shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-light text-sidebar-foreground truncate">{profile?.nome ?? profile?.email ?? "Usuário"}</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{role ?? "—"}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <img src={logoWhite} alt="Somma" className="h-7 brightness-0 invert" />
            <div className="font-light text-sm">Somma MFO</div>
          </div>
          <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <div className="portal-content animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
