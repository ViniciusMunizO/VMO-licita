-- ============================================================
-- 0013_metas_delete
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script corrige: `metas` (migração 0010) ganhou policy de
-- select/insert/update, mas nunca de delete — RLS bloqueia por padrão, então
-- nem admin conseguia apagar uma meta (só zerar os valores via update). Isso
-- foi descoberto pela própria suíte de teste automatizada: a limpeza de uma
-- meta de teste falhava silenciosamente (a chamada de delete não dava erro,
-- só não apagava nada — RLS nega sem avisar).

begin;

drop policy if exists "admin apaga metas" on metas;
create policy "admin apaga metas" on metas for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

commit;
