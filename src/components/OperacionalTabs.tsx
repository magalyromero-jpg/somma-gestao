import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/operacional", label: "Por cliente" },
  { to: "/operacional/principais", label: "Por tarefa principal" },
];

export const OperacionalTabs = () => (
  <div className="mb-5 inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
    {TABS.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        end
        className={({ isActive }) =>
          cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )
        }
      >
        {t.label}
      </NavLink>
    ))}
  </div>
);
