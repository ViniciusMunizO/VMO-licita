-- ============================================================
-- 0005_prazos_recurso_impugnacao
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: adiciona `dataLimiteRecurso` e
-- `dataLimiteImpugnacao` em `licitacoes` — datas de verdade (não texto
-- livre) usadas pelo alerta de prazos no Dashboard.

begin;

alter table licitacoes add column if not exists "dataLimiteRecurso" text;
alter table licitacoes add column if not exists "dataLimiteImpugnacao" text;

commit;
