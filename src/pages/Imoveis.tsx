import { PageHeader } from "@/components/PageHeader";
import ImoveisCliente from "./ImoveisCliente";

export default function Imoveis() {
  return (
    <>
      <PageHeader title="Imóveis" subtitle="Imóveis dos clientes (onboarding)" />
      <ImoveisCliente />
    </>
  );
}
