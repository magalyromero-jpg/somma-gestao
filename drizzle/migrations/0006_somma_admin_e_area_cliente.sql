CREATE OR REPLACE FUNCTION public.is_dominio_somma(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  select lower(split_part(coalesce(_email,''),'@',2)) in ('gruposomma.com.br','sommainvestimentos.com.br')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email);
  IF NEW.email_confirmed_at IS NOT NULL AND public.is_dominio_somma(NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'familia');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.profiles SET status = 'ativo', updated_at = NOW() WHERE user_id = NEW.id;
    IF public.is_dominio_somma(NEW.email) THEN
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
      END IF;
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'familia';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Acessos de clientes por edifício (geridos pela equipe)
CREATE OR REPLACE FUNCTION public.loc_listar_acessos(p_edificio uuid)
RETURNS TABLE(user_id uuid, email text, nome text, papel text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.loc_eh_admin(p_edificio) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  RETURN QUERY SELECT a.user_id, p.email, p.nome, a.papel
    FROM public.loc_acessos a LEFT JOIN public.profiles p ON p.user_id = a.user_id
    WHERE a.edificio_id = p_edificio ORDER BY p.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.loc_conceder_acesso(p_edificio uuid, p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  IF NOT public.loc_eh_admin(p_edificio) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT user_id INTO v_uid FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN RETURN 'usuario_nao_encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role IN ('admin','gestor','analista')) THEN
    RETURN 'usuario_da_equipe';
  END IF;
  DELETE FROM public.loc_acessos WHERE user_id = v_uid AND edificio_id = p_edificio;
  INSERT INTO public.loc_acessos (user_id, edificio_id, papel) VALUES (v_uid, p_edificio, 'cliente');
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION public.loc_revogar_acesso(p_edificio uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.loc_eh_admin(p_edificio) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  DELETE FROM public.loc_acessos WHERE user_id = p_user AND edificio_id = p_edificio;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.loc_listar_acessos(uuid), public.loc_conceder_acesso(uuid, text), public.loc_revogar_acesso(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.loc_listar_acessos(uuid), public.loc_conceder_acesso(uuid, text), public.loc_revogar_acesso(uuid, uuid) TO authenticated;