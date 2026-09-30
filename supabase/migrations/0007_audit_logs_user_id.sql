-- ============================================================
-- 0007_audit_logs_user_id
-- ============================================================
--
-- Como rodar: Supabase -> SQL Editor -> cola este arquivo inteiro -> Run.
-- Idempotente — rodar de novo não estraga nada.
--
-- O que este script corrige: a coluna `"user"` de audit_logs é texto livre
-- que o PRÓPRIO NAVEGADOR manda no insert (vem de
-- `localStorage.getItem('user_name')`) — qualquer usuário ativo consegue
-- forjar esse texto (ou inserir direto via API) e a tela /admin/audit, que
-- existe justamente pra investigar quem fez o quê, passa a exibir atribuição
-- falsa. A RLS de insert só checava `membro_ativo()`, nunca vinculou o texto
-- a `auth.uid()`.
--
-- Agora cada linha grava `user_id` preenchido pelo próprio Postgres
-- (`default auth.uid()`), nunca pelo texto que o cliente manda — e a RLS
-- rejeita qualquer tentativa de gravar um `user_id` diferente do próprio
-- usuário autenticado. A leitura (utils/audit.ts) passa a resolver o nome via
-- join com `profiles`, só caindo pro texto antigo em linhas gravadas antes
-- desta migração (onde `user_id` fica null).
--
-- Também adiciona o índice em `at` que faltava: a tela de auditoria (já
-- paginada) ordena por essa coluna a cada carregamento, e sem índice isso
-- força ordenar a tabela inteira toda vez.

begin;

alter table audit_logs add column if not exists user_id uuid references profiles(id) on delete set null default auth.uid();

create index if not exists audit_logs_at_idx on audit_logs (at desc);

drop policy if exists "membro ativo insere em audit_logs" on audit_logs;
create policy "membro ativo insere em audit_logs" on audit_logs for insert with check (
  public.membro_ativo() and (user_id is null or user_id = auth.uid())
);

commit;
