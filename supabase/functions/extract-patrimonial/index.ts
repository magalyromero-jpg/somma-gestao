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

REGRAS OBRIGATÓRIAS:
- Nunca invente dados. Se uma informação não estiver no documento, use null.
- Quando houver ambiguidade (ex: imóvel pode estar na PF ou já integralizado na PJ),
  registre exatamente o que o documento diz e sinalize com um alerta.
- Classifique cada membro familiar pelo seu papel real no ecossistema:
  "titular", "conjuge", "filho", "dependente", "socio_familiar", "socio_externo".
- Para imóveis, extraia SEMPRE: endereço completo, valor declarado, área (m²),
  matrícula, cartório, data de aquisição, e se está na PF ou em qual PJ.
- Identifique holdings pela natureza: "patrimonial", "operacional", "rural",
  "holding_pura", "nova" (constituída no ano-calendário).
- Sinalize alertas para: imóveis integralizados recentemente, ativos em recuperação
  judicial, permutas, bens no exterior, dívidas relevantes, e qualquer estrutura
  que mereça due diligence antes da precificação.
- O campo "fonte" em cada objeto deve indicar de qual documento o dado foi extraído.`;

const PATRIMONIAL_TOOL = {
  type: "function",
  function: {
    name: "registrar_patrimonio",
    description: "Registra o mapa patrimonial completo extraído dos documentos.",
    parameters: {
      type: "object",
      properties: {
        familia: {
          type: "object",
          properties: {
            nome: { type: "string" },
            sede: { type: ["string", "null"] },
            perfil: { type: ["string", "null"] },
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
                enum: ["patrimonial", "operacional", "rural", "holding_pura", "nova", "outra"],
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
              situacao_2023: { type: ["number", "null"] },
              situacao_2024: { type: ["number", "null"] },
              alertas: { type: "array", items: { type: "string" } },
              fonte: { type: "string" },
            },
            required: ["id", "descricao", "titularidade", "titular_id", "locacao", "alertas", "fonte"],
          },
        },
        veiculos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              descricao: { type: "string" },
              placa: { type: ["string", "null"] },
              ano: { type: ["string", "null"] },
              valor_declarado: { type: ["number", "null"] },
              titular_id: { type: "string" },
              fonte: { type: "string" },
            },
            required: ["descricao", "titular_id", "fonte"],
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
              valor_2023: { type: ["number", "null"] },
              valor_2024: { type: ["number", "null"] },
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
            bens_2023: { type: ["number", "null"] },
            bens_2024: { type: ["number", "null"] },
            dividas_2023: { type: ["number", "null"] },
            dividas_2024: { type: ["number", "null"] },
            liquido_2024: { type: ["number", "null"] },
          },
        },
        meta: {
          type: "object",
          properties: {
            documentos_analisados: { type: "array", items: { type: "string" } },
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
        // f: { name, mimeType, base64 }
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
      text: `${enrichmentPrefix}Nome da família: ${familyName}\n\nAnalise os documentos anexados e chame a ferramenta registrar_patrimonio com o JSON estruturado completo. Use a data de hoje para meta.data_extracao.`,
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
