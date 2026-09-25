-- ============================================================
-- 0004_documentos_empresa
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script faz: cria `documentos_empresa` (certidões/documentos da
-- empresa com data de validade, fora do escopo de uma licitação específica),
-- com RLS igual às demais tabelas de negócio e `updated_at` automático.
-- Precisa que `0001_attachments_e_updated_at.sql` já tenha rodado nesse
-- ambiente (é de lá que vem `public.tocar_updated_at()`).

begin;

create table if not exists documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  numero text,
  "dataEmissao" text,
  "dataValidade" text,
  reutilizavel boolean not null default true,
  observacao text,
  path text,
  filename text,
  mime text,
  size bigint,
  "criadoPor" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table documentos_empresa enable row level security;

drop policy if exists "membro ativo tudo em documentos_empresa" on documentos_empresa;
create policy "membro ativo tudo em documentos_empresa" on documentos_empresa for all using (public.membro_ativo()) with check (public.membro_ativo());

drop trigger if exists documentos_empresa_updated_at on documentos_empresa;
create trigger documentos_empresa_updated_at before update on documentos_empresa
  for each row execute function public.tocar_updated_at();

commit;
