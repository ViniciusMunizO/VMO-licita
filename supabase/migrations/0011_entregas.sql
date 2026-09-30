-- ============================================================
-- 0011_entregas
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: o sistema hoje para no "Ganhou" — depois disso a
-- empresa ainda cumpre a entrega de cada item vencedor, e isso não era
-- rastreado em lugar nenhum (só em texto livre na ata). Esta tabela registra
-- cada remessa entregue (quantidade, data, nota fiscal) por item, pra
-- comparar entregue x contratado na tela de detalhe da licitação.
--
-- Escopo deliberadamente menor do que "alerta de capacidade de fornecimento"
-- (que precisaria de um catálogo de produtos/estoque à parte — decisão de
-- produto maior, não entrou nesta rodada).

begin;

create table if not exists entregas (
  id uuid primary key default gen_random_uuid(),
  "itemId" uuid not null references items(id) on delete cascade,
  quantidade numeric not null,
  data text,
  "notaFiscal" text,
  observacao text,
  "criadoEm" bigint,
  "criadoPor" uuid references profiles(id) on delete set null default auth.uid()
);

create index if not exists entregas_item_idx on entregas ("itemId");

alter table entregas enable row level security;

drop policy if exists "membro ativo tudo em entregas" on entregas;
create policy "membro ativo tudo em entregas" on entregas for all using (public.membro_ativo()) with check (public.membro_ativo());

commit;
