const fs = require('fs')
const path = require('path')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())

async function importar(page, arquivo) {
  await page.goto(`${H.BASE}/licitacoes/novo?edit=${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  await H.clicarPorTexto(page, 'Importar Itens')
  await new Promise(r => setTimeout(r, 500))
  const input = await page.$('input[type="file"]')
  await input.uploadFile(path.join(__dirname, arquivo))
  await new Promise(r => setTimeout(r, 1800))
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    return m ? m.innerText : ''
  })
  return modal
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()

  H.secao('7. Importação de planilha — cenários de erro')

  let modal = await importar(page, '_p-sem-cabecalho.xlsx')
  H.check('planilha sem cabeçalho é rejeitada com mensagem clara', modal.includes('não foi encontrada'), modal.slice(0, 120).replace(/\n/g, ' '))
  let { data: aposErro } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO)
  H.check('planilha rejeitada não apaga/grava nada', aposErro.length === 0, `itens: ${aposErro.length}`)

  modal = await importar(page, '_p-cabecalho-errado.xlsx')
  H.check('planilha com coluna fora do lugar é bloqueada', modal.includes('não bate com o modelo esperado'), modal.slice(0, 150).replace(/\n/g, ' '))
  ;({ data: aposErro } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('planilha desalinhada não grava dado errado', aposErro.length === 0, `itens: ${aposErro.length}`)

  modal = await importar(page, '_p-vazia.xlsx')
  ;({ data: aposErro } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('planilha válida mas sem itens importa zero itens (sem erro)', aposErro.length === 0, `itens: ${aposErro.length}`)

  H.secao('8. Importação de planilha — cenários válidos')

  modal = await importar(page, '_p-normal.xlsx')
  H.check('planilha normal importa e lista os itens no modal', modal.includes('SONDA URETRAL') && modal.includes('SERINGA 5ML'), modal.slice(0, 150).replace(/\n/g, ' '))

  let { data: itens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO).order('item')
  H.check('importou exatamente os 3 itens preenchidos (ignorou linhas em branco)', itens.length === 3, `itens: ${itens.length}`)

  const i1 = itens.find(i => i.codKralen === 'KR-100')
  H.check('mapeou COD.KRALEN', i1?.codKralen === 'KR-100')
  H.check('mapeou descrição', i1?.descricao === 'SONDA URETRAL Nº 10')
  H.check('mapeou unidade', i1?.unidade === 'UNID.')
  H.check('mapeou quantidade', Number(i1?.quantidade) === 5000, `valor: ${i1?.quantidade}`)
  H.check('mapeou marca', i1?.marca === 'POLIMAX')
  H.check('mapeou origem da cotação', i1?.origemCotacao === 'Fornecedor A')
  H.check('mapeou valor unit. mínimo', Number(i1?.valorUnitMinimo) === 24.6, `valor: ${i1?.valorUnitMinimo}`)
  H.check('mapeou valor total mínimo', Number(i1?.valorTotalMinimo) === 123000, `valor: ${i1?.valorTotalMinimo}`)
  H.check('mapeou valor unit. município', Number(i1?.valorUnitMunicipio) === 26, `valor: ${i1?.valorUnitMunicipio}`)
  H.check('mapeou valor total município', Number(i1?.valorTotalMunicipio) === 130000, `valor: ${i1?.valorTotalMunicipio}`)
  H.check('mapeou custo', Number(i1?.valorCusto) === 20, `valor: ${i1?.valorCusto}`)
  H.check('mapeou total custo', Number(i1?.totalCusto) === 100000, `valor: ${i1?.totalCusto}`)
  H.check('item sem ganhador fica com vencedor = false', i1?.vencedor === false)
  H.check('item sem ganhador fica sem valorGanho', !i1?.valorGanho, `valor: ${i1?.valorGanho}`)

  const i2 = itens.find(i => i.codKralen === 'KR-200')
  H.check('item marcado como GANHADOR vira vencedor = true', i2?.vencedor === true)
  H.check('item vencedor recebe o valor total arrematado', String(i2?.valorGanho) === '3450', `valor: ${i2?.valorGanho}`)
  H.check('marca do vencedor sobrepõe a marca da cotação', i2?.marca === 'MEDIX PLUS', `valor: ${i2?.marca}`)

  const i3 = itens.find(i => i.codKralen === 'KR-300')
  H.check('campos numéricos vazios viram null (não quebram o insert)', i3?.valorUnitMunicipio === null, `valor: ${i3?.valorUnitMunicipio}`)

  // planilha deslocada (coluna A ocupada) — o bug que o cliente reportou
  modal = await importar(page, '_p-deslocada.xlsx')
  H.check('planilha com coluna A ocupada também importa (bug corrigido)', modal.includes('SONDA URETRAL'), modal.slice(0, 150).replace(/\n/g, ' '))
  ;({ data: itens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('planilha deslocada importa os mesmos 3 itens', itens.length === 3, `itens: ${itens.length}`)
  const d1 = itens.find(i => i.codKralen === 'KR-100')
  H.check('planilha deslocada mapeia os valores nas colunas certas', Number(d1?.valorCusto) === 20 && Number(d1?.quantidade) === 5000,
    JSON.stringify({ custo: d1?.valorCusto, qtd: d1?.quantidade }))

  // reimportar substitui (não duplica)
  await importar(page, '_p-normal.xlsx')
  ;({ data: itens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO))
  H.check('reimportar substitui os itens em vez de duplicar', itens.length === 3, `itens: ${itens.length}`)

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
