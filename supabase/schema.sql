-- Licita-VMO — schema Postgres/Supabase
--
-- Script de provisionamento: roda inteiro, uma vez, num projeto Supabase
-- novo (Dashboard -> SQL Editor -> cola e executa). Depois dele, rode os
-- arquivos de `supabase/migrations/` em ordem numérica.
--
-- Cada cliente vendido ganha seu próprio projeto Supabase rodando esse
-- mesmo script — não é uma plataforma multi-tenant, é "uma instância por
-- cliente" (decisão já tomada).
--
-- Nomes de coluna em camelCase (entre aspas) de propósito: o app já usa
-- esses nomes exatos em centenas de lugares (`licitacao.numeroPregao`,
-- `item.valorGanho` etc.) — manter o mesmo nome do banco até a tela evita
-- uma camada de tradução snake_case<->camelCase que não traria benefício
-- nenhum aqui (não é um banco compartilhado por várias equipes com convenções
-- próprias, é dedicado a este app).

-- ============================================================
-- profiles — papel do usuário (admin/moderador/user), 1:1 com auth.users
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'user' check (role in ('admin','moderador','user')),
  -- Nasce sempre `false`: um usuário só enxerga/mexe nos dados de negócio
  -- depois que o admin ativa manualmente (dashboard ou SQL Editor). Isso é
  -- defesa em profundidade — mesmo que o cadastro público do Supabase seja
  -- religado por engano no futuro, uma conta nova sozinha não dá acesso a
  -- nada, porque as políticas abaixo checam `ativo`, não só "autenticado".
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);
-- Migração para quem já tinha essa tabela sem a coluna (projeto provisionado
-- antes dessa mudança): adiciona sem apagar nada.
alter table profiles add column if not exists ativo boolean not null default false;

-- ============================================================
-- contratantes
-- ============================================================
create table if not exists contratantes (
  codigo text primary key,
  nome text not null,
  uf text not null
);

-- ============================================================
-- empresa_info — linha única com os dados da empresa (cabeçalho de
-- proposta/declarações). A checagem abaixo impede criar uma segunda linha.
-- ============================================================
create table if not exists empresa_info (
  id boolean primary key default true check (id),
  "razaoSocial" text,
  cnpj text,
  "inscricaoEstadual" text,
  "inscricaoMunicipal" text,
  endereco text,
  cep text,
  cidade text,
  uf text,
  telefone text,
  email text,
  -- Lista de contas bancárias: [{ id, apelido, banco, agencia, conta }, ...].
  -- Substituiu as colunas soltas banco/agencia/conta pra permitir cadastrar
  -- mais de uma conta e escolher qual usar em cada licitação
  -- (licitacoes."bancoId" guarda o id da conta escolhida).
  bancos jsonb not null default '[]',
  "representanteNome" text,
  "representanteCargo" text,
  "representanteCpf" text,
  "representanteRg" text,
  "declaracoesProposta" text,
  updated_at timestamptz not null default now()
);
alter table empresa_info add column if not exists bancos jsonb not null default '[]';
alter table empresa_info drop column if exists banco;
alter table empresa_info drop column if exists agencia;
alter table empresa_info drop column if exists conta;

-- ============================================================
-- documentos_empresa — certidões/documentos da empresa com data de validade
-- (CND, CRF do FGTS, contrato social, atestados etc.), fora do escopo de
-- uma licitação específica. Dois usos: alertar no Dashboard quando algo
-- está vencendo, e servir de "cofre" pra anexar de novo em cada licitação
-- nova sem precisar re-subir o mesmo arquivo toda vez.
-- ============================================================
create table if not exists documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  numero text,
  "dataEmissao" text,
  -- Vazio = documento sem validade (ex.: contrato social). Só entra no
  -- alerta de vencimento quando preenchida.
  "dataValidade" text,
  -- Aparece como opção em "Anexar da empresa" na licitação quando true.
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

-- ============================================================
-- licitacoes
-- ============================================================
create table if not exists licitacoes (
  codigo bigint generated always as identity primary key,
  ano integer,
  contratado text,
  contratante jsonb,
  "numeroPregao" text,
  "numeroProcesso" text,
  portal text,
  "tipoObjeto" text,
  "objetoLicitacao" text,
  status text,
  "dataCredenciamento" text,
  "horaCredenciamento" text,
  "dataLicitacao" text,
  "horaLicitacao" text,
  "tipoDisputa" text,
  "definJulgamento" text,
  "prazoValidade" text,
  "prazoEntrega" text,
  "localEntrega" text,
  "prazoPagamento" text,
  "prazoGarantia" text,
  "vigenciaContrato" text,
  habilitacao jsonb,
  "lancadoNoKralen" boolean not null default false,
  -- Qual conta bancária (id dentro de empresa_info.bancos) usar nos
  -- documentos (Proposta/Declarações) desta licitação. Null = usa a
  -- primeira conta cadastrada.
  "bancoId" text,
  -- Data-limite (YYYY-MM-DD) pra apresentar recurso/impugnação, se houver.
  -- Diferente de "prazoValidade" (texto livre, cláusula contratual) — aqui é
  -- data de verdade, usada pro alerta do Dashboard. Vazio = não se aplica.
  "dataLimiteRecurso" text,
  "dataLimiteImpugnacao" text,
  "criadoPor" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table licitacoes add column if not exists "bancoId" text;
alter table licitacoes add column if not exists "dataLimiteRecurso" text;
alter table licitacoes add column if not exists "dataLimiteImpugnacao" text;

-- ============================================================
-- items — uma linha por item de licitação (não mais um array só). É essa
-- granularidade que permite dois colaboradores editarem itens diferentes da
-- mesma licitação ao mesmo tempo sem um sobrescrever o outro.
-- ============================================================
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  item text,
  lote text,
  "codKralen" text,
  descricao text,
  unidade text,
  quantidade numeric,
  marca text,
  "origemCotacao" text,
  "valorCusto" numeric,
  "totalCusto" numeric,
  "valorUnitMinimo" numeric,
  "valorTotalMinimo" numeric,
  "valorUnitMunicipio" numeric,
  "valorTotalMunicipio" numeric,
  status text,
  vencedor boolean not null default false,
  "valorGanho" text,
  desclassificado boolean not null default false,
  "motivoDesclassificacao" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_licitacao_idx on items ("licitacaoCodigo");

-- ============================================================
-- entregas — controle de entrega pós-vitória: cada remessa entregue
-- (quantidade, data, nota fiscal) por item vencedor, comparada com a
-- quantidade contratada na tela de detalhe da licitação.
-- ============================================================
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

-- Migração pra quem já tinha a tabela no modelo antigo de planilha (projeto
-- já provisionado antes da troca pro "02. MODELO DE COTAÇÃO"): adiciona as
-- colunas novas e remove as que não existem mais nesse modelo.
alter table items add column if not exists "codKralen" text;
alter table items add column if not exists "origemCotacao" text;
alter table items add column if not exists "valorUnitMinimo" numeric;
alter table items add column if not exists "valorTotalMinimo" numeric;
alter table items add column if not exists "valorUnitMunicipio" numeric;
alter table items add column if not exists "valorTotalMunicipio" numeric;
alter table items drop column if exists "valorEdital";
alter table items drop column if exists "totalEdital";
alter table items drop column if exists apresentacao;
alter table items drop column if exists anvisa;
alter table items drop column if exists tx;
alter table items drop column if exists "custoUnitario";
alter table items drop column if exists "custoCaixa";

-- ============================================================
-- attachments
-- ============================================================
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  name text,
  filename text,
  -- `data` é o modelo antigo: o arquivo inteiro em base64 dentro da linha.
  -- Continua aqui só pelos anexos gravados antes da migração pro Storage —
  -- anexo novo nasce com `path` preenchido e `data` nulo. Depois de rodar
  -- `scripts/migrar-anexos-storage.js` em todos os ambientes, esta coluna
  -- pode ser removida.
  data text,
  -- Caminho do objeto no bucket "anexos" (ex.: licitacoes/42/uuid-edital.pdf).
  path text,
  mime text,
  size bigint,
  date timestamptz not null default now()
);
create index if not exists attachments_licitacao_idx on attachments ("licitacaoCodigo");
alter table attachments add column if not exists path text;
alter table attachments add column if not exists mime text;
alter table attachments add column if not exists size bigint;

-- ============================================================
-- atas (atas de registro de preços / contratos)
-- ============================================================
create table if not exists atas (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  tipo text,
  numero text,
  "inicioVigencia" text,
  "fimVigencia" text,
  meses integer,
  observacoes text,
  -- { name, path, mime, size } no modelo novo; { name, data } (base64) nas
  -- atas criadas antes da migração pro Storage.
  anexo jsonb,
  "criadoEm" bigint,
  "criadoPor" text
);
create index if not exists atas_licitacao_idx on atas ("licitacaoCodigo");

-- ============================================================
-- propostas_emitidas — snapshot automático dos itens/valores no momento de
-- cada emissão da Proposta de Preços em PDF. Sem isto, se um item mudasse de
-- valor depois de emitida a proposta, não sobrava registro do que foi
-- realmente enviado ao órgão — risco jurídico/operacional real em pregão.
-- É histórico (como audit_logs): só insert, nunca update/delete.
-- ============================================================
create table if not exists propostas_emitidas (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  snapshot jsonb not null,
  "emitidoPor" uuid references profiles(id) on delete set null default auth.uid(),
  "emitidoEm" bigint not null
);
create index if not exists propostas_emitidas_licitacao_idx on propostas_emitidas ("licitacaoCodigo");

-- ============================================================
-- metas — uma linha por mês ("YYYY-MM") com o alvo de valor ganho e taxa de
-- sucesso, comparado com o realizado no card "Meta do mês" do Dashboard.
-- ============================================================
create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  periodo text not null unique,
  "valorAlvoGanho" numeric,
  "taxaAlvoSucesso" numeric,
  "atualizadoEm" bigint,
  "atualizadoPor" uuid references profiles(id) on delete set null default auth.uid()
);

-- ============================================================
-- audit_logs
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  at bigint not null,
  -- Texto livre, mantido só como legado/fallback de exibição. Nunca é a
  -- fonte de verdade de quem fez a ação — isso é `user_id` (auth.uid()),
  -- porque texto vindo do cliente é forjável (localStorage, API direta).
  "user" text,
  user_id uuid references profiles(id) on delete set null default auth.uid(),
  action text not null,
  payload jsonb
);

create index if not exists audit_logs_at_idx on audit_logs (at desc);

-- ============================================================
-- Row Level Security — como cada projeto Supabase é dedicado a um cliente
-- só, a regra de base é simples: quem está autenticado E ativo usa o sistema
-- inteiro. Não existe lógica de tenant/empresa aqui de propósito.
-- ============================================================
alter table profiles enable row level security;
alter table contratantes enable row level security;
alter table empresa_info enable row level security;
alter table documentos_empresa enable row level security;
alter table licitacoes enable row level security;
alter table items enable row level security;
alter table entregas enable row level security;
alter table attachments enable row level security;
alter table atas enable row level security;
alter table propostas_emitidas enable row level security;
alter table metas enable row level security;
alter table audit_logs enable row level security;

-- Função auxiliar: só quem tem profiles.ativo = true passa. SECURITY DEFINER
-- pra não cair em recursão de RLS — ela lê `profiles` como dono da função
-- (que não é afetado pelas próprias políticas da tabela), então pode ser
-- usada dentro das políticas de `profiles` sem loop infinito.
create or replace function public.membro_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.ativo from public.profiles p where p.id = auth.uid()), false);
$$;

-- ============================================================
-- Storage — bucket "anexos"
--
-- Guarda o arquivo de verdade (edital, ata assinada, comprovante) fora do
-- Postgres. Antes o conteúdo ia em base64 dentro da própria linha, o que
-- inflava o arquivo em ~33% e fazia a tela de detalhe baixar todos os anexos
-- só pra escrever os nomes na lista.
--
-- O bucket é privado de propósito: documento de licitação não é público, e
-- link público não expira nem dá pra revogar. O app abre cada arquivo com
-- URL assinada de curta duração, gerada só pra quem está logado e ativo.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800) -- 50 MB
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Mesma regra das tabelas de negócio: quem está autenticado E ativo usa o
-- bucket inteiro. `membro_ativo()` já existe acima e é SECURITY DEFINER.
drop policy if exists "membro ativo le anexos" on storage.objects;
drop policy if exists "membro ativo grava anexos" on storage.objects;
drop policy if exists "membro ativo atualiza anexos" on storage.objects;
drop policy if exists "membro ativo apaga anexos" on storage.objects;
create policy "membro ativo le anexos" on storage.objects for select
  using (bucket_id = 'anexos' and public.membro_ativo());
create policy "membro ativo grava anexos" on storage.objects for insert
  with check (bucket_id = 'anexos' and public.membro_ativo());
create policy "membro ativo atualiza anexos" on storage.objects for update
  using (bucket_id = 'anexos' and public.membro_ativo())
  with check (bucket_id = 'anexos' and public.membro_ativo());
create policy "membro ativo apaga anexos" on storage.objects for delete
  using (bucket_id = 'anexos' and public.membro_ativo());

drop policy if exists "autenticado le/grava profiles" on profiles;
drop policy if exists "usuario ve o proprio profile" on profiles;
drop policy if exists "membro ativo ve todos os profiles" on profiles;
drop policy if exists "autenticado atualiza o proprio profile" on profiles;
-- Ver o próprio perfil não depende de já estar ativo (senão o app não
-- consegue nem mostrar "sua conta ainda não foi liberada" depois do login).
create policy "usuario ve o proprio profile" on profiles for select using (auth.uid() = id);
-- Ver a lista de colegas (tela Usuários) já exige estar ativo.
create policy "membro ativo ve todos os profiles" on profiles for select using (public.membro_ativo());
-- Usuário pode editar o próprio nome, mas nunca a própria `role` nem o
-- próprio `ativo` — o subselect aqui lê o valor já commitado (de antes desse
-- update), então travar role/ativo ao valor atual impede autopromoção via
-- API direta. Só o admin muda role/ativo de alguém, fora do app (dashboard
-- ou SQL Editor).
create policy "usuario atualiza o proprio profile" on profiles for update using (auth.uid() = id) with check (
  auth.uid() = id
  and role = (select p2.role from profiles p2 where p2.id = auth.uid())
  and ativo = (select p2.ativo from profiles p2 where p2.id = auth.uid())
);

drop policy if exists "autenticado tudo em contratantes" on contratantes;
drop policy if exists "membro ativo tudo em contratantes" on contratantes;
create policy "membro ativo tudo em contratantes" on contratantes for all using (public.membro_ativo()) with check (public.membro_ativo());

-- Qualquer membro ativo lê (proposta/declaração precisam disso pra qualquer
-- usuário que emite, não só admin), mas só admin grava — dado sensível
-- (CNPJ, conta bancária, dados do representante legal).
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

drop policy if exists "membro ativo tudo em documentos_empresa" on documentos_empresa;
create policy "membro ativo tudo em documentos_empresa" on documentos_empresa for all using (public.membro_ativo()) with check (public.membro_ativo());

drop policy if exists "autenticado tudo em licitacoes" on licitacoes;
drop policy if exists "membro ativo tudo em licitacoes" on licitacoes;
create policy "membro ativo tudo em licitacoes" on licitacoes for all using (public.membro_ativo()) with check (public.membro_ativo());

drop policy if exists "autenticado tudo em items" on items;
drop policy if exists "membro ativo tudo em items" on items;
create policy "membro ativo tudo em items" on items for all using (public.membro_ativo()) with check (public.membro_ativo());

drop policy if exists "membro ativo tudo em entregas" on entregas;
create policy "membro ativo tudo em entregas" on entregas for all using (public.membro_ativo()) with check (public.membro_ativo());

drop policy if exists "autenticado tudo em attachments" on attachments;
drop policy if exists "membro ativo tudo em attachments" on attachments;
create policy "membro ativo tudo em attachments" on attachments for all using (public.membro_ativo()) with check (public.membro_ativo());

drop policy if exists "autenticado tudo em atas" on atas;
drop policy if exists "membro ativo tudo em atas" on atas;
create policy "membro ativo tudo em atas" on atas for all using (public.membro_ativo()) with check (public.membro_ativo());

-- propostas_emitidas: mesmo espírito de audit_logs — só insert (histórico,
-- nunca se edita/apaga). `emitido_por` segue o mesmo padrão anti-forjamento.
drop policy if exists "membro ativo le/grava propostas_emitidas" on propostas_emitidas;
create policy "membro ativo le/grava propostas_emitidas" on propostas_emitidas for select using (public.membro_ativo());
drop policy if exists "membro ativo insere propostas_emitidas" on propostas_emitidas;
create policy "membro ativo insere propostas_emitidas" on propostas_emitidas for insert with check (
  public.membro_ativo() and ("emitidoPor" is null or "emitidoPor" = auth.uid())
);

-- metas: mesmo padrão de empresa_info — qualquer membro ativo lê, só admin
-- grava (definir meta é decisão de gestão, não operação do dia a dia).
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

-- audit_logs é só "for insert" + "for select restrito a admin ativo" de
-- propósito (nunca "for all"): o app só precisa gravar e o admin ler — se
-- qualquer autenticado pudesse update/delete, a trilha de auditoria vira
-- apagável por quem ela audita, perdendo a função de registro confiável. Sem
-- policy de update/delete: RLS nega por padrão (ninguém altera/apaga, nem
-- pela API).
drop policy if exists "autenticado tudo em audit_logs" on audit_logs;
drop policy if exists "autenticado insere em audit_logs" on audit_logs;
drop policy if exists "membro ativo insere em audit_logs" on audit_logs;
drop policy if exists "admin le audit_logs" on audit_logs;
-- `user_id is null or user_id = auth.uid()`: o default já preenche com o
-- próprio usuário quando a coluna vem omitida do insert, então isso só
-- importa se alguém tentar forçar um `user_id` de outra pessoa na mão.
create policy "membro ativo insere em audit_logs" on audit_logs for insert with check (
  public.membro_ativo() and (user_id is null or user_id = auth.uid())
);
-- Retenção/LGPD: admin pode apagar logs antigos (a tela sempre exporta pra
-- Excel antes de apagar). Sem esta policy, RLS bloqueia delete de todo mundo.
-- O piso de 180 dias é reforçado aqui, não só na tela — nem um admin
-- consegue apagar log recente por essa via, propositalmente (ver 0012).
drop policy if exists "admin apaga audit_logs antigos" on audit_logs;
create policy "admin apaga audit_logs antigos" on audit_logs for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
  and at < (extract(epoch from now() - interval '180 days') * 1000)
);
create policy "admin le audit_logs" on audit_logs for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.ativo = true)
);

-- ============================================================
-- Cria o profile automaticamente quando um usuário novo é criado pelo painel
-- do Supabase (Authentication -> Add user) — sem isso, ele logaria sem nome
-- nem papel definidos. Nome vem de user_metadata.name se informado no
-- cadastro; papel sempre nasce como 'user' e ativo sempre nasce como `false`
-- (o admin promove/ativa depois, editando a linha em profiles).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role, ativo)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'user', false);
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
