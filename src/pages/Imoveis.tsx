import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ImoveisCliente from "./ImoveisCliente";
import ImoveisLidderar from "./ImoveisLidderar";

export default function Imoveis() {
  const [tab, setTab] = useState("clientes");
  return (
    <>
      <PageHeader
        title="Imóveis"
        subtitle="Imóveis dos clientes (onboarding) e portfólio sincronizado do Lidderar"
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="clientes">Imóveis dos clientes</TabsTrigger>
          <TabsTrigger value="lidderar">Lidderar (sincronizados)</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-0">
          <ImoveisCliente />
        </TabsContent>
        <TabsContent value="lidderar" className="mt-0">
          <ImoveisLidderar />
        </TabsContent>
      </Tabs>
    </>
  );
}
