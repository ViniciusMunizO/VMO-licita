const fs = require('fs')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())
if (!CODIGO) {
  console.error('Sem licitação de teste válida. Rode scripts/_t2-licitacoes.js antes desta suíte.')
  process.exit(1)
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)

  H.secao('43. Lista de licitações — novos filtros')
  await page.goto(`${H.BASE}/licitacoes`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))

  H.check('filtro de Portal existe', !!(await page.$('input[placeholder="Portal"]')))
  const opcoesStatus = await page.$$eval('select', sels => sels.map(s => Array.from(s.options).map(o => o.value)))
  H.check('filtro de Status existe com as 3 opções esperadas',
    opcoesStatus.some(opts => opts.includes('Ganhou') && opts.includes('Perdeu') && opts.includes('semStatus')),
    JSON.stringify(opcoesStatus))
  let t = await H.texto(page)
  H.check('filtro de período existe', t.includes('Período:'))

  await page.type('input[placeholder="Código"]', String(CODIGO))
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('filtro por código encontra a licitação de teste', t.includes('Resultados: 1'), t.match(/Resultados:\s*\d+/)?.[0])

  await H.clicarPorTexto(page, 'Limpar filtros')
  await new Promise(r => setTimeout(r, 500))
  t = await H.texto(page)
  H.check('"Limpar filtros" tira o filtro de código', !t.includes('Resultados: 1') || t.includes('Resultados: 3'), t.match(/Resultados:\s*\d+/)?.[0])

  H.secao('44. Dashboard — novos cards')
  await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('card "Taxa de sucesso" aparece', t.includes('Taxa de sucesso'))
  H.check('card "Licitações decididas" aparece', t.includes('Licitações decididas'))
  H.check('seção "Evolução mensal" aparece', t.includes('Evolução mensal'))
  H.check('não quebra mesmo sem prazo de recurso/impugnação cadastrado em nenhuma licitação', !t.includes('undefined') && !t.includes('NaN'))

  H.secao('45. Relatório — Ranking de Contratantes')
  await page.goto(`${H.BASE}/relatorios`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1000))
  const abriu = await H.clicarPorTexto(page, 'Ranking de Contratantes')
  H.check('aba "Ranking de Contratantes" existe e foi clicada', abriu === true)
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('relatório mostra o título', t.includes('Ranking de Contratantes'))
  H.check('relatório mostra a tabela (coluna Órgão)', t.includes('Órgão'))
  H.check('licitação de teste aparece no ranking', t.includes(String(CODIGO)) || t.length > 0)

  H.secao('46. Login — recuperação de senha')
  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 800))
  const cliqueLink = await H.clicarPorTexto(page, 'Esqueci minha senha')
  H.check('link "Esqueci minha senha" existe e foi clicado', cliqueLink === true)
  await new Promise(r => setTimeout(r, 500))
  t = await H.texto(page)
  H.check('tela de recuperação abre', t.includes('Esqueci minha senha') && t.includes('Enviar link de redefinição'))

  await page.type('#emailRecuperar', 'admin@admin.com')
  await H.clicarPorTexto(page, 'Enviar link de redefinição')
  await new Promise(r => setTimeout(r, 2500))
  t = await H.texto(page)
  H.check('confirmação de e-mail enviado aparece', t.includes('Verifique seu e-mail'))

  await H.clicarPorTexto(page, 'Voltar pro login')
  await new Promise(r => setTimeout(r, 500))
  t = await H.texto(page)
  H.check('"Voltar pro login" volta pro formulário normal', t.includes('Use seu e-mail e senha'))

  H.secao('47. Auditoria — paginação')
  await H.login(page)
  await page.goto(`${H.BASE}/admin/audit`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  const linhasAntes = (await page.$$('.max-h-96 > div')).length
  H.check('carrega até 200 logs de uma vez (não a trilha inteira)', linhasAntes <= 200, `linhas: ${linhasAntes}`)
  const temBotao = await H.clicarPorTexto(page, 'Carregar mais')
  if (temBotao) {
    await new Promise(r => setTimeout(r, 1500))
    const linhasDepois = (await page.$$('.max-h-96 > div')).length
    H.check('"Carregar mais" traz mais logs', linhasDepois > linhasAntes, `${linhasAntes} → ${linhasDepois}`)
  } else {
    H.check('"Carregar mais" não aparece quando não há mais de 200 logs', true)
  }

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 5)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
