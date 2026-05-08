import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em análise patrimonial e estruturação de holdings no Brasil.
Sua função é extrair e estruturar informações de documentos fiscais e jurídicos
(Declaração de Imposto de Renda, contratos sociais, matrículas de imóveis, fichas
cadastrais) para compor o mapa patrimonial de uma família cliente.

REGRAS GERAIS:
- Responda chamando a ferramenta registrar_patrimonio com JSON válido conforme o schema.
- Nunca invente dados. Se uma informação não estiver no documento, use null.
- O campo "fonte" em cada objeto deve indicar de qual documento o dado foi extraído.
  Ex: "IRPF 2025 - Bruno Roquete Tavares", "Contrato Social B&E Safe Ltda"

MEMBROS DA FAMÍLIA:
- Identifique todos os membros mencionados nos documentos.
- Classifique cada um pelo papel real no ecossistema:
  "titular" → declarante principal do IR ou titular da ficha cadastral
  "conjuge" → cônjuge ou companheiro(a)
  "filho" → filho(a) declarado como dependente
  "dependente" → outro dependente que não filho
  "socio_familiar" → familiar que aparece como sócio em empresas
  "socio_externo" → sócio sem relação familiar identificada
- O campo "is_assinante: true" deve ser marcado apenas para titular e cônjuge.

HOLDINGS E PARTICIPAÇÕES SOCIETÁRIAS:
- Classifique cada holding pelo tipo:
  "patrimonial" → detém imóveis ou ativos patrimoniais
  "operacional" → atividade-fim (praticagem, indústria, serviços)
  "rural" → atividade rural ou agropecuária
  "holding_pura" → sem imóveis próprios, apenas participa de outras empresas
  "nova" → constituída no ano-calendário do IR analisado
  "encerrada" → participação zerada em 31/12 do ano analisado
  "outra" → não se encaixa
- Holdings "encerradas" NÃO devem ser contabilizadas no total de "ativas".
- Registre número de quotas, valor por quota e percentual quando disponível.

IMÓVEIS — REGRAS CRÍTICAS:
- Para cada imóvel, extraia SEMPRE: endereço completo, valor declarado, área m²,
  matrícula, cartório, data de aquisição, titularidade (PF ou PJ) e qual PJ se aplicável.
- Identifique a forma de aquisição: compra, permuta, integralizacao, heranca, doacao, outra.
- BENFEITORIAS NÃO SÃO IMÓVEIS: itens declarados como "benfeitoria" no IR
  (tipicamente grupo 99, código 99, com descrição contendo "benfeitoria") devem ser
  registrados no campo "benfeitorias" do imóvel ao qual pertencem — NUNCA como
  imóvel independente. Se não for possível identificar o imóvel vinculado, registre
  a benfeitoria em "alertas_gerais" com nível "atencao".
- Se um imóvel constar na PF mas houver menção de integralização em PJ no mesmo
  documento, registre titularidade como "PF" e adicione alerta:
  "Divergência de titularidade: consta na PF na DAA de [ano], mas há indicação
  de integralização na PJ [nome] no mesmo ano."
- Imóveis com valor zerado em 31/12 do ano analisado foram alienados/transferidos:
  registre com flag "alienado: true" e não inclua no total de imóveis ativos.

ALERTAS AUTOMÁTICOS — gerar alerta para:
- Imóvel adquirido por permuta (verificar se imóvel permutado foi baixado).
- Imóvel integralizado em PJ recentemente.
- Divergência de titularidade PF/PJ no mesmo ano.
- Ativos em recuperação judicial.
- Bens no exterior.
- Dívidas relevantes (> R$ 100.000).
- Holdings constituídas no ano-calendário.
- Holdings encerradas (verificar distrato).

NÍVEL DOS ALERTAS:
- "critico" → risco jurídico ou fiscal imediato (ex: divergência de titularidade)
- "atencao" → requer verificação antes da precificação (ex: permuta, integralização recente)
- "informativo" → contexto relevante (ex: holding nova, bem no exterior)`;

const PATRIMONIAL_TOOL = {
  name: "registrar_patrimonio",
  description: "Registra o mapa patrimonial completo extraído dos documentos.",
  input_schema: {
    description: "Registra o mapa patrimonial completo extraído dos documentos.",
    type: "object",
    properties: {
        familia: {
          type: "object",
          properties: {
            nome: { type: "string" },
            sede: { type: ["string", "null"] },
            perfil: { type: ["string", "null"] },
            email_familia: { type: ["string", "null"] },
            fonte: { type: "string" },
          },
          required: ["nome", "fonte"],
        },
        membros: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              nome: { type: "string" },
              cpf: { type: ["string", "null"] },
              papel: {
                type: "string",
                enum: ["titular", "conjuge", "filho", "dependente", "socio_familiar", "socio_externo"],
              },
              data_nascimento: { type: ["string", "null"] },
              email: { type: ["string", "null"] },
              ocupacao: { type: ["string", "null"] },
              is_assinante: { type: "boolean" },
              fonte: { type: "string" },
            },
            required: ["id", "nome", "papel", "is_assinante", "fonte"],
          },
        },
        holdings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              razao_social: { type: "string" },
              cnpj: { type: ["string", "null"] },
              tipo: {
                type: "string",
                enum: ["patrimonial", "operacional", "rural", "holding_pura", "nova", "encerrada", "outra"],
              },
              regime_tributario: { type: ["string", "null"] },
              socios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    membro_id: { type: "string" },
                    percentual: { type: ["number", "null"] },
                    num_quotas: { type: ["number", "null"] },
                    valor_quota: { type: ["number", "null"] },
                  },
                  required: ["membro_id"],
                },
              },
              dividendos_distribuidos: { type: ["number", "null"] },
              ano_constituicao: { type: ["number", "null"] },
              observacoes: { type: ["string", "null"] },
              fonte: { type: "string" },
            },
            required: ["id", "razao_social", "tipo", "socios", "fonte"],
          },
        },
        imoveis: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              descricao: { type: "string" },
              logradouro: { type: ["string", "null"] },
              numero: { type: ["string", "null"] },
              complemento: { type: ["string", "null"] },
              bairro: { type: ["string", "null"] },
              municipio: { type: ["string", "null"] },
              uf: { type: ["string", "null"] },
              cep: { type: ["string", "null"] },
              area_m2: { type: ["number", "null"] },
              valor_declarado: { type: ["number", "null"] },
              data_aquisicao: { type: ["string", "null"] },
              matricula: { type: ["string", "null"] },
              cartorio: { type: ["string", "null"] },
              inscricao_municipal: { type: ["string", "null"] },
              titularidade: { type: "string", enum: ["PF", "PJ"] },
              titular_id: { type: "string" },
              holding_id: { type: ["string", "null"] },
              forma_aquisicao: {
                type: ["string", "null"],
                enum: ["compra", "permuta", "integralizacao", "heranca", "doacao", "outra", null],
              },
              locacao: { type: "boolean" },
              alienado: { type: "boolean" },
              situacao_ano_anterior: { type: ["number", "null"] },
              situacao_ano_atual: { type: ["number", "null"] },
              benfeitorias: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descricao: { type: "string" },
                    valor: { type: ["number", "null"] },
                    ano: { type: ["number", "null"] },
                  },
                  required: ["descricao"],
                },
              },
              alertas: { type: "array", items: { type: "string" } },
              fonte: { type: "string" },
            },
            required: ["id", "descricao", "titularidade", "titular_id", "locacao", "alienado", "alertas", "fonte"],
          },
        },
        veiculos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              descricao: { type: "string" },
              placa: { type: ["string", "null"] },
              renavam: { type: ["string", "null"] },
              ano: { type: ["string", "null"] },
              valor_declarado: { type: ["number", "null"] },
              titular_id: { type: "string" },
              alienado: { type: "boolean" },
              fonte: { type: "string" },
            },
            required: ["id", "descricao", "titular_id", "alienado", "fonte"],
          },
        },
        investimentos: {
          type: "object",
          properties: {
            renda_fixa: { type: ["number", "null"] },
            previdencia_privada: { type: ["number", "null"] },
            fundos: { type: ["number", "null"] },
            exterior: { type: ["number", "null"] },
            criptoativos: { type: ["number", "null"] },
            outros: { type: ["number", "null"] },
            total: { type: ["number", "null"] },
            alertas: { type: "array", items: { type: "string" } },
            fonte: { type: "string" },
          },
          required: ["alertas", "fonte"],
        },
        dividas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              descricao: { type: "string" },
              credor: { type: ["string", "null"] },
              valor_ano_anterior: { type: ["number", "null"] },
              valor_ano_atual: { type: ["number", "null"] },
              titular_id: { type: "string" },
              fonte: { type: "string" },
            },
            required: ["descricao", "titular_id", "fonte"],
          },
        },
        rendimentos: {
          type: "object",
          properties: {
            tributaveis_pj: { type: ["number", "null"] },
            isentos_dividendos: { type: ["number", "null"] },
            isentos_outros: { type: ["number", "null"] },
            exclusivos_definitivos: { type: ["number", "null"] },
            fonte: { type: "string" },
          },
          required: ["fonte"],
        },
        checklist_documentos: {
          type: "object",
          properties: {
            ir_titular: { type: "string", enum: ["recebido", "pendente", "nao_aplicavel"] },
            ir_conjuge: { type: "string", enum: ["recebido", "pendente", "nao_aplicavel"] },
            contratos_sociais: { type: "string", enum: ["recebido", "parcial", "pendente"] },
            matriculas_imoveis: { type: "string", enum: ["recebido", "parcial", "pendente"] },
            ficha_cadastral: { type: "string", enum: ["recebido", "pendente"] },
            certidoes_onus: { type: "string", enum: ["recebido", "parcial", "pendente"] },
            documentos_adicionais: { type: "array", items: { type: "string" } },
          },
        },
        alertas_gerais: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nivel: { type: "string", enum: ["critico", "atencao", "informativo"] },
              mensagem: { type: "string" },
              relacionado_a: { type: ["string", "null"] },
            },
            required: ["nivel", "mensagem"],
          },
        },
        patrimonio_liquido: {
          type: "object",
          properties: {
            bens_ano_anterior: { type: ["number", "null"] },
            bens_ano_atual: { type: ["number", "null"] },
            dividas_ano_anterior: { type: ["number", "null"] },
            dividas_ano_atual: { type: ["number", "null"] },
            liquido_ano_atual: { type: ["number", "null"] },
          },
        },
        meta: {
          type: "object",
          properties: {
            documentos_analisados: { type: "array", items: { type: "string" } },
            ano_calendario: { type: ["number", "null"] },
            data_extracao: { type: "string" },
            confianca: { type: "string", enum: ["alta", "media", "baixa"] },
            observacoes_gerais: { type: ["string", "null"] },
          },
          required: ["documentos_analisados", "data_extracao", "confianca"],
        },
      },
      required: ["familia", "membros", "holdings", "imoveis", "meta"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { familyName, files, existingData } = await req.json();

    if (!familyName) {
      return new Response(JSON.stringify({ error: "familyName é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [];

    if (Array.isArray(files)) {
      for (const f of files) {
        if (!f?.base64) continue;
        const dataUrl = `data:${f.mimeType || "application/pdf"};base64,${f.base64}`;
        userContent.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
      }
    }

    const enrichmentPrefix = existingData
      ? `Contexto atual (JSON existente do cliente):\n${JSON.stringify(existingData, null, 2)}\n\nNovos documentos anexados acima. Atualize o JSON com as novas informações. Mantenha todos os dados existentes intactos. Adicione ou corrija apenas o que os novos documentos trouxerem.\n\n`
      : "";

    userContent.push({
      type: "text",
      text: `${enrichmentPrefix}Nome da família: ${familyName}\n\nAnalise os documentos anexados e retorne o JSON completo conforme o schema. Extraia todos os dados disponíveis. Não omita imóveis, participações societárias ou membros identificados, mesmo que a informação seja parcial. Use a data de hoje para meta.data_extracao.`,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [PATRIMONIAL_TOOL],
        tool_choice: { type: "function", function: { name: "registrar_patrimonio" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Erro no AI Gateway", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("Sem tool_call no retorno:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Modelo não retornou estrutura esperada", raw: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-patrimonial error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
