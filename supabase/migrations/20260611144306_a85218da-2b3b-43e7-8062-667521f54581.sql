DROP POLICY IF EXISTS "Gestores gerenciam configuracoes" ON public.configuracoes;
CREATE POLICY "Admins e gestores gerenciam configuracoes"
ON public.configuracoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));