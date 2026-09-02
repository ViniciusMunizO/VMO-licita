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
node scripts/_t5-anexos-atas-empresa.js # anexos, atas, contratantes, empresa/bancos
node scripts/_t6-relatorios-docs.js    # 4 relatórios, filtros, PDFs, declarações
node scripts/_t7-seguranca-limites.js  # RLS, privilégios, XSS, casos extremos
node scripts/_t8-proposta-banco.js     # escolha da conta bancária ao emitir proposta
node scripts/_t9-pdf-logo.js           # cabeçalho dos PDFs (logo da empresa, sem marca do sistema)
node scripts/_t10-dashboard.js         # cards do painel (próximas / aguardando resultado)
```

Rodar a suíte inteira (bash):

```bash
for s in _t1-auth _t2-licitacoes _t3-itens _t4-operacoes-item \
         _t5-anexos-atas-empresa _t6-relatorios-docs _t7-seguranca-limites \
         _t8-proposta-banco _t9-pdf-logo _t10-dashboard; do
  node scripts/$s.js
done
```

As suítes 3 a 9 dependem da licitação criada pela suíte 2 (o código fica em
`_codigo-teste.txt`), então rode na ordem. A suíte 10 é independente: cria e
apaga os próprios dados.

Para apontar pra produção em vez do dev local: `$env:TEST_BASE="https://..."`.

## Trocar a logo dos PDFs para outro cliente

Os PDFs usam `src/assets/logo-botti.png` (a mesma logo que aparece no topo do
sistema). Para um cliente novo, basta substituir esse arquivo pela logo dele —
a proporção é lida da própria imagem, não precisa ajustar medida nenhuma no
código. A logo deve ser escura, porque o cabeçalho do PDF é claro.

Se a imagem tiver fundo transparente, tudo bem: antes de entrar no PDF ela é
desenhada sobre branco e convertida pra JPEG, justamente pra não depender de
como cada visualizador trata transparência (alguns pintam de preto).

## Limpeza

`node scripts/_limpar-teste.js` remove as licitações de teste que sobrarem
(as que têm número de pregão começando com `TESTE-E2E`).
