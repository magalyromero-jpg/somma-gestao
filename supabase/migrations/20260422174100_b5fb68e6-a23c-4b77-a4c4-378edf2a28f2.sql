
-- ============================================================
-- ENUM de papéis
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('gestor', 'familia');

-- ============================================================
-- Função utilitária: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- FAMILIAS
-- ============================================================
CREATE TABLE public.familias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  lidderar_conta_id INTEGER,
  cor_avatar TEXT NOT NULL DEFAULT '#CC8B15',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FAMILIA_MEMBROS
-- ============================================================
CREATE TABLE public.familia_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id UUID NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cliente','empresa')),
  lidderar_entity_id INTEGER NOT NULL,
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_familia_membros_familia ON public.familia_membros(familia_id);

-- ============================================================
-- IMOVEIS_CACHE
-- ============================================================
CREATE TABLE public.imoveis_cache (
  cod_imovel INTEGER PRIMARY KEY,
  cod_interno TEXT,
  familia_id UUID REFERENCES public.familias(id) ON DELETE SET NULL,
  dados_json JSONB,
  ultima_sync TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_imoveis_cache_familia ON public.imoveis_cache(familia_id);

-- ============================================================
-- FIPEZAP_INDICES
-- ============================================================
CREATE TABLE public.fipezap_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade TEXT NOT NULL,
  tipo_imovel TEXT,
  periodo TEXT NOT NULL,
  variacao_mensal NUMERIC,
  variacao_anual NUMERIC,
  valor_m2 NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- PESQUISAS_MERCADO
-- ============================================================
CREATE TABLE public.pesquisas_mercado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade TEXT,
  bairro TEXT,
  tipo_imovel TEXT,
  area_m2 NUMERIC,
  valor NUMERIC,
  fonte TEXT,
  url TEXT,
  data_pesquisa DATE,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HISTORICO_VALORES
-- ============================================================
CREATE TABLE public.historico_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_imovel INTEGER,
  cod_interno TEXT,
  valor_anterior NUMERIC,
  valor_novo NUMERIC,
  variacao_pct NUMERIC,
  fonte TEXT,
  justificativa TEXT,
  data_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_historico_valores_imovel ON public.historico_valores(cod_imovel);

-- ============================================================
-- CONFIGURACOES
-- ============================================================
CREATE TABLE public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_configuracoes_updated
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  familia_id UUID REFERENCES public.familias(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER_ROLES (separado por segurança)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ============================================================
-- Funções SECURITY DEFINER (evitar recursão em RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_familia(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT familia_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- ============================================================
-- Trigger: cria profile e papel padrão (familia) ao registrar
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'familia');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.familias            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familia_membros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fipezap_indices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesquisas_mercado   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — FAMILIAS
-- ============================================================
CREATE POLICY "Gestores veem todas as familias"
ON public.familias FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Familia ve a propria"
ON public.familias FOR SELECT TO authenticated
USING (id = public.get_user_familia(auth.uid()));

CREATE POLICY "Gestores gerenciam familias"
ON public.familias FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — FAMILIA_MEMBROS
-- ============================================================
CREATE POLICY "Gestores veem membros"
ON public.familia_membros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Familia ve seus membros"
ON public.familia_membros FOR SELECT TO authenticated
USING (familia_id = public.get_user_familia(auth.uid()));

CREATE POLICY "Gestores gerenciam membros"
ON public.familia_membros FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — IMOVEIS_CACHE
-- ============================================================
CREATE POLICY "Gestores veem todos imoveis"
ON public.imoveis_cache FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Familia ve seus imoveis"
ON public.imoveis_cache FOR SELECT TO authenticated
USING (familia_id = public.get_user_familia(auth.uid()));

CREATE POLICY "Gestores gerenciam imoveis"
ON public.imoveis_cache FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — FIPEZAP_INDICES (todos veem, gestor edita)
-- ============================================================
CREATE POLICY "Autenticados veem fipezap"
ON public.fipezap_indices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores gerenciam fipezap"
ON public.fipezap_indices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — PESQUISAS_MERCADO
-- ============================================================
CREATE POLICY "Autenticados veem pesquisas"
ON public.pesquisas_mercado FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores gerenciam pesquisas"
ON public.pesquisas_mercado FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — HISTORICO_VALORES
-- ============================================================
CREATE POLICY "Gestores veem historico"
ON public.historico_valores FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores gerenciam historico"
ON public.historico_valores FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — CONFIGURACOES (somente gestor)
-- ============================================================
CREATE POLICY "Gestores gerenciam configuracoes"
ON public.configuracoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — PROFILES
-- ============================================================
CREATE POLICY "Usuario ve seu profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestores veem todos profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Usuario atualiza seu profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestores atualizam profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

-- ============================================================
-- POLICIES — USER_ROLES
-- ============================================================
CREATE POLICY "Usuario ve seus roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestores veem todos roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores gerenciam roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));
