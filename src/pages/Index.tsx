import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { role } = useAuth();
  if (role === "admin" || role === "gestor") return <Navigate to="/dashboard" replace />;
  if (role === "analista") return <Navigate to="/operacional" replace />;
  return <Navigate to="/mercado" replace />;
};
export default Index;
