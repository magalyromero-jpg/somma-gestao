UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'magaly.romero@gruposomma.com.br';

DELETE FROM public.user_roles 
WHERE user_id = '2323edc1-1501-4ceb-9df8-66f227682e9f' AND role = 'familia';

INSERT INTO public.user_roles (user_id, role)
VALUES ('2323edc1-1501-4ceb-9df8-66f227682e9f', 'gestor')
ON CONFLICT DO NOTHING;