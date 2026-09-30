# Suíte de testes end-to-end

Testes automatizados que abrem o sistema num navegador de verdade (Puppeteer),
usam a aplicação como um usuário usaria e conferem o resultado direto no banco.

## Atenção

**A suíte cria e apaga dados de verdade** no banco apontado pelo `.env` do
projeto (cria licitação de teste, importa itens, anexa arquivo, mexe na
empresa). Ela limpa o que criou ao final, mas **nunca rode apontando pra um
ambiente com dados reais de cliente.**

Por isso ela só roda com confirmação explícita por variável de ambiente.

## Como rodar

Com o servidor de desenvolvimento no ar (`npm run dev`):

```powershell
$env:CONFIRMO_TESTE="sim"
$env:TEST_LOGIN="seu@email.com"
$env:TEST_SENHA="suasenha"

node scripts/_gerar-planilha.js   # gera as planilhas de teste (uma vez)

node scripts/_t1-auth.js               # login, sessão, navegação
node scripts/_t2-licitacoes.js         # listagem, filtros, criar/editar/detalhe
node scripts/_t3-itens.js              # importação de planilha (válida e inválida)
node scripts/_t4-operacoes-item.js     # vencedor, desclassificação, cálculos, Kralen
node scripts/_t5-anexos-atas-empresa.js # anexos, atas, contratantes, empresa/bancos/documentos
node scripts/_t6-relatorios-docs.js    # 4 relatórios, filtros, PDFs, declarações
node scripts/_t7-seguranca-limites.js  # RLS, privilégios, XSS, casos extremos
node scripts/_t8-proposta-banco.js     # escolha da conta bancária ao emitir proposta
node scripts/_t9-pdf-logo.js           # cabeçalho dos PDFs (logo da empresa, sem marca do sistema)
node scripts/_t10-dashboard.js         # cards do painel (próximas / aguardando resultado)
node scripts/_t11-melhorias.js         # filtros da lista, cards novos do painel, ranking de contratantes, recuperação de senha
node scripts/_t12-features-novas.js    # versionamento de proposta, meta do mês, entregas, retenção de auditoria
```

Rodar a suíte inteira (bash):

```bash
for s in _t1-auth _t2-licitacoes _t3-itens _t4-operacoes-item \
         _t5-anexos-atas-empresa _t6-relatorios-docs _t7-seguranca-limites \
         _t8-proposta-banco _t9-pdf-logo _t10-dashboard _t11-melhorias \
         _t12-features-novas; do
  node scripts/$s.js
done
```

As suítes 3 a 9, 11 e 12 dependem da licitação criada pela suíte 2 (o código
fica em `_codigo-teste.txt`), então rode na ordem. A suíte 10 é independente:
cria e apaga os próprios dados.

Para apontar pra produção em vez do dev local: `$env:TEST_BASE="https://..."`.

## As duas logos do sistema

São duas, com papéis diferentes — não confundir:

| Arquivo | Aparece em | De quem é |
|---|---|---|
| `src/assets/logo-vmo.png` | login, navbar, tela de conta pendente | VMO Sistemas (o sistema) |
| `src/assets/logo-vmo-simbolo.png` | favicon (via `public/favicon.png`) | VMO Sistemas (o sistema) |
| `src/assets/logo-botti.png` | cabeçalho dos PDFs emitidos | a empresa que usa o sistema |

A ideia: a interface é o produto da VMO, mas os documentos emitidos são da
empresa cliente e vão pra mãos de terceiros (órgãos públicos), então levam a
marca dela.

### Trocar a logo do cliente (a dos PDFs)

Substitua `src/assets/logo-botti.png` pela logo do cliente novo. A proporção é
lida da própria imagem, não precisa ajustar medida nenhuma no código. A logo
deve ser escura, porque o cabeçalho do PDF é claro.

Se a imagem tiver fundo transparente, tudo bem: antes de entrar no PDF ela é
desenhada sobre branco e convertida pra JPEG, justamente pra não depender de
como cada visualizador trata transparência (alguns pintam de preto).

### Trocar a logo do sistema

Substitua `src/assets/logo-vmo.png` e ajuste a constante `ASPECT` em
[`src/components/Logo.tsx`](../src/components/Logo.tsx) com a proporção nova
(largura ÷ altura). Para o favicon, substitua também
`src/assets/logo-vmo-simbolo.png` e rode `node scripts/_gerar-favicon.js`.

### Cores

A paleta do sistema sai da própria logo da VMO e fica num lugar só: `:root` no
[CSS](../src/styles/index.css).

| Variável | Cor | De onde veio |
|---|---|---|
| `--color-primary` | `#0d2b30` | o escuro do "VMO" — fundo de botão, item ativo da navbar |
| `--color-secondary` | `#106069` | tom intermediário derivado — hover e degradê do login |
| `--color-accent` | `#1396a3` | o turquesa do pentágono — barras do painel, foco de campo |
| `--color-accent-claro` | `#35d0d3` | o turquesa claro do "M" — ponta do degradê da faixa |
| `--color-error` | `#EF4136` | **não é marca**: é significado (erro, perigo, desclassificação) |

Trocar a identidade visual é trocar esses quatro primeiros valores — o resto da
interface acompanha sozinho. O `--color-error` fica onde está: ele diz "deu
errado", não "somos a VMO".

Duas cores de propósito **não** saem daí:

- o `#0F1B3D` de `PrintableProposta`/`PrintableChecklist`/`PrintableDeclaracao`
  e de [`utils/pdf.ts`](../src/utils/pdf.ts) acompanha a logo do **cliente**,
  porque o documento é dele e vai assinado por ele;
- o verde/vermelho de status (`StatusBadge`) é semântico, igual ao `--color-error`.

Para conferir a paleta a olho depois de mexer nela:

```powershell
node scripts/_shot-paleta.js   # prints de login, painel e relatórios em scripts/_shots/
```

## Migração dos anexos para o Storage

Os anexos (de licitação e de ata/contrato) ficavam em base64 dentro da própria
linha do Postgres. Agora o arquivo vai pro bucket privado `anexos` do Supabase
Storage e a linha guarda só o caminho (`attachments.path`, `atas.anexo.path`).

Para um ambiente que já tem anexos gravados no modelo antigo:

1. Aplique o `supabase/schema.sql` atualizado (Dashboard -> SQL Editor). É ele
   que cria o bucket, as políticas de acesso e as colunas `path`/`mime`/`size`.
2. Rode a migração com uma conta de membro ativo:

```powershell
$env:MIGRACAO_LOGIN="admin@empresa.com"
$env:MIGRACAO_SENHA="..."

node scripts/migrar-anexos-storage.js            # simulação: só mostra o que faria
node scripts/migrar-anexos-storage.js --aplicar  # migra de verdade
```

O script é idempotente: processa só linha que ainda tem base64 e não tem
caminho, então pode ser rodado de novo depois de qualquer interrupção. Linha
que falha mantém o base64 no banco e é listada no resumo.

Enquanto a migração não roda, os dois formatos convivem — anexo antigo continua
abrindo normalmente pela tela. Depois que todos os ambientes estiverem
migrados, a coluna `attachments.data` pode ser removida.

## Limpeza

`node scripts/_limpar-teste.js` remove as licitações de teste que sobrarem
(as que têm número de pregão começando com `TESTE-E2E`).
