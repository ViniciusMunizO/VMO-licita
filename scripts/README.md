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
```

Rodar a suíte inteira (bash):

```bash
for s in _t1-auth _t2-licitacoes _t3-itens _t4-operacoes-item \
         _t5-anexos-atas-empresa _t6-relatorios-docs _t7-seguranca-limites \
         _t8-proposta-banco _t9-pdf-logo; do
  node scripts/$s.js
done
```

As suítes 3 a 9 dependem da licitação criada pela suíte 2 (o código fica em
`_codigo-teste.txt`), então rode na ordem.

Para apontar pra produção em vez do dev local: `$env:TEST_BASE="https://..."`.

## Trocar a logo dos PDFs para outro cliente

Os PDFs usam `src/assets/logo-botti.png` (a mesma logo que aparece no topo do
sistema). Para um cliente novo: substitua esse arquivo pela logo dele e ajuste
`LOGO_ASPECTO` em [`src/utils/pdf.ts`](../src/utils/pdf.ts) com a proporção
(largura ÷ altura) da imagem nova. A logo deve ser escura sobre fundo
transparente — o cabeçalho do PDF é claro.

## Limpeza

`node scripts/_limpar-teste.js` remove as licitações de teste que sobrarem
(as que têm número de pregão começando com `TESTE-E2E`).
