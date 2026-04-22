import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Familias from "./pages/Familias";
import FamiliaDetalhe from "./pages/FamiliaDetalhe";
import Imoveis from "./pages/Imoveis";
import ImovelDetalhe from "./pages/ImovelDetalhe";
import EmBreve from "./pages/EmBreve";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/familias" element={<Familias />} />
            <Route path="/familias/:id" element={<FamiliaDetalhe />} />
            <Route path="/imoveis" element={<Imoveis />} />
            <Route path="/imoveis/:codImovel" element={<ImovelDetalhe />} />
            <Route
              path="/mercado"
              element={<EmBreve titulo="Mercado" subtitulo="FipeZAP, pesquisas e benchmarks" />}
            />
            <Route
              path="/atualizacoes"
              element={<EmBreve titulo="Atualizações" subtitulo="Edição em lote dos valores de mercado" />}
            />
            <Route
              path="/configuracoes"
              element={<EmBreve titulo="Configurações" subtitulo="Token Lidderar, usuários e permissões" />}
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
