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
          responsavel_imoveis: string | null
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
          responsavel_imoveis?: string | null
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
          responsavel_imoveis?: string | null
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
      familia_id_map: {
        Row: {
          familia_bitrix_id: number
          familia_titulo: string
        }
        Insert: {
          familia_bitrix_id: number
          familia_titulo: string
        }
        Update: {
          familia_bitrix_id?: number
          familia_titulo?: string
        }
        Relationships: []
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
      loc_acessos: {
        Row: {
          edificio_id: string
          papel: string
          user_id: string
        }
        Insert: {
          edificio_id: string
          papel: string
          user_id: string
        }
        Update: {
          edificio_id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_acessos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_aditivos: {
        Row: {
          contrato_id: string
          data: string
          descricao: string | null
          edificio_id: string
          id: string
          tipo: string
          valor_novo: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          contrato_id: string
          data: string
          descricao?: string | null
          edificio_id: string
          id?: string
          tipo: string
          valor_novo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          contrato_id?: string
          data?: string
          descricao?: string | null
          edificio_id?: string
          id?: string
          tipo?: string
          valor_novo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_aditivos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_boletos: {
        Row: {
          arquivo_origem: string | null
          atualizado_em: string
          contrato_id: string | null
          data_baixa: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          documento: string | null
          edificio_id: string
          id: string
          nosso_numero: string
          outra_receita: string | null
          pagador: string
          status: string
          valor_pago: number
          valor_titulo: number
        }
        Insert: {
          arquivo_origem?: string | null
          atualizado_em?: string
          contrato_id?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          documento?: string | null
          edificio_id: string
          id?: string
          nosso_numero: string
          outra_receita?: string | null
          pagador: string
          status: string
          valor_pago?: number
          valor_titulo: number
        }
        Update: {
          arquivo_origem?: string | null
          atualizado_em?: string
          contrato_id?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          documento?: string | null
          edificio_id?: string
          id?: string
          nosso_numero?: string
          outra_receita?: string | null
          pagador?: string
          status?: string
          valor_pago?: number
          valor_titulo?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_codigo_sucessao: {
        Row: {
          a_partir_vencimento: string
          codigo: string
          contrato_id: string
          edificio_id: string
        }
        Insert: {
          a_partir_vencimento: string
          codigo: string
          contrato_id: string
          edificio_id: string
        }
        Update: {
          a_partir_vencimento?: string
          codigo?: string
          contrato_id?: string
          edificio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigo_sucessao_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_codigos_lidderar: {
        Row: {
          codigo: string
          contrato_id: string | null
          edificio_id: string
          nome_no_lidderar: string | null
        }
        Insert: {
          codigo: string
          contrato_id?: string | null
          edificio_id: string
          nome_no_lidderar?: string | null
        }
        Update: {
          codigo?: string
          contrato_id?: string | null
          edificio_id?: string
          nome_no_lidderar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_codigos_lidderar_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_contrato_unidades: {
        Row: {
          contrato_id: string
          edificio_id: string
          unidade_id: string
        }
        Insert: {
          contrato_id: string
          edificio_id: string
          unidade_id: string
        }
        Update: {
          contrato_id?: string
          edificio_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ocupacao"
            referencedColumns: ["unidade_id"]
          },
        ]
      }
      loc_contratos: {
        Row: {
          carencia_meses: number
          competencia: Database["public"]["Enums"]["loc_competencia"]
          conferir_recebimento: boolean
          contrato_anterior_id: string | null
          created_at: string | null
          data_assinatura: string | null
          data_em_pauta: string | null
          data_fim: string | null
          data_inicio: string | null
          data_inicio_vigente: string | null
          data_saida: string | null
          debito_alugueis: number | null
          debito_condominio: number
          dia_vencimento: number | null
          edificio_id: string
          fim_reforecast: string | null
          id: string
          indice: Database["public"]["Enums"]["loc_indice"]
          locatario_id: string
          mes_aniversario: string | null
          mes_reajuste: number | null
          motivo_encerramento: string | null
          no_orcamento: boolean
          periodicidade_meses: number
          piso_zero: boolean
          recebe_por_boleto: boolean
          retencao_orcada_pct: number | null
          retencao_pct: number
          status: Database["public"]["Enums"]["loc_status"]
          tipo: Database["public"]["Enums"]["loc_tipo_contrato"]
          valor_inicial: number
        }
        Insert: {
          carencia_meses?: number
          competencia?: Database["public"]["Enums"]["loc_competencia"]
          conferir_recebimento?: boolean
          contrato_anterior_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          data_em_pauta?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_inicio_vigente?: string | null
          data_saida?: string | null
          debito_alugueis?: number | null
          debito_condominio?: number
          dia_vencimento?: number | null
          edificio_id: string
          fim_reforecast?: string | null
          id?: string
          indice?: Database["public"]["Enums"]["loc_indice"]
          locatario_id: string
          mes_aniversario?: string | null
          mes_reajuste?: number | null
          motivo_encerramento?: string | null
          no_orcamento?: boolean
          periodicidade_meses?: number
          piso_zero?: boolean
          recebe_por_boleto?: boolean
          retencao_orcada_pct?: number | null
          retencao_pct?: number
          status?: Database["public"]["Enums"]["loc_status"]
          tipo?: Database["public"]["Enums"]["loc_tipo_contrato"]
          valor_inicial: number
        }
        Update: {
          carencia_meses?: number
          competencia?: Database["public"]["Enums"]["loc_competencia"]
          conferir_recebimento?: boolean
          contrato_anterior_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          data_em_pauta?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_inicio_vigente?: string | null
          data_saida?: string | null
          debito_alugueis?: number | null
          debito_condominio?: number
          dia_vencimento?: number | null
          edificio_id?: string
          fim_reforecast?: string | null
          id?: string
          indice?: Database["public"]["Enums"]["loc_indice"]
          locatario_id?: string
          mes_aniversario?: string | null
          mes_reajuste?: number | null
          motivo_encerramento?: string | null
          no_orcamento?: boolean
          periodicidade_meses?: number
          piso_zero?: boolean
          recebe_por_boleto?: boolean
          retencao_orcada_pct?: number | null
          retencao_pct?: number
          status?: Database["public"]["Enums"]["loc_status"]
          tipo?: Database["public"]["Enums"]["loc_tipo_contrato"]
          valor_inicial?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_contrato_anterior_id_fkey"
            columns: ["contrato_anterior_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contratos_locatario_id_fkey"
            columns: ["locatario_id"]
            isOneToOne: false
            referencedRelation: "loc_locatarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contratos_locatario_id_fkey"
            columns: ["locatario_id"]
            isOneToOne: false
            referencedRelation: "loc_v_locatarios_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_contratos_notas: {
        Row: {
          contrato_id: string
          edificio_id: string
          nota: string | null
        }
        Insert: {
          contrato_id: string
          edificio_id: string
          nota?: string | null
        }
        Update: {
          contrato_id?: string
          edificio_id?: string
          nota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_contratos_notas_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_cronograma: {
        Row: {
          competencia: string
          contrato_id: string
          edificio_id: string
          origem: string
          valor_previsto: number
        }
        Insert: {
          competencia: string
          contrato_id: string
          edificio_id: string
          origem: string
          valor_previsto: number
        }
        Update: {
          competencia?: string
          contrato_id?: string
          edificio_id?: string
          origem?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_documentos: {
        Row: {
          contrato_id: string | null
          created_at: string | null
          edificio_id: string
          id: string
          revisado: boolean
          storage_path: string
          tipo: Database["public"]["Enums"]["loc_doc_tipo"]
          titulo: string
          unidade_id: string | null
          visivel_cliente: boolean
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string | null
          edificio_id: string
          id?: string
          revisado?: boolean
          storage_path: string
          tipo?: Database["public"]["Enums"]["loc_doc_tipo"]
          titulo: string
          unidade_id?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          contrato_id?: string | null
          created_at?: string | null
          edificio_id?: string
          id?: string
          revisado?: boolean
          storage_path?: string
          tipo?: Database["public"]["Enums"]["loc_doc_tipo"]
          titulo?: string
          unidade_id?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ocupacao"
            referencedColumns: ["unidade_id"]
          },
        ]
      }
      loc_documentos_esperados: {
        Row: {
          contrato_id: string | null
          created_at: string
          data_ref: string | null
          descricao: string
          detalhe: string | null
          documento_id: string | null
          edificio_id: string
          grupo: string
          id: string
          situacao: string
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          data_ref?: string | null
          descricao: string
          detalhe?: string | null
          documento_id?: string | null
          edificio_id: string
          grupo?: string
          id?: string
          situacao?: string
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          data_ref?: string | null
          descricao?: string
          detalhe?: string | null
          documento_id?: string | null
          edificio_id?: string
          grupo?: string
          id?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "loc_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_documentos_esperados_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_edificios: {
        Row: {
          ativo_id: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      loc_importacoes: {
        Row: {
          arquivo: string | null
          created_at: string | null
          criado_por: string | null
          duplicadas: number | null
          edificio_id: string
          id: string
          linhas: number | null
          novas: number | null
          sem_mapeamento: number | null
        }
        Insert: {
          arquivo?: string | null
          created_at?: string | null
          criado_por?: string | null
          duplicadas?: number | null
          edificio_id: string
          id?: string
          linhas?: number | null
          novas?: number | null
          sem_mapeamento?: number | null
        }
        Update: {
          arquivo?: string | null
          created_at?: string | null
          criado_por?: string | null
          duplicadas?: number | null
          edificio_id?: string
          id?: string
          linhas?: number | null
          novas?: number | null
          sem_mapeamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_importacoes_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_indices: {
        Row: {
          acumulado_12m: number
          fonte: string | null
          indice: Database["public"]["Enums"]["loc_indice"]
          mes: string
          variacao_mensal: number | null
        }
        Insert: {
          acumulado_12m: number
          fonte?: string | null
          indice: Database["public"]["Enums"]["loc_indice"]
          mes: string
          variacao_mensal?: number | null
        }
        Update: {
          acumulado_12m?: number
          fonte?: string | null
          indice?: Database["public"]["Enums"]["loc_indice"]
          mes?: string
          variacao_mensal?: number | null
        }
        Relationships: []
      }
      loc_leituras_documento: {
        Row: {
          aplicado_em: string | null
          aplicado_por: string | null
          contrato_id: string | null
          criado_em: string
          dados: Json | null
          documento_id: string
          edificio_id: string
          erro: string | null
          id: string
          modelo: string | null
          status: string
        }
        Insert: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          contrato_id?: string | null
          criado_em?: string
          dados?: Json | null
          documento_id: string
          edificio_id: string
          erro?: string | null
          id?: string
          modelo?: string | null
          status?: string
        }
        Update: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          contrato_id?: string | null
          criado_em?: string
          dados?: Json | null
          documento_id?: string
          edificio_id?: string
          erro?: string | null
          id?: string
          modelo?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "loc_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_leituras_documento_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_locatarios: {
        Row: {
          atividade: string | null
          documento: string | null
          emails: string[] | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          atividade?: string | null
          documento?: string | null
          emails?: string[] | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          atividade?: string | null
          documento?: string | null
          emails?: string[] | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      loc_novas_locacoes: {
        Row: {
          ativa: boolean
          carencia_meses: number
          descricao: string | null
          edificio_id: string
          id: string
          inicio_previsto: string
          probabilidade: number
          unidade_id: string | null
          valor_mensal: number
        }
        Insert: {
          ativa?: boolean
          carencia_meses?: number
          descricao?: string | null
          edificio_id: string
          id?: string
          inicio_previsto: string
          probabilidade?: number
          unidade_id?: string | null
          valor_mensal: number
        }
        Update: {
          ativa?: boolean
          carencia_meses?: number
          descricao?: string | null
          edificio_id?: string
          id?: string
          inicio_previsto?: string
          probabilidade?: number
          unidade_id?: string | null
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_novas_locacoes_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_novas_locacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_novas_locacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ocupacao"
            referencedColumns: ["unidade_id"]
          },
        ]
      }
      loc_pagador_vinculo: {
        Row: {
          contrato_id: string | null
          documento: string
          edificio_id: string
          outra_receita: string | null
        }
        Insert: {
          contrato_id?: string | null
          documento: string
          edificio_id: string
          outra_receita?: string | null
        }
        Update: {
          contrato_id?: string | null
          documento?: string
          edificio_id?: string
          outra_receita?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagador_vinculo_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_pagamentos: {
        Row: {
          chave: string
          codigo: string
          competencia: string | null
          contrato_id: string | null
          data_pagamento: string
          data_vencimento: string
          dias_atraso: number | null
          edificio_id: string
          id: string
          imovel_nome: string | null
          importacao_id: string | null
          valor_bruto: number | null
          valor_liquido: number
        }
        Insert: {
          chave: string
          codigo: string
          competencia?: string | null
          contrato_id?: string | null
          data_pagamento: string
          data_vencimento: string
          dias_atraso?: number | null
          edificio_id: string
          id?: string
          imovel_nome?: string | null
          importacao_id?: string | null
          valor_bruto?: number | null
          valor_liquido: number
        }
        Update: {
          chave?: string
          codigo?: string
          competencia?: string | null
          contrato_id?: string | null
          data_pagamento?: string
          data_vencimento?: string
          dias_atraso?: number | null
          edificio_id?: string
          id?: string
          imovel_nome?: string | null
          importacao_id?: string | null
          valor_bruto?: number | null
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_pagamentos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_pagamentos_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "loc_importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_parametros_cenario: {
        Row: {
          cenario: string
          fator_prob_novas: number
          recup_0_30: number
          recup_31_90: number
          recup_90_mais: number
          usa_novas_locacoes: boolean
        }
        Insert: {
          cenario: string
          fator_prob_novas: number
          recup_0_30: number
          recup_31_90: number
          recup_90_mais: number
          usa_novas_locacoes: boolean
        }
        Update: {
          cenario?: string
          fator_prob_novas?: number
          recup_0_30?: number
          recup_31_90?: number
          recup_90_mais?: number
          usa_novas_locacoes?: boolean
        }
        Relationships: []
      }
      loc_projecao_indices: {
        Row: {
          ano: number
          boletim: string
          indice: string
          valor: number
        }
        Insert: {
          ano: number
          boletim: string
          indice: string
          valor: number
        }
        Update: {
          ano?: number
          boletim?: string
          indice?: string
          valor?: number
        }
        Relationships: []
      }
      loc_projecao_regras: {
        Row: {
          contrato_id: string
          edificio_id: string
          id: string
          observacao: string | null
          renovacao_em: string
          valor_renovacao: number
        }
        Insert: {
          contrato_id: string
          edificio_id: string
          id?: string
          observacao?: string | null
          renovacao_em: string
          valor_renovacao: number
        }
        Update: {
          contrato_id?: string
          edificio_id?: string
          id?: string
          observacao?: string | null
          renovacao_em?: string
          valor_renovacao?: number
        }
        Relationships: []
      }
      loc_reajustes: {
        Row: {
          aniversario: string
          contrato_id: string
          edificio_id: string
          estimado: boolean
          id: string
          indice: Database["public"]["Enums"]["loc_indice"]
          mes_referencia: string | null
          observacao: string | null
          percentual: number | null
          status: string
          valor_anterior: number
          valor_aplicado: number | null
          valor_calculado: number | null
          vigencia_a_partir: string
        }
        Insert: {
          aniversario: string
          contrato_id: string
          edificio_id: string
          estimado?: boolean
          id?: string
          indice: Database["public"]["Enums"]["loc_indice"]
          mes_referencia?: string | null
          observacao?: string | null
          percentual?: number | null
          status?: string
          valor_anterior: number
          valor_aplicado?: number | null
          valor_calculado?: number | null
          vigencia_a_partir: string
        }
        Update: {
          aniversario?: string
          contrato_id?: string
          edificio_id?: string
          estimado?: boolean
          id?: string
          indice?: Database["public"]["Enums"]["loc_indice"]
          mes_referencia?: string | null
          observacao?: string | null
          percentual?: number | null
          status?: string
          valor_anterior?: number
          valor_aplicado?: number | null
          valor_calculado?: number | null
          vigencia_a_partir?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_unidades: {
        Row: {
          andar: number | null
          area_m2: number | null
          area_privativa_m2: number | null
          area_total_m2: number | null
          edificio_id: string
          fora_da_cobranca: boolean | null
          id: string
          matricula: string | null
          nome: string
          tipo: string
        }
        Insert: {
          andar?: number | null
          area_m2?: number | null
          area_privativa_m2?: number | null
          area_total_m2?: number | null
          edificio_id: string
          fora_da_cobranca?: boolean | null
          id?: string
          matricula?: string | null
          nome: string
          tipo?: string
        }
        Update: {
          andar?: number | null
          area_m2?: number | null
          area_privativa_m2?: number | null
          area_total_m2?: number | null
          edificio_id?: string
          fora_da_cobranca?: boolean | null
          id?: string
          matricula?: string | null
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_unidades_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_vigencia_degraus: {
        Row: {
          a_partir: string
          no_orcamento: boolean
          origem: string
          valor_mensal: number
          vigencia_id: string
        }
        Insert: {
          a_partir: string
          no_orcamento?: boolean
          origem?: string
          valor_mensal: number
          vigencia_id: string
        }
        Update: {
          a_partir?: string
          no_orcamento?: boolean
          origem?: string
          valor_mensal?: number
          vigencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loc_vigencia_degraus_vigencia_id_fkey"
            columns: ["vigencia_id"]
            isOneToOne: false
            referencedRelation: "loc_vigencias"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_vigencias: {
        Row: {
          area_contrato_m2: number | null
          contrato_id: string
          created_at: string | null
          data_documento: string | null
          documento_id: string | null
          edificio_id: string
          fim: string
          id: string
          indice: Database["public"]["Enums"]["loc_indice"]
          inicio: string
          mes_reajuste: number | null
          no_orcamento: boolean
          observacao: string | null
          seq: number
          tipo: string
          valor_mensal: number
        }
        Insert: {
          area_contrato_m2?: number | null
          contrato_id: string
          created_at?: string | null
          data_documento?: string | null
          documento_id?: string | null
          edificio_id: string
          fim: string
          id?: string
          indice?: Database["public"]["Enums"]["loc_indice"]
          inicio: string
          mes_reajuste?: number | null
          no_orcamento?: boolean
          observacao?: string | null
          seq: number
          tipo: string
          valor_mensal: number
        }
        Update: {
          area_contrato_m2?: number | null
          contrato_id?: string
          created_at?: string | null
          data_documento?: string | null
          documento_id?: string | null
          edificio_id?: string
          fim?: string
          id?: string
          indice?: Database["public"]["Enums"]["loc_indice"]
          inicio?: string
          mes_reajuste?: number | null
          no_orcamento?: boolean
          observacao?: string | null
          seq?: number
          tipo?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_vigencias_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "loc_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_vigencias_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
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
      onboarding_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          familia_id: string
          fase: string
          id: string
          item_key: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          familia_id: string
          fase: string
          id?: string
          item_key: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          familia_id?: string
          fase?: string
          id?: string
          item_key?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_fases: {
        Row: {
          created_at: string
          familia_id: string
          fase: string
          id: string
          progresso: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          familia_id: string
          fase: string
          id?: string
          progresso?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          familia_id?: string
          fase?: string
          id?: string
          progresso?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      operacional_snapshot_diario: {
        Row: {
          atrasadas: number
          criadas_dia: number
          criado_em: string
          data: string
          em_andamento: number
          encerradas_dia: number
          familia_titulo: string
          prioridade: number
          responsavel_nome: string
          tipo: string
          vencem_hoje: number
          vencem_semana: number
        }
        Insert: {
          atrasadas?: number
          criadas_dia?: number
          criado_em?: string
          data: string
          em_andamento?: number
          encerradas_dia?: number
          familia_titulo: string
          prioridade?: number
          responsavel_nome: string
          tipo: string
          vencem_hoje?: number
          vencem_semana?: number
        }
        Update: {
          atrasadas?: number
          criadas_dia?: number
          criado_em?: string
          data?: string
          em_andamento?: number
          encerradas_dia?: number
          familia_titulo?: string
          prioridade?: number
          responsavel_nome?: string
          tipo?: string
          vencem_hoje?: number
          vencem_semana?: number
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
      loc_v_alerta_reajuste: {
        Row: {
          aniversario: string | null
          contrato_id: string | null
          edificio_id: string | null
          gatilho: string | null
          indice: Database["public"]["Enums"]["loc_indice"] | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_auditoria_reajuste: {
        Row: {
          aniversario: string | null
          contrato_id: string | null
          diferenca: number | null
          edificio_id: string | null
          estimado: boolean | null
          indice: Database["public"]["Enums"]["loc_indice"] | null
          mes_referencia: string | null
          parecer: string | null
          percentual: number | null
          valor_anterior: number | null
          valor_aplicado: number | null
          valor_calculado: number | null
          vigencia_a_partir: string | null
        }
        Insert: {
          aniversario?: string | null
          contrato_id?: string | null
          diferenca?: never
          edificio_id?: string | null
          estimado?: boolean | null
          indice?: Database["public"]["Enums"]["loc_indice"] | null
          mes_referencia?: string | null
          parecer?: never
          percentual?: number | null
          valor_anterior?: number | null
          valor_aplicado?: number | null
          valor_calculado?: number | null
          vigencia_a_partir?: string | null
        }
        Update: {
          aniversario?: string | null
          contrato_id?: string | null
          diferenca?: never
          edificio_id?: string | null
          estimado?: boolean | null
          indice?: Database["public"]["Enums"]["loc_indice"] | null
          mes_referencia?: string | null
          parecer?: never
          percentual?: number | null
          valor_anterior?: number | null
          valor_aplicado?: number | null
          valor_calculado?: number | null
          vigencia_a_partir?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_reajustes_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_boleto_encargos: {
        Row: {
          acrescimo: number | null
          competencia: string | null
          contrato_id: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          dias_atraso: number | null
          edificio_id: string | null
          id: string | null
          juros: number | null
          multa: number | null
          nosso_numero: string | null
          outra_receita: string | null
          pagador: string | null
          valor_pago: number | null
          valor_titulo: number | null
        }
        Insert: {
          acrescimo?: never
          competencia?: never
          contrato_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          dias_atraso?: never
          edificio_id?: string | null
          id?: string | null
          juros?: never
          multa?: never
          nosso_numero?: string | null
          outra_receita?: string | null
          pagador?: string | null
          valor_pago?: number | null
          valor_titulo?: number | null
        }
        Update: {
          acrescimo?: never
          competencia?: never
          contrato_id?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          dias_atraso?: never
          edificio_id?: string | null
          id?: string | null
          juros?: never
          multa?: never
          nosso_numero?: string | null
          outra_receita?: string | null
          pagador?: string | null
          valor_pago?: number | null
          valor_titulo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_boletos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_ciclo: {
        Row: {
          ciclo: string | null
          contrato_id: string | null
          data_em_pauta: string | null
          data_saida: string | null
          dias_para_o_fim: number | null
          edificio_id: string | null
          fim_contrato: string | null
          inicio_original: string | null
          inicio_vigencia_atual: string | null
          motivo_encerramento: string | null
          unidade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contrato_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_contrato_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ocupacao"
            referencedColumns: ["unidade_id"]
          },
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_cobranca: {
        Row: {
          competencia: string | null
          contrato_id: string | null
          dias_em_aberto: number | null
          edificio_id: string | null
          max_atraso: number | null
          saldo: number | null
          situacao: string | null
          ultimo_pagamento: string | null
          valor_pago: number | null
          valor_previsto: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_alerta_reajuste"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_ciclo"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_contrato_vigente"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_encerrados"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_evolucao"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_metragem"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "loc_v_mudancas_ano"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "loc_cronograma_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_contrato_vigente: {
        Row: {
          area_contrato_m2: number | null
          area_matricula_m2: number | null
          contrato_id: string | null
          edificio_id: string | null
          fim: string | null
          indice: Database["public"]["Enums"]["loc_indice"] | null
          inicio: string | null
          locatario: string | null
          matriculas: string | null
          mes_reajuste: number | null
          rs_m2_matricula: number | null
          unidades: string | null
          valor_vigente: number | null
          vigencia_seq: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_encerrados: {
        Row: {
          alugueis_em_aberto: number | null
          contrato_id: string | null
          data_em_pauta: string | null
          data_saida: string | null
          debito_condominio: number | null
          edificio_id: string | null
          locatario: string | null
          motivo_encerramento: string | null
          unidades: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_evolucao: {
        Row: {
          aluguel_atual: number | null
          aluguel_inicial: number | null
          contrato_id: string | null
          edificio_id: string | null
          fim_vigente: string | null
          inicio_aditivo: string | null
          inicio_inicial: string | null
          locatario: string | null
          status: string | null
          tem_aditivo: boolean | null
          unidades: string | null
          variacao_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_locatarios_cliente: {
        Row: {
          edificio_id: string | null
          id: string | null
          nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_metragem: {
        Row: {
          area_contrato_m2: number | null
          area_matricula_m2: number | null
          contrato_id: string | null
          diferenca_m2: number | null
          edificio_id: string | null
          matriculas: string | null
          unidades: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_mudancas_ano: {
        Row: {
          contrato_id: string | null
          data_decisao: string | null
          edificio_id: string | null
          inicio: string | null
          locatario: string | null
          observacao: string | null
          tipo: string | null
          unidades: string | null
          valor_mensal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_contratos_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
      loc_v_ocupacao: {
        Row: {
          area_m2: number | null
          edificio_id: string | null
          nome: string | null
          situacao: string | null
          tipo: string | null
          unidade_id: string | null
        }
        Insert: {
          area_m2?: number | null
          edificio_id?: string | null
          nome?: string | null
          situacao?: never
          tipo?: string | null
          unidade_id?: string | null
        }
        Update: {
          area_m2?: number | null
          edificio_id?: string | null
          nome?: string | null
          situacao?: never
          tipo?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loc_unidades_edificio_id_fkey"
            columns: ["edificio_id"]
            isOneToOne: false
            referencedRelation: "loc_edificios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      atribuir_ids_sinteticos: { Args: never; Returns: undefined }
      consolidar_familia_ids: { Args: never; Returns: undefined }
      get_user_familia: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dominio_somma: { Args: { _email: string }; Returns: boolean }
      loc_acessos_do_usuario: {
        Args: { p_user: string }
        Returns: {
          edificio_id: string
          papel: string
        }[]
      }
      loc_aplicar_leitura: {
        Args: { p_dados: Json; p_leitura: string }
        Returns: Json
      }
      loc_caixa_mensal: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          de_meses_anteriores: number
          em_aberto: number
          em_aberto_encerrados: number
          entrou_no_caixa: number
          mes: string
          orcado: number
          outras_receitas: number
          previsto_contratual: number
          recebido_a_maior: number
          recebido_da_competencia: number
          recebido_no_mes_seguinte: number
        }[]
      }
      loc_calcular_reajuste: {
        Args: {
          p_aniversario: string
          p_contrato: string
          p_valor_anterior: number
        }
        Returns: {
          estimado: boolean
          mes_referencia: string
          percentual: number
          valor_calculado: number
          vigencia_a_partir: string
        }[]
      }
      loc_conceder_acesso: {
        Args: { p_edificio: string; p_email: string }
        Returns: string
      }
      loc_conferencia: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          encerrado: boolean
          locatario: string
          mes: string
          pago_em: string
          previsto: number
          recebido: number
          saldo: number
          situacao: string
          unidades: string
        }[]
      }
      loc_conferir_leitura: {
        Args: { p_dados?: Json; p_leitura: string }
        Returns: Json
      }
      loc_definir_acesso: {
        Args: { p_edificio: string; p_papel: string; p_user: string }
        Returns: undefined
      }
      loc_eh_admin: { Args: { p_edificio: string }; Returns: boolean }
      loc_em_aberto: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          competencias: string
          contrato_id: string
          encerrado: boolean
          locatario: string
          previsto: number
          recebido: number
          saldo: number
          unidades: string
        }[]
      }
      loc_em_aberto_mensal: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          em_aberto: number
          em_aberto_acumulado: number
          mes: string
        }[]
      }
      loc_em_aberto_mensal_contrato: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          em_aberto: number
          locatario: string
          mes: string
          unidades: string
        }[]
      }
      loc_fluxo: {
        Args: { p_ate?: string; p_cenario?: string; p_edificio: string }
        Returns: {
          atraso_recuperado: number
          competencia: string
          diferenca: number
          novas_locacoes: number
          previsto_contratual: number
          realizado_caixa: number
          total_projetado: number
        }[]
      }
      loc_gerar_cronograma: {
        Args: { p_ate?: string; p_contrato: string }
        Returns: number
      }
      loc_importar_boletos: {
        Args: { p_arquivo: string; p_boletos: Json; p_edificio: string }
        Returns: Json
      }
      loc_importar_pagamentos: {
        Args: { p_arquivo: string; p_edificio: string; p_linhas: Json }
        Returns: Json
      }
      loc_indice_12m: {
        Args: {
          p_indice: Database["public"]["Enums"]["loc_indice"]
          p_mes: string
        }
        Returns: number
      }
      loc_listar_acessos: {
        Args: { p_edificio: string }
        Returns: {
          email: string
          nome: string
          papel: string
          user_id: string
        }[]
      }
      loc_orcado_caixa: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          mes: string
          valor: number
        }[]
      }
      loc_planejamento_caixa: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          em_aberto: number
          emitido: number
          fora_boleto: boolean
          mes: string
          pago: number
          previsto: number
          sem_boleto: number
        }[]
      }
      loc_planejamento_outras: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          em_aberto: number
          emitido: number
          mes: string
          outra_receita: string
          pago: number
        }[]
      }
      loc_pode_ver: { Args: { p_edificio: string }; Returns: boolean }
      loc_previsao_leitura: {
        Args: { p_contrato: string; p_data: string }
        Returns: Json
      }
      loc_previsto_caixa: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          mes: string
          valor: number
        }[]
      }
      loc_reforecast_vs_orcado: {
        Args: { p_ano: number; p_edificio: string }
        Returns: {
          contrato_id: string
          diferenca: number
          locatario: string
          mes: string
          orcado: number
          reforecast: number
          unidades: string
        }[]
      }
      loc_remapear_pagamentos: { Args: { p_edificio: string }; Returns: number }
      loc_revogar_acesso: {
        Args: { p_edificio: string; p_user: string }
        Returns: undefined
      }
      loc_valor_em: {
        Args: { p_contrato: string; p_ref: string }
        Returns: number
      }
      loc_valor_orcado_em: {
        Args: { p_contrato: string; p_ref: string }
        Returns: number
      }
      loc_vincular_pagador: {
        Args: {
          p_contrato: string
          p_documento: string
          p_edificio: string
          p_outra: string
        }
        Returns: number
      }
      registrar_snapshot_operacional: {
        Args: { p_data?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "gestor" | "familia" | "admin" | "analista" | "consulta"
      loc_competencia: "posterior" | "antecipada"
      loc_doc_tipo:
        | "contrato"
        | "aditivo"
        | "distrato"
        | "vistoria"
        | "garantia"
        | "boleto"
        | "comunicado"
        | "outro"
      loc_indice: "IGPM" | "IPCA" | "FIXO" | "NENHUM" | "MEDIA"
      loc_status:
        | "rascunho"
        | "ativo"
        | "em_renovacao"
        | "inadimplente"
        | "encerrado"
      loc_tipo_contrato: "locacao" | "eventual" | "repasse"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["gestor", "familia", "admin", "analista", "consulta"],
      loc_competencia: ["posterior", "antecipada"],
      loc_doc_tipo: [
        "contrato",
        "aditivo",
        "distrato",
        "vistoria",
        "garantia",
        "boleto",
        "comunicado",
        "outro",
      ],
      loc_indice: ["IGPM", "IPCA", "FIXO", "NENHUM", "MEDIA"],
      loc_status: [
        "rascunho",
        "ativo",
        "em_renovacao",
        "inadimplente",
        "encerrado",
      ],
      loc_tipo_contrato: ["locacao", "eventual", "repasse"],
    },
  },
} as const
