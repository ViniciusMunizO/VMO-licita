-- ============================================================
-- 0006_empresa_info_somente_admin
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: até aqui, qualquer usuário ativo podia gravar em
-- `empresa_info` (CNPJ, conta bancária, dados do representante legal) — a
-- tela já foi restrita a admin, mas sem isso alguém ainda conseguiria
-- alterar chamando a API do Supabase direto, sem passar pela tela. Agora só
-- admin ativo grava; qualquer membro ativo continua podendo ler (proposta e
-- declaração usam esse dado pra qualquer usuário que emite, não só admin).

begin;

drop policy if exists "autenticado tudo em empresa_info" on empresa_info;
drop policy if exists "membro ativo tudo em empresa_info" on empresa_info;
drop policy if exists "membro ativo le empresa_info" on empresa_info;
drop policy if exists "admin grava empresa_info" on empresa_info;
drop policy if exists "admin atualiza empresa_info" on empresa_info;

create policy "membro ativo le empresa_info" on empresa_info for select using (public.membro_ativo());

create policy "admin grava empresa_info" on empresa_info for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

create policy "admin atualiza empresa_info" on empresa_info for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
) with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

commit;
