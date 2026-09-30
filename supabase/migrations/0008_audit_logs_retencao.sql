-- ============================================================
-- 0008_audit_logs_retencao
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: audit_logs só cresce e nunca é limpa, guardando
-- payload com dado de negócio (e às vezes pessoal) por tempo indefinido, sem
-- política de retenção. A tela de auditoria ganhou um botão "Exportar e
-- apagar logs antigos" (exporta pra Excel antes de apagar, e só o intervalo
-- escolhido) — RLS não tinha nenhuma policy de delete em audit_logs
-- (propositalmente, pra ninguém apagar a própria trilha por engano ou má fé),
-- então sem isto o botão não teria efeito nenhum pra ninguém, nem admin.

begin;

drop policy if exists "admin apaga audit_logs antigos" on audit_logs;
create policy "admin apaga audit_logs antigos" on audit_logs for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

commit;
