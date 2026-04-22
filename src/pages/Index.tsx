import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { role } = useAuth();
  return <Navigate to={role === "gestor" ? "/dashboard" : "/familias"} replace />;
};
export default Index;
