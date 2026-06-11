import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Familias from "./pages/Familias";
import OperacionalBitrix from "./pages/OperacionalBitrix";
import Imoveis from "./pages/Imoveis";
import ImovelClienteDetalhe from "./pages/ImovelClienteDetalhe";
import Mercado from "./pages/Mercado";
import PesquisaMercado from "./pages/PesquisaMercado";
import PesquisaMercadoResultado from "./pages/PesquisaMercadoResultado";
import Atualizacoes from "./pages/Atualizacoes";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/configuracoes/Usuarios";

import NotFound from "./pages/NotFound";
import AnaliseLeilao from "./pages/AnaliseLeilao";
import AnaliseLeilaoForm from "./pages/AnaliseLeilaoForm";
import OnboardingFamilia from "./pages/OnboardingFamilia";
import MapaFamilia from "./pages/MapaFamilia";
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
              <Route path="/familias" element={<Familias />} />
              <Route path="/operacional" element={<OperacionalBitrix />} />
              <Route path="/imoveis" element={<Imoveis />} />
              <Route path="/imoveis/cliente/:id" element={<ImovelClienteDetalhe />} />
              <Route path="/mercado" element={<Mercado />} />
              <Route path="/pesquisa-mercado" element={<PesquisaMercado />} />
              <Route path="/pesquisa-mercado/resultado/:id" element={<PesquisaMercadoResultado />} />
              <Route path="/analise-leilao" element={<AnaliseLeilaoForm />} />
              <Route path="/analise-leilao/resultado" element={<AnaliseLeilao />} />
              <Route path="/onboarding" element={<OnboardingFamilia />} />
              <Route path="/onboarding/:familiaId" element={<OnboardingFamilia />} />
              <Route path="/familias-onboarding/:id" element={<MapaFamilia />} />
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
