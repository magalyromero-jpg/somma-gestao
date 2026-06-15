export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          antes: Json | null
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          depois: Json | null
          entidade: string
          entidade_id: string | null
          familia_id: string | null
          id: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          depois?: Json | null
          entidade: string
          entidade_id?: string | null
          familia_id?: string | null
          id?: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          familia_id?: string | null
          id?: string
        }
        Relationships: []
      }
      bitrix_tarefas: {
        Row: {
          alterado_em: string | null
          bitrix_id: number
          bitrix_parent_id: number | null
          concluido_em: string | null
          created_at: string
          criado_em: string | null
          descricao: string | null
          familia_bitrix_id: number | null
          familia_tag: string | null
          familia_titulo: string | null
          grupo_bitrix: number | null
          id: string
          link_bitrix: string | null
          marcadores: string[] | null
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          synced_at: string
          titulo: string
        }
        Insert: {
          alterado_em?: string | null
          bitrix_id: number
          bitrix_parent_id?: number | null
          concluido_em?: string | null
          created_at?: string
          criado_em?: string | null
          descricao?: string | null
          familia_bitrix_id?: number | null
          familia_tag?: string | null
          familia_titulo?: string | null
          grupo_bitrix?: number | null
          id?: string
          link_bitrix?: string | null
          marcadores?: string[] | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          synced_at?: string
          titulo: string
        }
        Update: {
          alterado_em?: string | null
          bitrix_id?: number
          bitrix_parent_id?: number | null
          concluido_em?: string | null
          created_at?: string
          criado_em?: string | null
          descricao?: string | null
          familia_bitrix_id?: number | null
          familia_tag?: string | null
          familia_titulo?: string | null
          grupo_bitrix?: number | null
          id?: string
          link_bitrix?: string | null
          marcadores?: string[] | null
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          synced_at?: string
          titulo?: string
        }
        Relationships: []
      }
      bitrix_tarefas_cache: {
        Row: {
          bitrix_task_id: number
          descricao: string | null
          familia_id: string
          id: string
          link_bitrix: string | null
          marcadores: string[]
          prazo: string | null
          prioridade: string
          responsavel_foto: string | null
          responsavel_nome: string | null
          status: string
          synced_at: string
          titulo: string
        }
        Insert: {
          bitrix_task_id: number
          descricao?: string | null
          familia_id: string
          id?: string
          link_bitrix?: string | null
          marcadores?: string[]
          prazo?: string | null
          prioridade?: string
          responsavel_foto?: string | null
          responsavel_nome?: string | null
          status?: string
          synced_at?: string
          titulo: string
        }
        Update: {
          bitrix_task_id?: number
          descricao?: string | null
          familia_id?: string
          id?: string
          link_bitrix?: string | null
          marcadores?: string[]
          prazo?: string | null
          prioridade?: string
          responsavel_foto?: string | null
          responsavel_nome?: string | null
          status?: string
          synced_at?: string
          titulo?: string
        }
        Relationships: []
      }
      checklist_holding: {
        Row: {
          data_recebimento: string | null
          documento_id: string | null
          familia_id: string
          holding_id: string
          id: string
          item_id: string
          label: string
          notas: string | null
          opcional: boolean
          status: string
          updated_at: string
        }
        Insert: {
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id: string
          holding_id: string
          id?: string
          item_id: string
          label: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id?: string
          holding_id?: string
          id?: string
          item_id?: string
          label?: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_holding_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "familia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_imovel: {
        Row: {
          data_recebimento: string | null
          documento_id: string | null
          familia_id: string
          id: string
          imovel_id: string
          item_id: string
          label: string
          notas: string | null
          opcional: boolean
          status: string
          updated_at: string
        }
        Insert: {
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id: string
          id?: string
          imovel_id: string
          item_id: string
          label: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id?: string
          id?: string
          imovel_id?: string
          item_id?: string
          label?: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_imovel_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "familia_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_imovel_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_imovel_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_outros_bens: {
        Row: {
          bem_descricao: string | null
          bem_ref_id: string | null
          bem_tipo: string
          data_recebimento: string | null
          documento_id: string | null
          familia_id: string
          id: string
          item_id: string
          label: string
          notas: string | null
          opcional: boolean
          status: string
          updated_at: string
        }
        Insert: {
          bem_descricao?: string | null
          bem_ref_id?: string | null
          bem_tipo: string
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id: string
          id?: string
          item_id: string
          label: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          bem_descricao?: string | null
          bem_ref_id?: string | null
          bem_tipo?: string
          data_recebimento?: string | null
          documento_id?: string | null
          familia_id?: string
          id?: string
          item_id?: string
          label?: string
          notas?: string | null
          opcional?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_outros_bens_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "familia_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_integrantes: {
        Row: {
          created_at: string | null
          email: string | null
          familia_bitrix_id: number
          id: string
          nome: string
          observacao: string | null
          relacao: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          familia_bitrix_id: number
          id?: string
          nome: string
          observacao?: string | null
          relacao?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          familia_bitrix_id?: number
          id?: string
          nome?: string
          observacao?: string | null
          relacao?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      clientes_perfil: {
        Row: {
          area_gestao_contas: boolean | null
          area_imoveis: boolean | null
          area_investimentos: boolean | null
          area_planejamento: boolean | null
          created_at: string | null
          familia_bitrix_id: number
          familia_titulo: string
          id: string
          observacao_geral: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          area_gestao_contas?: boolean | null
          area_imoveis?: boolean | null
          area_investimentos?: boolean | null
          area_planejamento?: boolean | null
          created_at?: string | null
          familia_bitrix_id: number
          familia_titulo: string
          id?: string
          observacao_geral?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          area_gestao_contas?: boolean | null
          area_imoveis?: boolean | null
          area_investimentos?: boolean | null
          area_planejamento?: boolean | null
          created_at?: string | null
          familia_bitrix_id?: number
          familia_titulo?: string
          id?: string
          observacao_geral?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      familia_diligencia_itens: {
        Row: {
          categoria: string
          created_at: string
          familia_id: string
          id: string
          imovel_ref: string | null
          is_locacao: boolean
          item_key: string
          item_label: string
          ordem: number
          status: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          familia_id: string
          id?: string
          imovel_ref?: string | null
          is_locacao?: boolean
          item_key: string
          item_label: string
          ordem?: number
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          familia_id?: string
          id?: string
          imovel_ref?: string | null
          is_locacao?: boolean
          item_key?: string
          item_label?: string
          ordem?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_diligencia_itens_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_documentos: {
        Row: {
          analise: Json | null
          categoria: string | null
          created_by: string
          familia_id: string
          id: string
          imovel_ref: string | null
          nome_arquivo: string
          recebido_em: string
          storage_path: string
          tipo: string | null
        }
        Insert: {
          analise?: Json | null
          categoria?: string | null
          created_by: string
          familia_id: string
          id?: string
          imovel_ref?: string | null
          nome_arquivo: string
          recebido_em?: string
          storage_path: string
          tipo?: string | null
        }
        Update: {
          analise?: Json | null
          categoria?: string | null
          created_by?: string
          familia_id?: string
          id?: string
          imovel_ref?: string | null
          nome_arquivo?: string
          recebido_em?: string
          storage_path?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "familia_documentos_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_membros: {
        Row: {
          created_at: string
          familia_id: string
          id: string
          lidderar_entity_id: number
          nome: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          familia_id: string
          id?: string
          lidderar_entity_id: number
          nome?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          familia_id?: string
          id?: string
          lidderar_entity_id?: number
          nome?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_membros_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          cor_avatar: string
          created_at: string
          id: string
          lidderar_conta_id: number | null
          nome: string
        }
        Insert: {
          cor_avatar?: string
          created_at?: string
          id?: string
          lidderar_conta_id?: number | null
          nome: string
        }
        Update: {
          cor_avatar?: string
          created_at?: string
          id?: string
          lidderar_conta_id?: number | null
          nome?: string
        }
        Relationships: []
      }
      familias_onboarding: {
        Row: {
          bitrix_marcador: string | null
          confianca: string | null
          created_at: string
          created_by: string
          email_familia: string | null
          fonte: string | null
          id: string
          nome: string
          observacoes: string | null
          patrimonio_data: Json | null
          perfil: string | null
          sede: string | null
          tipo_perfil: string | null
          updated_at: string
        }
        Insert: {
          bitrix_marcador?: string | null
          confianca?: string | null
          created_at?: string
          created_by: string
          email_familia?: string | null
          fonte?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          patrimonio_data?: Json | null
          perfil?: string | null
          sede?: string | null
          tipo_perfil?: string | null
          updated_at?: string
        }
        Update: {
          bitrix_marcador?: string | null
          confianca?: string | null
          created_at?: string
          created_by?: string
          email_familia?: string | null
          fonte?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          patrimonio_data?: Json | null
          perfil?: string | null
          sede?: string | null
          tipo_perfil?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fipezap_indices: {
        Row: {
          cidade: string
          created_at: string
          criado_por: string | null
          id: string
          periodo: string
          tipo_imovel: string | null
          valor_m2: number | null
          variacao_anual: number | null
          variacao_mensal: number | null
        }
        Insert: {
          cidade: string
          created_at?: string
          criado_por?: string | null
          id?: string
          periodo: string
          tipo_imovel?: string | null
          valor_m2?: number | null
          variacao_anual?: number | null
          variacao_mensal?: number | null
        }
        Update: {
          cidade?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          periodo?: string
          tipo_imovel?: string | null
          valor_m2?: number | null
          variacao_anual?: number | null
          variacao_mensal?: number | null
        }
        Relationships: []
      }
      historico_valores: {
        Row: {
          cod_imovel: number | null
          cod_interno: string | null
          criado_por: string | null
          data_atualizacao: string
          fonte: string | null
          id: string
          justificativa: string | null
          valor_anterior: number | null
          valor_novo: number | null
          variacao_pct: number | null
        }
        Insert: {
          cod_imovel?: number | null
          cod_interno?: string | null
          criado_por?: string | null
          data_atualizacao?: string
          fonte?: string | null
          id?: string
          justificativa?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
          variacao_pct?: number | null
        }
        Update: {
          cod_imovel?: number | null
          cod_interno?: string | null
          criado_por?: string | null
          data_atualizacao?: string
          fonte?: string | null
          id?: string
          justificativa?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
          variacao_pct?: number | null
        }
        Relationships: []
      }
      imoveis_cache: {
        Row: {
          cod_imovel: number
          cod_interno: string | null
          dados_json: Json | null
          familia_id: string | null
          ultima_sync: string
        }
        Insert: {
          cod_imovel: number
          cod_interno?: string | null
          dados_json?: Json | null
          familia_id?: string | null
          ultima_sync?: string
        }
        Update: {
          cod_imovel?: number
          cod_interno?: string | null
          dados_json?: Json | null
          familia_id?: string | null
          ultima_sync?: string
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_cache_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis_cliente: {
        Row: {
          admin_shortstay_email: string | null
          admin_shortstay_nome: string | null
          admin_shortstay_telefone: string | null
          alertas: Json
          certidao_cnd_condominio_data: string | null
          certidao_cnd_condominio_validade: string | null
          certidao_cnd_energia_data: string | null
          certidao_cnd_energia_validade: string | null
          certidao_cnd_iptu_data: string | null
          certidao_cnd_iptu_validade: string | null
          certidao_matricula_data: string | null
          certidao_matricula_validade: string | null
          certidao_onus_data: string | null
          certidao_onus_validade: string | null
          condominio_admin_email: string | null
          condominio_admin_nome: string | null
          condominio_admin_telefone: string | null
          condominio_nome: string | null
          contrato_fim: string | null
          contrato_inicio: string | null
          created_at: string
          data_aquisicao: string | null
          data_inicio_locacao: string | null
          data_proximo_reajuste: string | null
          distribuidora: string | null
          distribuidora_energia: string | null
          endereco: string | null
          extracao_meta: Json | null
          familia_id: string
          hidrometro: string | null
          holding_cnpj: string | null
          id: string
          imobiliaria_email: string | null
          imobiliaria_nome: string | null
          imobiliaria_telefone: string | null
          indice_correcao: string | null
          indice_locacao: string | null
          inscricao_municipal: string | null
          locacao: boolean
          matricula: string | null
          matricula_agua: string | null
          mes_referencia_energia: string | null
          nome: string
          origem: string
          periodicidade_reajuste: string | null
          plataforma_shortstay: string | null
          receita_media_mensal: number | null
          ref_id: string | null
          status_atual: string | null
          taxa_administracao_pct: number | null
          taxa_condominio: number | null
          tipo_locacao: string | null
          tipo_operacao: string | null
          titularidade: string | null
          unidade_consumidora: string | null
          updated_at: string
          valor_aquisicao: number | null
          valor_declarado: number | null
          valor_iptu_anual: number | null
          valor_locacao_atual: number | null
          valor_locacao_inicial: number | null
          vencimento_condominio: number | null
        }
        Insert: {
          admin_shortstay_email?: string | null
          admin_shortstay_nome?: string | null
          admin_shortstay_telefone?: string | null
          alertas?: Json
          certidao_cnd_condominio_data?: string | null
          certidao_cnd_condominio_validade?: string | null
          certidao_cnd_energia_data?: string | null
          certidao_cnd_energia_validade?: string | null
          certidao_cnd_iptu_data?: string | null
          certidao_cnd_iptu_validade?: string | null
          certidao_matricula_data?: string | null
          certidao_matricula_validade?: string | null
          certidao_onus_data?: string | null
          certidao_onus_validade?: string | null
          condominio_admin_email?: string | null
          condominio_admin_nome?: string | null
          condominio_admin_telefone?: string | null
          condominio_nome?: string | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_inicio_locacao?: string | null
          data_proximo_reajuste?: string | null
          distribuidora?: string | null
          distribuidora_energia?: string | null
          endereco?: string | null
          extracao_meta?: Json | null
          familia_id: string
          hidrometro?: string | null
          holding_cnpj?: string | null
          id?: string
          imobiliaria_email?: string | null
          imobiliaria_nome?: string | null
          imobiliaria_telefone?: string | null
          indice_correcao?: string | null
          indice_locacao?: string | null
          inscricao_municipal?: string | null
          locacao?: boolean
          matricula?: string | null
          matricula_agua?: string | null
          mes_referencia_energia?: string | null
          nome: string
          origem?: string
          periodicidade_reajuste?: string | null
          plataforma_shortstay?: string | null
          receita_media_mensal?: number | null
          ref_id?: string | null
          status_atual?: string | null
          taxa_administracao_pct?: number | null
          taxa_condominio?: number | null
          tipo_locacao?: string | null
          tipo_operacao?: string | null
          titularidade?: string | null
          unidade_consumidora?: string | null
          updated_at?: string
          valor_aquisicao?: number | null
          valor_declarado?: number | null
          valor_iptu_anual?: number | null
          valor_locacao_atual?: number | null
          valor_locacao_inicial?: number | null
          vencimento_condominio?: number | null
        }
        Update: {
          admin_shortstay_email?: string | null
          admin_shortstay_nome?: string | null
          admin_shortstay_telefone?: string | null
          alertas?: Json
          certidao_cnd_condominio_data?: string | null
          certidao_cnd_condominio_validade?: string | null
          certidao_cnd_energia_data?: string | null
          certidao_cnd_energia_validade?: string | null
          certidao_cnd_iptu_data?: string | null
          certidao_cnd_iptu_validade?: string | null
          certidao_matricula_data?: string | null
          certidao_matricula_validade?: string | null
          certidao_onus_data?: string | null
          certidao_onus_validade?: string | null
          condominio_admin_email?: string | null
          condominio_admin_nome?: string | null
          condominio_admin_telefone?: string | null
          condominio_nome?: string | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          data_aquisicao?: string | null
          data_inicio_locacao?: string | null
          data_proximo_reajuste?: string | null
          distribuidora?: string | null
          distribuidora_energia?: string | null
          endereco?: string | null
          extracao_meta?: Json | null
          familia_id?: string
          hidrometro?: string | null
          holding_cnpj?: string | null
          id?: string
          imobiliaria_email?: string | null
          imobiliaria_nome?: string | null
          imobiliaria_telefone?: string | null
          indice_correcao?: string | null
          indice_locacao?: string | null
          inscricao_municipal?: string | null
          locacao?: boolean
          matricula?: string | null
          matricula_agua?: string | null
          mes_referencia_energia?: string | null
          nome?: string
          origem?: string
          periodicidade_reajuste?: string | null
          plataforma_shortstay?: string | null
          receita_media_mensal?: number | null
          ref_id?: string | null
          status_atual?: string | null
          taxa_administracao_pct?: number | null
          taxa_condominio?: number | null
          tipo_locacao?: string | null
          tipo_operacao?: string | null
          titularidade?: string | null
          unidade_consumidora?: string | null
          updated_at?: string
          valor_aquisicao?: number | null
          valor_declarado?: number | null
          valor_iptu_anual?: number | null
          valor_locacao_atual?: number | null
          valor_locacao_inicial?: number | null
          vencimento_condominio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_cliente_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      imovel_comentarios: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          familia_id: string
          id: string
          imovel_ref: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          familia_id: string
          id?: string
          imovel_ref: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          familia_id?: string
          id?: string
          imovel_ref?: string
          texto?: string
        }
        Relationships: []
      }
      market_conclusions: {
        Row: {
          competitividade: string | null
          created_at: string
          estimativa_ativo: number | null
          oferta_demanda: string | null
          posicionamento: string | null
          search_id: string
          tipologia_dominante: string | null
        }
        Insert: {
          competitividade?: string | null
          created_at?: string
          estimativa_ativo?: number | null
          oferta_demanda?: string | null
          posicionamento?: string | null
          search_id: string
          tipologia_dominante?: string | null
        }
        Update: {
          competitividade?: string | null
          created_at?: string
          estimativa_ativo?: number | null
          oferta_demanda?: string | null
          posicionamento?: string | null
          search_id?: string
          tipologia_dominante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_conclusions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: true
            referencedRelation: "market_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          created_at: string
          dias_no_mercado: number | null
          dorms: number | null
          endereco: string | null
          id: string
          lat: number | null
          lng: number | null
          m2: number | null
          portal: string | null
          preco: number | null
          preco_m2: number | null
          search_id: string
          tipologia: string | null
          titulo: string | null
          url: string | null
          vagas: number | null
        }
        Insert: {
          created_at?: string
          dias_no_mercado?: number | null
          dorms?: number | null
          endereco?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          m2?: number | null
          portal?: string | null
          preco?: number | null
          preco_m2?: number | null
          search_id: string
          tipologia?: string | null
          titulo?: string | null
          url?: string | null
          vagas?: number | null
        }
        Update: {
          created_at?: string
          dias_no_mercado?: number | null
          dorms?: number | null
          endereco?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          m2?: number | null
          portal?: string | null
          preco?: number | null
          preco_m2?: number | null
          search_id?: string
          tipologia?: string | null
          titulo?: string | null
          url?: string | null
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "market_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      market_metrics: {
        Row: {
          created_at: string
          desvio_padrao: number | null
          maximo_m2: number | null
          maximo_tipologia: string | null
          maximo_valor: number | null
          media: number | null
          mediana: number | null
          minimo_m2: number | null
          minimo_tipologia: string | null
          minimo_valor: number | null
          portais: Json | null
          search_id: string
          tempo_medio_mercado: number | null
          tipologias: Json | null
          total: number | null
        }
        Insert: {
          created_at?: string
          desvio_padrao?: number | null
          maximo_m2?: number | null
          maximo_tipologia?: string | null
          maximo_valor?: number | null
          media?: number | null
          mediana?: number | null
          minimo_m2?: number | null
          minimo_tipologia?: string | null
          minimo_valor?: number | null
          portais?: Json | null
          search_id: string
          tempo_medio_mercado?: number | null
          tipologias?: Json | null
          total?: number | null
        }
        Update: {
          created_at?: string
          desvio_padrao?: number | null
          maximo_m2?: number | null
          maximo_tipologia?: string | null
          maximo_valor?: number | null
          media?: number | null
          mediana?: number | null
          minimo_m2?: number | null
          minimo_tipologia?: string | null
          minimo_valor?: number | null
          portais?: Json | null
          search_id?: string
          tempo_medio_mercado?: number | null
          tipologias?: Json | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_metrics_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: true
            referencedRelation: "market_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      market_searches: {
        Row: {
          bairro: string | null
          cidade: string
          created_at: string
          created_by: string
          endereco_alvo: string | null
          finalidade: string
          id: string
          m2_max: number | null
          m2_min: number | null
          margem_pct: number
          nome_predio: string | null
          params: Json | null
          portais: string[]
          raio_metros: number
          status: string
          tipologias: string[]
          uf: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cidade: string
          created_at?: string
          created_by: string
          endereco_alvo?: string | null
          finalidade?: string
          id?: string
          m2_max?: number | null
          m2_min?: number | null
          margem_pct?: number
          nome_predio?: string | null
          params?: Json | null
          portais?: string[]
          raio_metros?: number
          status?: string
          tipologias?: string[]
          uf: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cidade?: string
          created_at?: string
          created_by?: string
          endereco_alvo?: string | null
          finalidade?: string
          id?: string
          m2_max?: number | null
          m2_min?: number | null
          margem_pct?: number
          nome_predio?: string | null
          params?: Json | null
          portais?: string[]
          raio_metros?: number
          status?: string
          tipologias?: string[]
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      pesquisas_mercado: {
        Row: {
          area_m2: number | null
          bairro: string | null
          cidade: string | null
          created_at: string
          criado_por: string | null
          data_pesquisa: string | null
          fonte: string | null
          id: string
          observacoes: string | null
          tipo_imovel: string | null
          url: string | null
          valor: number | null
        }
        Insert: {
          area_m2?: number | null
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          data_pesquisa?: string | null
          fonte?: string | null
          id?: string
          observacoes?: string | null
          tipo_imovel?: string | null
          url?: string | null
          valor?: number | null
        }
        Update: {
          area_m2?: number | null
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          criado_por?: string | null
          data_pesquisa?: string | null
          fonte?: string | null
          id?: string
          observacoes?: string | null
          tipo_imovel?: string | null
          url?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          familia_id: string | null
          id: string
          nome: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          familia_id?: string | null
          id?: string
          nome?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          familia_id?: string | null
          id?: string
          nome?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      repasses_aluguel: {
        Row: {
          competencia: string
          created_at: string
          created_by: string | null
          data_repasse: string | null
          familia_id: string
          id: string
          imovel_id: string
          observacoes: string | null
          taxa_adm: number | null
          valor_bruto: number
          valor_liquido: number | null
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          data_repasse?: string | null
          familia_id: string
          id?: string
          imovel_id: string
          observacoes?: string | null
          taxa_adm?: number | null
          valor_bruto: number
          valor_liquido?: number | null
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          data_repasse?: string | null
          familia_id?: string
          id?: string
          imovel_id?: string
          observacoes?: string | null
          taxa_adm?: number | null
          valor_bruto?: number
          valor_liquido?: number | null
        }
        Relationships: []
      }
      tarefas_observacoes: {
        Row: {
          autor_id: string | null
          autor_nome: string | null
          bitrix_task_id: number
          created_at: string | null
          familia_bitrix_id: number | null
          id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          autor_nome?: string | null
          bitrix_task_id: number
          created_at?: string | null
          familia_bitrix_id?: number | null
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          autor_nome?: string | null
          bitrix_task_id?: number
          created_at?: string | null
          familia_bitrix_id?: number | null
          id?: string
          texto?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_familia: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "gestor" | "familia" | "admin" | "analista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gestor", "familia", "admin", "analista"],
    },
  },
} as const
