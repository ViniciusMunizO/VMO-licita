const fs = require('fs')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())

async function aba(page, nome) {
  const botoes = await page.$$('button')
  for (const b of botoes) {
    const t = await page.evaluate(el => el.textContent, b)
    if (t && t.trim() === nome) { await b.click(); await new Promise(r => setTimeout(r, 1400)); return true }
  }
  return false
}

async function clicarFiltro(page, texto) {
  return page.evaluate((txt) => {
    const btns = Array.from(document.querySelectorAll('button'))
    const b = btns.find(x => x.textContent.trim() === txt)
    if (!b) return false
    b.click()
    return true
  }, texto)
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()

  H.secao('18. Relatório — Status das Licitações')
  await page.goto(`${H.BASE}/relatorios`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1800))
  let t = await H.texto(page)
  H.check('hub de relatórios abre na aba Status', t.includes('Relatório de Status das Licitações'))
  H.check('mostra os 4 cards de resumo', t.includes('Ganhou') && t.includes('Perdeu') && t.includes('Sem status') && t.includes('Taxa de sucesso'))
  H.check('mostra a tabela com colunas certas', t.includes('Pregão:') && t.includes('Kralen:'))

  const { data: lics } = await sb.from('licitacoes').select('*')
  const ganhou = lics.filter(l => l.status === 'Ganhou').length
  const semStatus = lics.filter(l => !l.status).length
  const numeros = t.match(/Ganhou\s+(\d+)/)
  H.check('contagem de "Ganhou" bate com o banco', numeros && Number(numeros[1]) === ganhou, `tela: ${numeros?.[1]}, banco: ${ganhou}`)

  H.check('filtro "Ganhou" existe e filtra', await clicarFiltro(page, 'Ganhou'))
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  H.check('filtro Ganhou não mostra "Sem status" na tabela', !t.split('Licitação:')[1]?.includes('Sem status') || ganhou > 0)

  await clicarFiltro(page, 'Todas')
  await new Promise(r => setTimeout(r, 600))
  H.check('filtro Kralen "Lançadas no Kralen" existe', await clicarFiltro(page, 'Lançadas no Kralen'))
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  const lancadas = lics.filter(l => l.lancadoNoKralen).length
  H.check('filtro Kralen reduz a lista corretamente',
    lancadas === 0 ? t.includes('Nenhuma licitação encontrada') : !t.includes('Nenhuma licitação encontrada'),
    `lançadas no banco: ${lancadas}`)

  await clicarFiltro(page, 'Todas')
  await new Promise(r => setTimeout(r, 600))
  H.check('filtro de período "Último mês" existe', await clicarFiltro(page, 'Último mês'))
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  H.check('cabeçalho do relatório reflete o período escolhido', t.includes('Último mês'))

  H.check('filtro "Data específica" abre os campos de data', await clicarFiltro(page, 'Data específica'))
  await new Promise(r => setTimeout(r, 700))
  const camposData = await page.$$('input[placeholder="dd/mm/aaaa"]')
  H.check('dois campos de data aparecem (De/até)', camposData.length >= 2, `campos: ${camposData.length}`)

  await clicarFiltro(page, 'Todo o período')
  await new Promise(r => setTimeout(r, 600))

  H.secao('19. Relatório — Itens Ganhos')
  H.check('aba "Itens Ganhos" existe', await aba(page, 'Itens Ganhos'))
  t = await H.texto(page)
  H.check('título do relatório está correto', t.includes('Relatório Geral de Itens Ganhos'))
  H.check('mostra cards de valor/custo/margem', t.includes('Valor Total Ganho') && t.includes('Custo Total') && t.includes('Margem'))
  H.check('tem busca por item', (await page.$('input[placeholder*="Buscar item ganho"]')) !== null)
  H.check('tem filtro de Kralen (3 opções)', t.includes('Lançadas no Kralen') && t.includes('Não lançadas no Kralen'))
  H.check('tem filtro de período', t.includes('Todo o período') && t.includes('Últimos 3 meses'))

  await clicarFiltro(page, 'Todas')
  await new Promise(r => setTimeout(r, 1000))
  t = await H.texto(page)
  const { data: itensVenc } = await sb.from('items').select('*').eq('vencedor', true)
  H.check('lista itens vencedores existentes', itensVenc.length === 0 || /SERINGA|SONDA|LUVA|AGULHA/.test(t), `vencedores no banco: ${itensVenc.length}`)

  await page.type('input[placeholder*="Buscar item ganho"]', 'XYZINEXISTENTE')
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  H.check('busca sem resultado mostra mensagem clara', t.includes('Nenhum item ganho encontrado'))
  await H.clicarPorTexto(page, 'Limpar')
  await new Promise(r => setTimeout(r, 800))

  H.secao('20. Relatório — Itens Perdidos')
  H.check('aba "Itens Perdidos" existe', await aba(page, 'Itens Perdidos'))
  t = await H.texto(page)
  H.check('título do relatório está correto', t.includes('Relatório Geral de Itens Perdidos'))
  H.check('tem busca por item', (await page.$('input[placeholder*="Buscar item perdido"]')) !== null)
  H.check('tem filtro de Kralen', t.includes('Lançadas no Kralen'))
  H.check('tem filtro de período', t.includes('Todo o período'))

  await page.type('input[placeholder*="Buscar item perdido"]', 'SONDA')
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  H.check('busca por item filtra e mostra o termo buscado', t.includes('Filtrando por:') || t.includes('Nenhum item perdido encontrado'))
  await H.clicarPorTexto(page, 'Limpar')
  await new Promise(r => setTimeout(r, 700))

  H.secao('21. Relatório — Itens Desclassificados')
  H.check('aba "Itens Desclassificados" existe', await aba(page, 'Itens Desclassificados'))
  t = await H.texto(page)
  H.check('título do relatório está correto', t.includes('Itens Desclassificadas'))
  H.check('tem busca por item', (await page.$('input[placeholder*="Buscar item desclassificado"]')) !== null)
  H.check('tem filtro de Kralen e período', t.includes('Lançadas no Kralen') && t.includes('Todo o período'))

  H.secao('22. Consistência dos relatórios com o banco')
  // marca um item como perdido e confere que aparece no relatório
  const { data: itens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO)
  const semVencedor = itens.filter(i => !i.vencedor && !i.desclassificado)
  H.check('há itens não-vencedores para o relatório de perdidos', semVencedor.length > 0, `itens: ${semVencedor.length}`)

  await aba(page, 'Itens Perdidos')
  await new Promise(r => setTimeout(r, 1200))
  t = await H.texto(page)
  if (semVencedor.length > 0) {
    const algum = semVencedor.some(i => t.includes(i.descricao))
    H.check('item não-vencedor de licitação decidida aparece no relatório de perdidos', algum,
      `procurando: ${semVencedor.map(i => i.descricao).join(', ')}`)
  }

  H.secao('23. Geração de documentos (PDF)')
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))

  const errosAntesPdf = erros.length
  await H.clicarPorTexto(page, 'Exportar Itens (PDF)')
  await new Promise(r => setTimeout(r, 4000))
  H.check('exportar itens em PDF não gera erro', erros.length === errosAntesPdf, JSON.stringify(erros.slice(errosAntesPdf)))

  const errosAntesProp = erros.length
  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 1000))
  // com mais de uma conta cadastrada, abre o passo de escolha da conta antes
  const pediuConta = (await H.texto(page)).includes('Conta bancária que vai aparecer na proposta')
  if (pediuConta) {
    await page.evaluate(() => {
      const m = document.querySelector('.fixed.inset-0')
      Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gerar PDF')?.click()
    })
  }
  await new Promise(r => setTimeout(r, 4500))
  H.check('emitir proposta em PDF não gera erro', erros.length === errosAntesProp, JSON.stringify(erros.slice(errosAntesProp)))

  const { data: logs } = await sb.from('audit_logs').select('*').order('at', { ascending: false }).limit(10)
  H.check('emissão da proposta é auditada', logs.some(l => l.action === 'proposta_emitida'), JSON.stringify(logs.slice(0, 3).map(l => l.action)))

  H.secao('24. Declarações')
  t = await H.texto(page)
  H.check('lista de declarações aparece na tela de detalhe', t.includes('Declaração Unificada') && t.includes('Procuração'))
  H.check('não mostra aviso de dados faltando (empresa está completa)', !t.includes('Faltam dados nas'), t.includes('Faltam dados nas') ? 'aviso presente' : '')

  const errosAntesDecl = erros.length
  await H.clicarPorTexto(page, 'Planilha de Dados para Preenchimento do Contrato')
  await new Promise(r => setTimeout(r, 4000))
  H.check('gerar declaração não dá erro', erros.length === errosAntesDecl, JSON.stringify(erros.slice(errosAntesDecl)))

  // a declaração usa os dados bancários da conta escolhida na licitação
  const { data: lic } = await sb.from('licitacoes').select('bancoId').eq('codigo', CODIGO).single()
  const { data: emp } = await sb.from('empresa_info').select('bancos').eq('id', true).single()
  const contaEsperada = emp.bancos.find(b => b.id === lic.bancoId) || emp.bancos[0]
  t = await H.texto(page)
  H.check('declaração usa a conta bancária selecionada na licitação',
    t.includes(contaEsperada.banco) || t.includes(contaEsperada.conta),
    `esperado: ${contaEsperada.banco} / ${contaEsperada.conta}`)

  // declaração personalizada
  await H.clicarPorTexto(page, '+ Declaração Personalizada')
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('modal de declaração personalizada abre', t.includes('Declaração Personalizada'))
  await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    const inputs = m.querySelectorAll('input, textarea')
    const setter = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setter(inputs[0], 'Declaração de Teste E2E')
    setter(inputs[1], 'Texto da declaração com {{razaoSocial}} e CNPJ {{cnpj}}.')
  })
  const errosAntesCustom = erros.length
  await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    Array.from(m.querySelectorAll('button')).find(b => b.textContent.includes('Gerar PDF'))?.click()
  })
  await new Promise(r => setTimeout(r, 4000))
  H.check('gerar declaração personalizada não dá erro', erros.length === errosAntesCustom, JSON.stringify(erros.slice(errosAntesCustom)))
  t = await H.texto(page)
  H.check('declaração personalizada substitui as variáveis do template',
    !t.includes('{{razaoSocial}}'), 'template não substituído')

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
