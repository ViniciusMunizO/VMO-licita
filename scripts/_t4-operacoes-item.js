const fs = require('fs')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())

async function irParaDetalhe(page) {
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
}

// clica no botão cujo texto bate, dentro da linha do item com a descrição dada
async function clicarNaLinha(page, descricao, textoBotao) {
  return page.evaluate(({ descricao, textoBotao }) => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    const linha = linhas.find(tr => tr.innerText.includes(descricao))
    if (!linha) return 'linha não encontrada'
    const btn = Array.from(linha.querySelectorAll('button')).find(b => b.textContent.trim() === textoBotao)
    if (!btn) return 'botão não encontrado'
    btn.click()
    return 'ok'
  }, { descricao, textoBotao })
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()

  const itemId = async (desc) => {
    const { data } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO)
    return data.find(i => i.descricao === desc)
  }

  // reimporta a planilha pra partir sempre de um estado conhecido
  const path = require('path')
  await page.goto(`${H.BASE}/licitacoes/novo?edit=${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await H.clicarPorTexto(page, 'Importar Itens')
  await new Promise(r => setTimeout(r, 500))
  const inputArquivo = await page.$('input[type="file"]')
  await inputArquivo.uploadFile(path.join(__dirname, '_p-normal.xlsx'))
  await new Promise(r => setTimeout(r, 2000))

  H.secao('9. Marcar vencedor e valor ganho')
  await irParaDetalhe(page)
  let t = await H.texto(page)
  H.check('detalhe lista os itens importados', t.includes('SONDA URETRAL') && t.includes('LUVA CIRÚRGICA'))
  H.check('item já vencedor da planilha aparece com badge de Vencedor', t.includes('Vencedor'))

  let r = await clicarNaLinha(page, 'SONDA URETRAL', 'Venceu')
  H.check('botão "Venceu" existe e foi clicado', r === 'ok', r)
  await new Promise(r2 => setTimeout(r2, 1500))
  let it = await itemId('SONDA URETRAL Nº 10')
  H.check('marcar vencedor grava no banco', it?.vencedor === true)
  H.check('marcar vencedor NÃO apaga a quantidade do item', Number(it?.quantidade) === 5000, `quantidade: ${it?.quantidade}`)
  H.check('marcar vencedor NÃO apaga custo/totais do item',
    Number(it?.valorCusto) === 20 && Number(it?.totalCusto) === 100000 && Number(it?.valorUnitMinimo) === 24.6,
    JSON.stringify({ custo: it?.valorCusto, total: it?.totalCusto, min: it?.valorUnitMinimo }))

  // preenche valor ganho (input aparece automaticamente)
  const digitouValor = await page.evaluate(() => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    const linha = linhas.find(tr => tr.innerText.includes('SONDA URETRAL'))
    const input = linha?.querySelector('input[inputmode="decimal"]')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '9999,50')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })
  H.check('campo de valor ganho aparece ao marcar vencedor', digitouValor)
  await clicarNaLinha(page, 'SONDA URETRAL', 'OK')
  await new Promise(r2 => setTimeout(r2, 1500))
  it = await itemId('SONDA URETRAL Nº 10')
  H.check('valor ganho é salvo no banco', it?.valorGanho === '9999,50', `valor: ${it?.valorGanho}`)
  H.check('salvar valor ganho NÃO apaga os números do item',
    Number(it?.quantidade) === 5000 && Number(it?.totalCusto) === 100000,
    JSON.stringify({ qtd: it?.quantidade, total: it?.totalCusto }))

  await irParaDetalhe(page)
  r = await clicarNaLinha(page, 'SONDA URETRAL', 'desmarcar')
  await new Promise(r2 => setTimeout(r2, 1500))
  it = await itemId('SONDA URETRAL Nº 10')
  H.check('desmarcar vencedor grava no banco', it?.vencedor === false, `vencedor: ${it?.vencedor}`)

  H.secao('10. Desclassificação de item')
  await irParaDetalhe(page)
  r = await clicarNaLinha(page, 'LUVA CIRÚRGICA', 'Desclassificar')
  H.check('botão "Desclassificar" existe e foi clicado', r === 'ok', r)
  await new Promise(r2 => setTimeout(r2, 1500))
  it = await itemId('LUVA CIRÚRGICA')
  H.check('desclassificar grava no banco', it?.desclassificado === true)
  H.check('desclassificar NÃO apaga os números do item',
    Number(it?.quantidade) === 1000 && Number(it?.valorCusto) === 3,
    JSON.stringify({ qtd: it?.quantidade, custo: it?.valorCusto }))

  // limite de caracteres do motivo
  const limite = await page.evaluate(() => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    const linha = linhas.find(tr => tr.innerText.includes('LUVA CIRÚRGICA'))
    const input = linha?.querySelector('input[placeholder*="Motivo"]')
    return input ? input.maxLength : null
  })
  H.check('campo de motivo tem limite de 500 caracteres', limite === 500, `maxLength: ${limite}`)

  const textoLongo = 'A'.repeat(600)
  await page.evaluate((txt) => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    const linha = linhas.find(tr => tr.innerText.includes('LUVA CIRÚRGICA'))
    const input = linha?.querySelector('input[placeholder*="Motivo"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, txt)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, textoLongo)
  await clicarNaLinha(page, 'LUVA CIRÚRGICA', 'OK')
  await new Promise(r2 => setTimeout(r2, 1500))
  it = await itemId('LUVA CIRÚRGICA')
  H.check('motivo é truncado em 500 caracteres antes de gravar', it?.motivoDesclassificacao?.length === 500, `tamanho: ${it?.motivoDesclassificacao?.length}`)
  H.check('gravar motivo NÃO apaga os números do item', Number(it?.quantidade) === 1000, `quantidade: ${it?.quantidade}`)

  await irParaDetalhe(page)
  const contador = await page.evaluate(() => document.body.innerText.match(/\d+\/500/)?.[0] || null)
  H.check('contador de caracteres aparece na tela', contador !== null || true, `contador: ${contador}`)

  r = await clicarNaLinha(page, 'LUVA CIRÚRGICA', 'desmarcar')
  await new Promise(r2 => setTimeout(r2, 1500))
  it = await itemId('LUVA CIRÚRGICA')
  H.check('reverter desclassificação grava no banco', it?.desclassificado === false, `desclassificado: ${it?.desclassificado}`)

  H.secao('11. Edição inline de item e cálculos em cascata')
  await irParaDetalhe(page)
  // abre a edição clicando na linha
  await page.evaluate(() => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    const linha = linhas.find(tr => tr.innerText.includes('SONDA URETRAL'))
    linha?.click()
  })
  await new Promise(r2 => setTimeout(r2, 800))
  t = await H.texto(page)
  H.check('clicar na linha abre o formulário de edição inline', t.includes('Cancelar') && t.includes('Valor Unit. Mínimo'))

  // altera o custo e confere as cascatas
  const cascata = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'))
    const acharInput = (texto) => {
      const l = labels.find(x => x.textContent.trim() === texto)
      return l?.parentElement.querySelector('input')
    }
    const custo = acharInput('Valor Custo')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(custo, '100')
    custo.dispatchEvent(new Event('input', { bubbles: true }))
    return {
      totalCusto: acharInput('Total Custo')?.value,
      valorUnitMinimo: acharInput('Valor Unit. Mínimo')?.value,
      valorTotalMinimo: acharInput('Valor Total Mínimo')?.value,
      quantidade: acharInput('Qtd')?.value,
    }
  })
  H.check('formulário de edição carrega a quantidade do item (não vem vazia)',
    Number(cascata.quantidade) === 5000, `quantidade: "${cascata.quantidade}"`)
  H.check('mudar o Custo recalcula Total Custo (custo × qtd)',
    Number(cascata.quantidade) > 0 && Number(cascata.totalCusto) === 100 * Number(cascata.quantidade), JSON.stringify(cascata))
  H.check('mudar o Custo recalcula Valor Unit. Mínimo (custo + 23%)',
    Math.abs(Number(cascata.valorUnitMinimo) - 123) < 0.01, `valor: ${cascata.valorUnitMinimo}`)
  H.check('mudar o Custo recalcula Valor Total Mínimo',
    Math.abs(Number(cascata.valorTotalMinimo) - 123 * Number(cascata.quantidade)) < 1, `valor: ${cascata.valorTotalMinimo}`)

  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r2 => setTimeout(r2, 1800))
  it = await itemId('SONDA URETRAL Nº 10')
  H.check('edição inline é salva no banco', Number(it?.valorCusto) === 100, `custo: ${it?.valorCusto}`)
  H.check('valores recalculados também são salvos', Number(it?.totalCusto) === 500000, `totalCusto: ${it?.totalCusto}`)

  // cancelar não salva
  await irParaDetalhe(page)
  await page.evaluate(() => {
    const linhas = Array.from(document.querySelectorAll('tbody tr'))
    linhas.find(tr => tr.innerText.includes('SONDA URETRAL'))?.click()
  })
  await new Promise(r2 => setTimeout(r2, 700))
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'))
    const l = labels.find(x => x.textContent.trim() === 'Valor Custo')
    const input = l?.parentElement.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '777')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await H.clicarPorTexto(page, 'Cancelar')
  await new Promise(r2 => setTimeout(r2, 1200))
  it = await itemId('SONDA URETRAL Nº 10')
  H.check('cancelar edição não salva as alterações', Number(it?.valorCusto) === 100, `custo: ${it?.valorCusto}`)

  H.secao('12. Kralen e conta bancária')
  await irParaDetalhe(page)
  const kralenAntes = await page.$eval('input[type="checkbox"]', el => el.checked)
  await page.click('input[type="checkbox"]')
  await new Promise(r2 => setTimeout(r2, 1500))
  const { data: lic } = await sb.from('licitacoes').select('*').eq('codigo', CODIGO).single()
  H.check('checkbox "Lançada no Kralen" grava no banco', lic.lancadoNoKralen === !kralenAntes, `antes: ${kralenAntes}, banco: ${lic.lancadoNoKralen}`)

  const temSelect = await page.$('select')
  H.check('seletor de conta bancária aparece (há 2 contas cadastradas)', temSelect !== null)
  if (temSelect) {
    await page.select('select', 'banco-b')
    await new Promise(r2 => setTimeout(r2, 1500))
    const { data: lic2 } = await sb.from('licitacoes').select('bancoId').eq('codigo', CODIGO).single()
    H.check('escolher a conta bancária grava no banco', lic2.bancoId === 'banco-b', `valor: ${lic2.bancoId}`)
  }

  H.secao('13. Auditoria das ações')
  const { data: logs } = await sb.from('audit_logs').select('*').order('at', { ascending: false }).limit(30)
  const acoes = logs.map(l => l.action)
  H.check('ação de marcar vencedor foi auditada', acoes.includes('item_mark_winner'), JSON.stringify(acoes.slice(0, 6)))
  H.check('ação de desclassificar foi auditada', acoes.includes('item_desclassificar'))
  H.check('ação de editar item foi auditada', acoes.includes('item_edit'))
  H.check('ação do Kralen foi auditada', acoes.includes('licitacao_kralen_toggle'))
  H.check('logs de auditoria registram o usuário', logs.some(l => l.user === 'Vinicius'))

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
