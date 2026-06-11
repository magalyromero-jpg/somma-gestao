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
          <TabsContent value="integracoes" className="mt-4">
            <IntegracaoBitrix />
          </TabsContent>
        )}
      </Tabs>

      {isAdmin && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-medium">Integrações externas</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Perpétuo
                  <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                    <Clock className="w-3 h-3 mr-1" /> Aguardando TI
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Base oficial de ativos, famílias e dados cadastrais. Depende da migração Lidderar → Perpétuo e liberação de chaves pela TI.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Pendente: conclusão da migração Lidderar → Perpétuo (Bloco 1) e disponibilização das chaves de API (Bloco 3).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Lidderar
                  <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                    <Clock className="w-3 h-3 mr-1" /> Aguardando migração
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Base de terrenos e oportunidades imobiliárias. Será migrada para o Perpétuo como base oficial.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Pendente: migração dos dados da Lidderar para o Perpétuo (Bloco 1).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
