-- ============================================================
-- 0010_metas
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: cria `metas`, uma linha por mês (formato "YYYY-MM")
-- com o valor de venda e a taxa de sucesso que a empresa quer bater naquele
-- período — comparado com o realizado no card "Meta do mês" do Dashboard.
-- Só admin define a meta; qualquer membro ativo só lê (mesmo padrão de
-- `empresa_info`).

begin;

create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  periodo text not null unique,
  "valorAlvoGanho" numeric,
  "taxaAlvoSucesso" numeric,
  "atualizadoEm" bigint,
  "atualizadoPor" uuid references profiles(id) on delete set null default auth.uid()
);

alter table metas enable row level security;

drop policy if exists "membro ativo le metas" on metas;
create policy "membro ativo le metas" on metas for select using (public.membro_ativo());

drop policy if exists "admin grava metas" on metas;
create policy "admin grava metas" on metas for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

drop policy if exists "admin atualiza metas" on metas;
create policy "admin atualiza metas" on metas for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

commit;
