# Provisionar um cliente novo

Checklist de ponta a ponta pra colocar um cliente novo no ar. Arquitetura é
"uma instância por cliente" — cada linha abaixo roda uma vez por cliente
vendido, num projeto Supabase novo + um serviço novo no Render.

Marque cada item conforme for. **Não considere o ambiente pronto pra uso real
até o Passo 6 (validação) passar limpo** — foi pular direto pra "parece que
funcionou" que deixou o bucket de anexos faltando sem ninguém notar no
primeiro cliente (ver Passo 3).

## 1. Projeto Supabase

1. Criar o projeto novo no Supabase (org da VMO).
2. SQL Editor → colar e rodar `supabase/schema.sql` inteiro.
3. Rodar, em ordem, cada arquivo de `supabase/migrations/` (ver o README
   daquela pasta pra saber quais têm efeito num projeto novo).
4. Se alguma tabela "não for encontrada" logo depois de rodar o schema
   (`PGRST205 — Could not find the table in the schema cache`): rodar
   `NOTIFY pgrst, 'reload schema';` ou rodar o `schema.sql` de novo (é
   idempotente).

## 2. Usuário admin

1. Authentication → Add user → criar o login do administrador do cliente.
2. Conferir se apareceu uma linha em `profiles` pra esse usuário. Se não
   apareceu (usuário criado antes do gatilho `handle_new_user` existir),
   inserir manualmente: `insert into public.profiles (id, name, role, ativo)
   values ('<uid>', '<nome>', 'admin', true);`
3. Se a linha já existe mas veio com `role='user'`/`ativo=false` (padrão do
   gatilho), promover: `update profiles set role='admin', ativo=true where id
   = '<uid>';`

## 3. Storage — bucket "anexos"

**Este passo já foi esquecido uma vez** (cliente-piloto Botti Pharma, set/2026):
o restante do provisionamento rodou certinho, mas ninguém reparou que o
bucket não tinha sido criado até um upload de verdade falhar com
`"Bucket not found"`. `schema.sql` cria o bucket junto com o resto, mas se
esse projeto foi provisionado a partir de uma versão do `schema.sql` anterior
à seção "Storage — bucket anexos", ele não existe — e nada na tela avisa
disso até alguém tentar anexar um arquivo.

Depois de rodar `schema.sql` (Passo 1), **confirme que o bucket existe** por
um destes dois caminhos:

- Dashboard → Storage → deve aparecer um bucket **anexos** (privado, limite
  50 MB). Se não aparecer, rode de novo só o bloco `-- Storage — bucket
  "anexos"` do `schema.sql` (é idempotente, seguro rodar sozinho).
- Ou deixe a confirmação pro Passo 6 (a suíte de teste cobre isso e falha
  alto se o bucket estiver faltando).

## 3b. URL de redirecionamento — "esqueci minha senha"

O login tem recuperação de senha própria (link por e-mail, sem depender do
painel do Supabase). Pra funcionar, o Supabase precisa saber que a URL de
redefinição é confiável:

1. Authentication → URL Configuration.
2. **Site URL**: a URL do serviço no Render desse cliente (ex.:
   `https://nome-do-cliente.onrender.com`).
3. **Redirect URLs**: adicionar `<Site URL>/redefinir-senha` (e, se for
   testar localmente, `http://localhost:5173/redefinir-senha` também).

Sem isso, o link do e-mail de redefinição é rejeitado pelo Supabase mesmo
que o e-mail chegue normalmente.

## 4. Segurança — desligar acesso público

**Obrigatório, não opcional.** Todo projeto Supabase novo nasce com
autocadastro público habilitado. Como a URL + anon key ficam públicas no
bundle JS por design, deixar isso ligado permite que qualquer pessoa na
internet crie conta e (por causa da coluna `ativo`, ver Passo 2) não
consiga ler dado de negócio — mas ainda seria uma porta de entrada
desnecessária.

1. Authentication → Providers → Email → desligar **"Allow new users to
   sign up"**.
2. Authentication → Settings → conferir que **"Enable anonymous sign-ins"**
   está desligado (vem desligado por padrão, mas confira).

## 5. Render

1. Criar o serviço novo apontando pro mesmo repositório GitHub, branch
   `master`, `autoDeploy: true` (usa o `render.yaml` do repo).
2. Configurar as env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   **antes** do primeiro deploy terminar — se o deploy disparado pela
   criação do serviço terminar antes de salvar as env vars, é preciso fazer
   "Manual Deploy → Deploy latest commit" de novo depois de salvar.

## 6. Validar de ponta a ponta (não pule)

A suíte de testes E2E em `scripts/` (ver `scripts/README.md`) usa o sistema
como um usuário usaria e confere o resultado direto no banco — é o jeito mais
confiável de saber se o provisionamento pegou de verdade, incluindo o bucket
do Passo 3. Rodar pelo menos:

```powershell
$env:CONFIRMO_TESTE="sim"; $env:TEST_LOGIN="<admin do cliente novo>"; $env:TEST_SENHA="<senha>"
node scripts/_gerar-planilha.js
node scripts/_t1-auth.js               # login, sessão, RLS básico
node scripts/_t2-licitacoes.js         # cria a licitação usada pelos próximos
node scripts/_t5-anexos-atas-empresa.js  # anexos — é aqui que o bucket falha se estiver faltando
node scripts/_t7-seguranca-limites.js  # RLS, cadastro público, login anônimo, XSS
node scripts/_limpar-teste.js          # remove os dados de teste criados
```

Se sobrar tempo, rode a suíte inteira (lista completa em
`scripts/README.md`). Só considere o ambiente pronto quando isso rodar sem
FALHA nenhuma.
