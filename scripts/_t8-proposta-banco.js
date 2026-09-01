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

  const { data: emp } = await sb.from('empresa_info').select('bancos').eq('id', true).single()
  const bancos = emp.bancos

  H.secao('33. Escolha da conta bancária ao emitir a proposta')
  H.check('há mais de uma conta cadastrada para poder escolher', bancos.length > 1, `contas: ${bancos.length}`)

  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))

  let t = await H.texto(page)
  H.check('o seletor fixo antigo saiu da página', !t.includes('Conta bancária desta licitação'))

  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 900))
  t = await H.texto(page)
  H.check('clicar em "Emitir Proposta" abre o passo de escolha da conta', t.includes('Conta bancária que vai aparecer na proposta'))
  H.check('o modal identifica a licitação', t.includes(`Emitir Proposta — Licitação ${CODIGO}`))

  const opcoes = await page.evaluate(() => {
    const sel = document.querySelector('.fixed.inset-0 select')
    return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text })) : []
  })
  H.check('o seletor lista todas as contas cadastradas', opcoes.length === bancos.length, `opções: ${opcoes.length} / contas: ${bancos.length}`)
  H.check('cada opção mostra apelido, agência e conta (dá pra distinguir)',
    opcoes.every(o => /Ag\.|C\/C/.test(o.text)), JSON.stringify(opcoes.map(o => o.text)))

  // escolhe a SEGUNDA conta (diferente da atual) e gera
  const escolhida = bancos[1]
  const errosAntes = erros.length
  await page.select('.fixed.inset-0 select', escolhida.id)
  await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gerar PDF')?.click()
  })
  await new Promise(r => setTimeout(r, 5000))

  H.check('gerar a proposta não dá erro', erros.length === errosAntes, JSON.stringify(erros.slice(errosAntes)))

  t = await H.texto(page)
  H.check('o modal fecha após gerar', !t.includes('Conta bancária que vai aparecer na proposta'))

  const { data: lic } = await sb.from('licitacoes').select('bancoId').eq('codigo', CODIGO).single()
  H.check('a conta escolhida é gravada na licitação', lic.bancoId === escolhida.id, `gravado: ${lic.bancoId}, esperado: ${escolhida.id}`)

  // o PDF (renderizado fora da tela) precisa refletir a conta escolhida
  const dadosNoDocumento = await page.evaluate(() => document.body.innerText)
  H.check('a proposta renderizada mostra a conta escolhida',
    dadosNoDocumento.includes(escolhida.banco) || dadosNoDocumento.includes(escolhida.conta),
    `procurando "${escolhida.banco}" / "${escolhida.conta}"`)
  const outra = bancos.find(b => b.id !== escolhida.id)
  H.check('a proposta NÃO mostra a outra conta',
    !dadosNoDocumento.includes(outra.conta), `conta que não deveria aparecer: ${outra.conta}`)

  H.secao('34. Reabrir mantém a escolha e cancelar não altera')
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))
  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 800))
  const preSelecionado = await page.$eval('.fixed.inset-0 select', el => el.value)
  H.check('ao reabrir, vem pré-selecionada a conta usada da última vez', preSelecionado === escolhida.id, `valor: ${preSelecionado}`)

  // troca a seleção mas cancela
  const outraConta = bancos.find(b => b.id !== escolhida.id)
  await page.select('.fixed.inset-0 select', outraConta.id)
  await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancelar')?.click()
  })
  await new Promise(r => setTimeout(r, 1200))
  const { data: licDepois } = await sb.from('licitacoes').select('bancoId').eq('codigo', CODIGO).single()
  H.check('cancelar não altera a conta gravada', licDepois.bancoId === escolhida.id, `valor: ${licDepois.bancoId}`)
  t = await H.texto(page)
  H.check('cancelar fecha o modal', !t.includes('Conta bancária que vai aparecer na proposta'))

  H.secao('35. Declarações seguem a conta escolhida na proposta')
  const errosDecl = erros.length
  await H.clicarPorTexto(page, 'Planilha de Dados para Preenchimento do Contrato')
  await new Promise(r => setTimeout(r, 4000))
  H.check('gerar declaração não dá erro', erros.length === errosDecl, JSON.stringify(erros.slice(errosDecl)))
  const textoDecl = await H.texto(page)
  H.check('a declaração usa a mesma conta escolhida na proposta',
    textoDecl.includes(escolhida.banco) || textoDecl.includes(escolhida.conta),
    `procurando "${escolhida.banco}"`)

  H.secao('36. Clique imediato após abrir a página (corrida de carregamento)')
  // sem esperar nada: os botões de documento não podem gerar PDF antes dos
  // dados da empresa chegarem, senão sai proposta sem CNPJ/endereço/banco
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'domcontentloaded' })
  const estadoImediato = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Emitir Proposta (PDF)')
    return btn ? { existe: true, desabilitado: btn.disabled } : { existe: false }
  })
  H.check('botão de emitir proposta fica desabilitado enquanto carrega',
    !estadoImediato.existe || estadoImediato.desabilitado === true, JSON.stringify(estadoImediato))

  await new Promise(r => setTimeout(r, 2500))
  const estadoDepois = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Emitir Proposta (PDF)')
    return btn ? btn.disabled : null
  })
  H.check('botão é liberado depois que os dados carregam', estadoDepois === false, `disabled: ${estadoDepois}`)

  // e ao clicar depois de carregado, o passo de escolha aparece normalmente
  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 900))
  H.check('após carregar, o passo de escolha da conta abre normalmente',
    (await H.texto(page)).includes('Conta bancária que vai aparecer na proposta'))
  await page.evaluate(() => {
    const m = document.querySelector('.fixed.inset-0')
    Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancelar')?.click()
  })
  await new Promise(r => setTimeout(r, 500))

  H.secao('37. Comportamento com uma única conta cadastrada')
  // deixa só uma conta temporariamente
  await sb.from('empresa_info').update({ bancos: [bancos[0]] }).eq('id', true)
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1600))
  const errosUnica = erros.length
  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 4000))
  t = await H.texto(page)
  H.check('com uma conta só, não pede escolha (gera direto)', !t.includes('Conta bancária que vai aparecer na proposta'))
  H.check('com uma conta só, a geração funciona sem erro', erros.length === errosUnica, JSON.stringify(erros.slice(errosUnica)))
  // restaura
  await sb.from('empresa_info').update({ bancos }).eq('id', true)

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
