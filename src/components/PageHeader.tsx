import { ReactNode } from "react";

export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
