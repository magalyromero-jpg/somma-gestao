import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoricoAtividades } from "./configuracoes/HistoricoAtividades";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import IntegracaoBitrix from "./configuracoes/IntegracaoBitrix";

export default function Configuracoes() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <>
      <PageHeader title="Configurações" subtitle="Histórico de atividades, usuários e integrações" />

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico de Atividades</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          {isAdmin && <TabsTrigger value="integracoes">Integrações</TabsTrigger>}
        </TabsList>

        <TabsContent value="historico" className="mt-4">
          <HistoricoAtividades />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">Gerenciar usuários</div>
                  <div className="text-sm text-muted-foreground">
                    Convide, edite permissões e acompanhe os acessos da equipe.
                  </div>
                </div>
                <Link
                  to="/configuracoes/usuarios"
                  className="text-sm font-medium text-gold hover:underline"
                >
                  Abrir →
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="integracoes" className="mt-4 space-y-6">
            <IntegracaoBitrix />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
