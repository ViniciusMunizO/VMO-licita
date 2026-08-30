-- Botti Licita — schema Postgres/Supabase
--
-- Script de provisionamento: roda inteiro, uma vez, num projeto Supabase
-- novo (Dashboard -> SQL Editor -> cola e executa). Cada cliente vendido
-- ganha seu próprio projeto Supabase rodando esse mesmo script — não é uma
-- plataforma multi-tenant, é "uma instância por cliente" (decisão já tomada).
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
  created_at timestamptz not null default now()
);

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
  banco text,
  agencia text,
  conta text,
  "representanteNome" text,
  "representanteCargo" text,
  "representanteCpf" text,
  "representanteRg" text,
  "declaracoesProposta" text,
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
  "criadoPor" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  descricao text,
  unidade text,
  quantidade numeric,
  "valorEdital" numeric,
  "totalEdital" numeric,
  marca text,
  apresentacao text,
  anvisa text,
  "valorCusto" numeric,
  tx numeric,
  "custoUnitario" numeric,
  "totalCusto" numeric,
  "custoCaixa" numeric,
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
-- attachments
-- ============================================================
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  "licitacaoCodigo" bigint not null references licitacoes(codigo) on delete cascade,
  name text,
  filename text,
  data text, -- base64 (data URI) — igual ao que já era guardado hoje
  date timestamptz not null default now()
);
create index if not exists attachments_licitacao_idx on attachments ("licitacaoCodigo");

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
  anexo jsonb,
  "criadoEm" bigint,
  "criadoPor" text
);
create index if not exists atas_licitacao_idx on atas ("licitacaoCodigo");

-- ============================================================
-- audit_logs
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  at bigint not null,
  "user" text,
  action text not null,
  payload jsonb
);

-- ============================================================
-- Row Level Security — como cada projeto Supabase é dedicado a um cliente
-- só, a regra é simples: quem está autenticado usa o sistema inteiro. Não
-- existe lógica de tenant/empresa aqui de propósito.
-- ============================================================
alter table profiles enable row level security;
alter table contratantes enable row level security;
alter table empresa_info enable row level security;
alter table licitacoes enable row level security;
alter table items enable row level security;
alter table attachments enable row level security;
alter table atas enable row level security;
alter table audit_logs enable row level security;

create policy "autenticado le/grava profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "autenticado atualiza o proprio profile" on profiles for update using (auth.uid() = id);

create policy "autenticado tudo em contratantes" on contratantes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "autenticado tudo em empresa_info" on empresa_info for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "autenticado tudo em licitacoes" on licitacoes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "autenticado tudo em items" on items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "autenticado tudo em attachments" on attachments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "autenticado tudo em atas" on atas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- audit_logs é só "for insert" + "for select restrito a admin" de propósito
-- (nunca "for all"): o app só precisa gravar e o admin ler — se qualquer
-- autenticado pudesse update/delete, a trilha de auditoria vira apagável por
-- quem ela audita, perdendo a função de registro confiável. Sem policy de
-- update/delete: RLS nega por padrão (ninguém altera/apaga, nem pela API).
create policy "autenticado insere em audit_logs" on audit_logs for insert with check (auth.role() = 'authenticated');
create policy "admin le audit_logs" on audit_logs for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ============================================================
-- Cria o profile automaticamente quando um usuário novo é criado pelo painel
-- do Supabase (Authentication -> Add user) — sem isso, ele logaria sem nome
-- nem papel definidos. Nome vem de user_metadata.name se informado no
-- cadastro; papel sempre nasce como 'user' (o admin promove depois, se for
-- o caso, editando a linha em profiles).
-- ============================================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
