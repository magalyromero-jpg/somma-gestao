import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AreaCliente from "@/pages/AreaCliente";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Operacional from "./pages/Operacional";
import OperacionalDetalhe from "./pages/OperacionalDetalhe";
import ZenTower from "./pages/admin/ZenTower";
import SyncBitrix from "./pages/SyncBitrix";
import Mercado from "./pages/Mercado";
import PesquisaMercado from "./pages/PesquisaMercado";
import PesquisaMercadoResultado from "./pages/PesquisaMercadoResultado";
import Atualizacoes from "./pages/Atualizacoes";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/configuracoes/Usuarios";
import NotFound from "./pages/NotFound";
import AnaliseLeilao from "./pages/AnaliseLeilao";
import AnaliseLeilaoForm from "./pages/AnaliseLeilaoForm";
import ForgotPassword from "./pages/auth/ForgotPassword";
import SetPassword from "./pages/auth/SetPassword";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<SetPassword mode="reset" />} />
            <Route path="/auth/set-password" element={<SetPassword mode="set" />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<ProtectedRoute requireRole={["admin", "gestor"]}><Dashboard /></ProtectedRoute>} />
              <Route path="/familias" element={<Navigate to="/" replace />} />
              <Route path="/operacional" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><Operacional /></ProtectedRoute>} />
              <Route path="/operacional/principais" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><Navigate to="/operacional" replace /></ProtectedRoute>} />
              <Route path="/operacional/:taskId" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><OperacionalDetalhe /></ProtectedRoute>} />
              <Route path="/sync-bitrix" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><SyncBitrix /></ProtectedRoute>} />
              <Route path="/imoveis" element={<Navigate to="/" replace />} />
              <Route path="/imoveis/cliente/:id" element={<Navigate to="/" replace />} />
              <Route path="/admin/zen-tower" element={<ProtectedRoute requireRole={["admin", "gestor"]}><ZenTower /></ProtectedRoute>} />
              <Route path="/area-cliente" element={<ProtectedRoute requireRole="familia"><AreaCliente /></ProtectedRoute>} />
              <Route path="/mercado" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><Mercado /></ProtectedRoute>} />
              <Route path="/pesquisa-mercado" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><PesquisaMercado /></ProtectedRoute>} />
              <Route path="/pesquisa-mercado/resultado/:id" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><PesquisaMercadoResultado /></ProtectedRoute>} />
              <Route path="/analise-leilao" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><AnaliseLeilaoForm /></ProtectedRoute>} />
              <Route path="/analise-leilao/resultado" element={<ProtectedRoute requireRole={["admin", "gestor", "analista"]}><AnaliseLeilao /></ProtectedRoute>} />

              {/* Onboarding */}
              <Route path="/onboarding" element={<Navigate to="/" replace />} />
              <Route path="/onboarding/novo" element={<Navigate to="/" replace />} />
              <Route path="/onboarding/novo/:familiaId" element={<Navigate to="/" replace />} />
              <Route path="/onboarding/workspace/:id" element={<Navigate to="/" replace />} />

              <Route path="/familias-onboarding/:id" element={<Navigate to="/" replace />} />
              <Route path="/atualizacoes" element={<ProtectedRoute requireRole={["admin", "gestor"]}><Atualizacoes /></ProtectedRoute>} />
              <Route path="/configuracoes/usuarios" element={<ProtectedRoute requireRole="admin"><Usuarios /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute requireRole={["admin", "gestor"]}><Configuracoes /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
