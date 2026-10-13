import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEdificios } from "@/hooks/useEdificios";
import { PortalEdificio } from "@/pages/admin/ZenTower";
import { PageHeader } from "@/components/PageHeader";
import { modoPortal } from "@/lib/perfis";

export default function Carteira() {
  const { slug } = useParams();
  const { role } = useAuth();
  const { data = [], isLoading } = useEdificios();

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data.length) return (
    <div className="space-y-2">
      <PageHeader title="Carteira" />
      <p className="text-sm text-muted-foreground">Seu acesso ainda não foi liberado. Fale com a equipe Somma.</p>
    </div>
  );
  const ed = data.find((e) => e.slug === slug);
  if (!ed) return <Navigate to={`/carteira/${data[0].slug}`} replace />;
  return <PortalEdificio key={ed.id} edificioId={ed.id} modo={modoPortal(role)} />;
}
