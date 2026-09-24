-- ============================================================
-- 0001_attachments_e_updated_at
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- É idempotente (rodar de novo não estraga nada), mas o normal é rodar uma
-- vez por ambiente.
--
-- O que este script faz:
--   1. Aplica as colunas de `attachments` que ficaram para trás
--   2. Mantém `updated_at` por trigger
--
-- Por que existe uma pasta `migrations/`: até aqui o banco era descrito só
-- pelo `schema.sql`, que provisiona um projeto do zero. Isso não registra
-- quais alterações já foram aplicadas num banco que já estava rodando — e foi
-- exatamente assim que as colunas `path`/`mime`/`size` de `attachments`
-- ficaram faltando em produção sem ninguém notar, derrubando a lista de itens
-- na tela de detalhe. O `schema.sql` continua sendo o retrato completo do
-- banco; os arquivos numerados aqui são o caminho de quem já tem dados.

begin;

-- ============================================================
-- 1. attachments — a defasagem que derrubava os itens na tela de detalhe
--
-- O sintoma não apontava pra cá: a tela de detalhe mostrava a licitação SEM
-- NENHUM item, porque a leitura dos anexos falhava junto com a dos itens no
-- mesmo `Promise.all`. A tela já foi corrigida pra não deixar uma leitura
-- derrubar a outra, mas as colunas continuam tendo que existir.
-- ============================================================
alter table attachments add column if not exists path text;
alter table attachments add column if not exists mime text;
alter table attachments add column if not exists size bigint;

-- ============================================================
-- 2. updated_at automático
--
-- As tabelas já tinham a coluna `updated_at`, mas ninguém a atualizava: o
-- valor ficava congelado na data de criação da linha. Uma função só,
-- reaproveitada por todas as tabelas que têm a coluna.
-- ============================================================
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists items_updated_at on items;
create trigger items_updated_at before update on items
  for each row execute function public.tocar_updated_at();

drop trigger if exists licitacoes_updated_at on licitacoes;
create trigger licitacoes_updated_at before update on licitacoes
  for each row execute function public.tocar_updated_at();

commit;
