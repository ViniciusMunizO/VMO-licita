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
  const sb = await H.supabaseLogado()

  H.secao('48. Versionamento de proposta emitida')

  const { count: countAntes } = await sb.from('propostas_emitidas').select('id', { count: 'exact', head: true }).eq('licitacaoCodigo', CODIGO)

  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))

  const errosAntesProposta = erros.length
  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 900))
  let t = await H.texto(page)
  if (t.includes('Conta bancária que vai aparecer na proposta')) {
    await page.evaluate(() => {
      const m = document.querySelector('.fixed.inset-0')
      Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gerar PDF')?.click()
    })
  }
  await new Promise(r => setTimeout(r, 5000))
  H.check('emitir proposta não dá erro', erros.length === errosAntesProposta, JSON.stringify(erros.slice(errosAntesProposta)))

  const { data: propostas, count: countDepois } = await sb
    .from('propostas_emitidas')
    .select('id, snapshot', { count: 'exact' })
    .eq('licitacaoCodigo', CODIGO)
    .order('emitidoEm', { ascending: false })
  H.check('emitir proposta grava um snapshot novo', (countDepois || 0) === (countAntes || 0) + 1, `antes: ${countAntes}, depois: ${countDepois}`)
  H.check('o snapshot grava a lista de itens da proposta', Array.isArray(propostas?.[0]?.snapshot?.items) && propostas[0].snapshot.items.length > 0)

  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  t = await H.texto(page)
  H.check('a tela mostra o histórico de propostas emitidas', t.includes('Histórico de propostas emitidas'))
  await page.evaluate(() => document.querySelector('details summary')?.click())
  await new Promise(r => setTimeout(r, 300))
  t = await H.texto(page)
  H.check('o histórico expandido mostra quem emitiu (não "usuário removido")', !t.includes('Histórico de propostas emitidas') || !t.includes('usuário removido'))

  H.secao('49. Meta do mês')
  await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('card "Meta do mês" aparece', t.includes('Meta do mês'))

  let abriuMeta = await H.clicarPorTexto(page, 'Definir meta')
  if (!abriuMeta) abriuMeta = await H.clicarPorTexto(page, 'Editar')
  H.check('botão de definir/editar meta existe (usuário admin)', abriuMeta === true)
  await new Promise(r => setTimeout(r, 400))

  await H.limparEDigitar(page, '#meta-valor', '12345')
  await H.limparEDigitar(page, '#meta-taxa', '77')
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 1200))

  const { data: metaSalva } = await sb.from('metas').select('*').order('atualizadoEm', { ascending: false }).limit(1).single()
  H.check('meta gravada no banco com os valores certos',
    Number(metaSalva?.valorAlvoGanho) === 12345 && Number(metaSalva?.taxaAlvoSucesso) === 77,
    JSON.stringify(metaSalva))

  t = await H.texto(page)
  H.check('depois de salvar, a tela mostra a comparação com a meta', t.includes('Valor ganho') && t.includes('Taxa de sucesso'))

  // limpeza: não deixar meta de teste grudada no mês real
  if (metaSalva?.periodo) await sb.from('metas').delete().eq('periodo', metaSalva.periodo)

  H.secao('50. Entregas — controle pós-vitória')
  const { data: itemsLic } = await sb.from('items').select('id, descricao, quantidade, unidade').eq('licitacaoCodigo', CODIGO).order('created_at', { ascending: true })
  const itemAlvo = itemsLic[0]
  // só este item fica vencedor — evita ambiguidade de qual botão "+ Registrar
  // entrega" clicar se sobrar mais de um vencedor de testes anteriores.
  await sb.from('items').update({ vencedor: false }).eq('licitacaoCodigo', CODIGO).neq('id', itemAlvo.id)
  await sb.from('items').update({ vencedor: true }).eq('id', itemAlvo.id)

  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))
  t = await H.texto(page)
  H.check('seção "Entregas" aparece quando há item vencedor', t.includes('Entregas'))

  const abriuForm = await H.clicarPorTexto(page, '+ Registrar entrega')
  H.check('botão "+ Registrar entrega" existe e foi clicado', abriuForm === true)
  await new Promise(r => setTimeout(r, 400))

  const qtdEntrega = Math.max(1, Math.floor(Number(itemAlvo.quantidade) / 2))
  await page.type(`#entrega-qtd-${itemAlvo.id}`, String(qtdEntrega))
  await page.type(`#entrega-nf-${itemAlvo.id}`, '12345')
  const errosAntesEntrega = erros.length
  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 1200))
  H.check('registrar entrega não dá erro', erros.length === errosAntesEntrega, JSON.stringify(erros.slice(errosAntesEntrega)))

  const { data: entregasGravadas } = await sb.from('entregas').select('*').eq('itemId', itemAlvo.id)
  H.check('entrega gravada no banco com a quantidade certa',
    entregasGravadas?.length === 1 && Number(entregasGravadas[0].quantidade) === qtdEntrega,
    JSON.stringify(entregasGravadas))

  t = await H.texto(page)
  H.check('tela mostra o saldo entregue atualizado', t.includes(`Entregue: ${qtdEntrega}`))
  H.check('tela mostra a nota fiscal registrada', t.includes('NF 12345'))

  const removeu = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'remover')
    if (btn) { btn.click(); return true }
    return false
  })
  H.check('link "remover" da entrega existe e foi clicado', removeu === true)
  await new Promise(r => setTimeout(r, 1000))
  const { data: entregasDepois } = await sb.from('entregas').select('*').eq('itemId', itemAlvo.id)
  H.check('remover apaga a entrega do banco', (entregasDepois || []).length === 0, JSON.stringify(entregasDepois))

  H.secao('51. Auditoria — retenção de logs')
  await page.goto(`${H.BASE}/admin/audit`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  t = await H.texto(page)
  H.check('seção "Retenção de logs" aparece', t.includes('Retenção de logs'))

  // data bem no passado: garante 0 apagados de propósito, sem risco de mexer
  // no histórico real de auditoria.
  await H.limparEDigitar(page, '#audit-data-corte', '01011999')
  const cliqueExportar = await H.clicarPorTexto(page, 'Exportar e apagar')
  H.check('botão "Exportar e apagar" existe e foi clicado', cliqueExportar === true)
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('com data no passado distante, nenhum log é apagado', t.includes('Nenhum log anterior a essa data'))

  H.secao('52. Histórico de preço ao editar item')
  const codKralenTeste = `HIST-TESTE-${CODIGO}`
  await sb.from('items').update({ codKralen: codKralenTeste, vencedor: true, valorGanho: '888.50' }).eq('id', itemAlvo.id)

  const { data: novaLicHist } = await sb.from('licitacoes').insert({ ano: 2026, contratado: 'TESTE CASCADE', numeroPregao: 'TESTE-E2E-HIST', status: 'Perdeu' }).select().single()
  await sb.from('items').insert({ licitacaoCodigo: novaLicHist.codigo, descricao: 'ITEM HISTORICO TESTE', codKralen: codKralenTeste, quantidade: 10, vencedor: false })

  await page.goto(`${H.BASE}/licitacoes/${novaLicHist.codigo}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))
  const abriuItem = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('tbody tr')).find(tr => tr.textContent.includes('ITEM HISTORICO TESTE'))
    if (row) { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true }
    return false
  })
  H.check('consegue clicar no item pra editar', abriuItem === true)
  await new Promise(r => setTimeout(r, 1200))
  t = await H.texto(page)
  H.check('mostra o histórico de outra licitação com o mesmo Cód. Kralen',
    t.includes('1 vitória(s) em 1 disputa(s)'), t.slice(0, 1500))
  H.check('mostra o último valor ganho do histórico', t.includes('último valor ganho: R$ 888,50'))

  await sb.from('licitacoes').delete().eq('codigo', novaLicHist.codigo)

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 5)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
