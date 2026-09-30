-- ============================================================
-- 0009_propostas_emitidas
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: hoje a Proposta de Preços em PDF é gerada on-demand
-- a partir dos dados atuais da licitação — se um item mudar de valor depois
-- de emitida, não sobra nenhum registro do que foi de fato enviado ao órgão.
-- Isso é risco jurídico/operacional real em pregão (divergência entre o que
-- foi proposto e o que está cadastrado hoje). Esta tabela grava um retrato
-- (snapshot) dos itens/valores/conta bancária no momento exato de cada
-- emissão, criada automaticamente — ninguém preenche isso na mão.
--
-- Segue o mesmo padrão de audit_logs: insert de quem está logado, sem
-- policy de update/delete (RLS nega por padrão) — é histórico, não se edita.

begin;

create table if not exists propostas_emitidas (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  snapshot jsonb not null,
  -- Preenchido pelo Postgres (auth.uid()), igual audit_logs.user_id — nunca
  -- texto que o cliente manda, pra não repetir a mesma forjabilidade que a
  -- migração 0007 corrigiu em audit_logs.
  "emitidoPor" uuid references profiles(id) on delete set null default auth.uid(),
  "emitidoEm" bigint not null
);

create index if not exists propostas_emitidas_licitacao_idx on propostas_emitidas ("licitacaoCodigo");

alter table propostas_emitidas enable row level security;

drop policy if exists "membro ativo le/grava propostas_emitidas" on propostas_emitidas;
create policy "membro ativo le/grava propostas_emitidas" on propostas_emitidas for select using (public.membro_ativo());

drop policy if exists "membro ativo insere propostas_emitidas" on propostas_emitidas;
create policy "membro ativo insere propostas_emitidas" on propostas_emitidas for insert with check (
  public.membro_ativo() and ("emitidoPor" is null or "emitidoPor" = auth.uid())
);

commit;
