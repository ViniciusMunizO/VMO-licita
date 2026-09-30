-- ============================================================
-- 0012_audit_logs_retencao_minima
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- CORRIGE UMA FALHA DE SEGURANÇA introduzida pela migração 0008: aquela
-- policy deixava admin apagar QUALQUER log de auditoria, inclusive um
-- recém-criado — não só os antigos que a tela de retenção deveria remover.
-- Isso quebrava a garantia original do audit_logs ("ninguém altera/apaga a
-- trilha, nem admin, nem pela API" — ver comentário original no schema.sql).
-- Um teste automatizado (scripts/_t7-seguranca-limites.js, seção 28) pegou
-- isso na prática: um log criado na hora foi apagado por uma sessão admin.
--
-- Agora a policy só deixa apagar log com mais de 180 dias — direto no banco,
-- não depende só da tela respeitar a data escolhida. Mesmo um admin não
-- consegue apagar log recente, só através desta policy nunca vai dar certo.

begin;

drop policy if exists "admin apaga audit_logs antigos" on audit_logs;
create policy "admin apaga audit_logs antigos" on audit_logs for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
  and at < (extract(epoch from now() - interval '180 days') * 1000)
);

commit;
