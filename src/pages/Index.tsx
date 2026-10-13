import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEdificios } from "@/hooks/useEdificios";
import { rotaInicial } from "@/lib/perfis";

const Index = () => {
  const { role } = useAuth();
  const { data = [], isLoading } = useEdificios();
  if (role === "familia" && isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return <Navigate to={rotaInicial(role, data)} replace />;
};
export default Index;
