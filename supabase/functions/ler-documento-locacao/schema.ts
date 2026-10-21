export const SCHEMA = {
  type: "object",
  properties: {
    tipo_documento: { type: "string", enum: ["contrato", "aditivo", "reajuste", "distrato", "outro"] },
    data_documento: { type: ["string", "null"], description: "AAAA-MM-DD" },
    locador: { type: ["string", "null"] },
    locatario: { type: ["string", "null"] },
    unidades_citadas: { type: "array", items: { type: "string" } },
    vigencias: {
      type: "array",
      description: "Cada período de vigência com valor próprio definido pelo documento",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          inicio: { type: ["string", "null"], description: "AAAA-MM-DD" },
          fim: { type: ["string", "null"], description: "AAAA-MM-DD" },
          valor_mensal: { type: ["number", "null"], description: "Reais, sem formatação" },
          degraus: {
            type: "array",
            description: "Mudanças de valor previstas dentro da vigência",
            items: {
              type: "object",
              properties: {
                a_partir: { type: "string", description: "AAAA-MM-DD" },
                valor_mensal: { type: "number" },
                motivo: { type: "string" },
              },
              required: ["a_partir", "valor_mensal"],
            },
          },
          indice: { type: ["string", "null"], enum: ["IPCA", "IGPM", "FIXO", "NENHUM", "MEDIA", null] },
          mes_reajuste: { type: ["integer", "null"], description: "1 a 12" },
        },
        required: ["descricao", "inicio", "fim", "valor_mensal"],
      },
    },
    reajustes: {
      type: "array",
      description: "Reajustes de valor formalizados pelo documento (apostilamento, carta ou termo de reajuste, ou reajuste previsto no aditivo)",
      items: {
        type: "object",
        properties: {
          data_efeito: { type: "string", description: "AAAA-MM-DD: data a partir da qual o novo valor vale (normalmente o aniversário do contrato)" },
          valor_mensal: { type: "number", description: "Novo valor mensal total, em reais" },
          indice: { type: ["string", "null"], enum: ["IPCA", "IGPM", "FIXO", "NENHUM", "MEDIA", null] },
          percentual: { type: ["number", "null"], description: "Percentual aplicado, se informado" },
        },
        required: ["data_efeito", "valor_mensal"],
      },
    },
    dia_vencimento: { type: ["integer", "null"] },
    retencao_pct: { type: ["number", "null"], description: "Percentual de retenção na fonte, ex.: 4.8" },
    descontos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao: { type: "string" },
          valor_mensal: { type: ["number", "null"] },
          inicio: { type: ["string", "null"] },
          fim: { type: ["string", "null"] },
        },
        required: ["descricao"],
      },
    },
    garagens: { type: ["string", "null"], description: "Resumo de vagas e valores, se houver" },
    observacoes: { type: "string" },
    trechos: {
      type: "array",
      description: "Citação literal curta de onde saiu cada dado importante",
      items: {
        type: "object",
        properties: { campo: { type: "string" }, citacao: { type: "string" } },
        required: ["campo", "citacao"],
      },
    },
    alertas: { type: "array", items: { type: "string" }, description: "Dúvidas, ilegibilidade, valores ambíguos" },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
  },
  required: ["tipo_documento", "vigencias", "confianca"],
};

export const INSTRUCOES = `Você lê contratos e aditivos de locação comercial brasileiros e registra os dados para um portal de gestão.
Regras:
- Extraia somente o que está escrito no documento. Nunca invente nem calcule o que o documento não diz.
- Se o documento só prevê reajuste futuro sem informar o novo valor, não calcule o valor: registre o índice e o mês de reajuste e coloque um alerta.
- Datas no formato AAAA-MM-DD. Valores em reais como número (39400.5), sem símbolo e sem separador de milhar.
- Um aditivo que apenas prorroga ou altera valor gera uma vigência com o valor mensal resultante. Se o valor muda ao longo do período (por exemplo, "R$ 39.400,00 até set/2027 e R$ 44.800,00 a partir de out/2027"), use um degrau em "degraus" para cada mudança.
- Se o valor for acréscimo (por exemplo, "acrescenta R$ 3.510,00"), informe no alerta e use o valor mensal total resultante, quando o documento o disser.
- Se o documento formaliza um reajuste (apostilamento, carta ou termo de reajuste), registre-o em "reajustes" com a data de efeito e o novo valor mensal total, e deixe "vigencias" vazio, a menos que o documento também altere prazo ou condições.
- Cite em "trechos" uma frase literal curta para o valor, as datas, o índice e a retenção.
- Se o texto estiver ilegível ou assinado por cima de valores, diga em "alertas" e reduza a "confianca".
Chame a ferramenta registrar_leitura com o resultado.`;

