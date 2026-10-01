const H = require('./_harness')

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()
  let codigoNovo = null

  // remove sobras de execuções anteriores pra a contagem ser determinística
  const { data: sobras } = await sb.from('licitacoes').select('codigo').eq('numeroPregao', 'TESTE-E2E-001')
  for (const l of sobras || []) await sb.from('licitacoes').delete().eq('codigo', l.codigo)

  H.secao('3. Listagem de licitações')
  await page.goto(`${H.BASE}/licitacoes`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  let t = await H.texto(page)
  H.check('listagem mostra a tabela com licitações existentes', t.includes('Código') && t.includes('Ver Licitação'))

  H.check('listagem mostra contador de resultados', /Resultados:\s*\d+/.test(t), t.match(/Resultados:\s*\d+/)?.[0])
  // total real, não um número fixo — pra "Limpar filtros" poder conferir que
  // volta exatamente pra esse valor, não pra um total chutado na hora de
  // escrever o teste (que muda toda vez que mais licitações são criadas).
  const totalAntes = t.match(/Resultados:\s*\d+/)?.[0]

  // filtro por código
  await page.type('input[placeholder="Código"]', '86')
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('filtro por código funciona', t.includes('Resultados: 1'), t.match(/Resultados:\s*\d+/)?.[0])

  await H.clicarPorTexto(page, 'Limpar filtros')
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('botão "Limpar filtros" restaura os filtros', t.match(/Resultados:\s*\d+/)?.[0] === totalAntes, `esperado: ${totalAntes}, obtido: ${t.match(/Resultados:\s*\d+/)?.[0]}`)

  // busca geral (procura por item dentro da licitação)
  await page.type('input[placeholder="Busca geral (itens/observações)"]', 'SONDA')
  await new Promise(r => setTimeout(r, 1200))
  t = await H.texto(page)
  H.check('busca geral encontra licitação pelo conteúdo dos itens', /Resultados:\s*[1-9]/.test(t), t.match(/Resultados:\s*\d+/)?.[0])

  await H.clicarPorTexto(page, 'Limpar filtros')
  await new Promise(r => setTimeout(r, 500))

  // filtro que não retorna nada
  await page.type('input[placeholder="Código"]', '999999')
  await new Promise(r => setTimeout(r, 700))
  t = await H.texto(page)
  H.check('filtro sem resultados mostra zero (sem quebrar)', t.includes('Resultados: 0'), t.match(/Resultados:\s*\d+/)?.[0])

  H.secao('4. Criar licitação')
  await page.goto(`${H.BASE}/licitacoes/novo`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))

  const codigoPreview = await page.$$eval('input[readonly]', els => els[0]?.value)
  H.check('formulário sugere o próximo código automaticamente', /^\d+$/.test(String(codigoPreview)), `código: ${codigoPreview}`)

  // Não compara com um nome fixo: a suíte roda com qualquer conta de teste,
  // então o que importa é que o campo venha preenchido (não vazio).
  const criadoPor = await page.$$eval('input[readonly]', els => els[1]?.value)
  H.check('formulário preenche "Criado por" com o usuário logado', !!criadoPor, `valor: ${criadoPor}`)

  // preenche campos
  const preencher = async (placeholderOuLabel, valor) => {
    const ok = await page.evaluate(({ label, valor }) => {
      const labels = Array.from(document.querySelectorAll('label'))
      const alvo = labels.find(l => l.textContent.trim() === label)
      if (!alvo) return false
      const campo = alvo.parentElement.querySelector('input, textarea, select')
      if (!campo) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      const proto = campo.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
        : campo.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
      campo.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }, { label: placeholderOuLabel, valor })
    return ok
  }

  H.check('preencheu Número do Pregão', await preencher('Número do Pregão', 'TESTE-E2E-001'))
  await preencher('Número do Processo', 'PROC-E2E-001')
  await preencher('Portal Eletrônico', 'COMPRASNET')
  await preencher('Objeto Licitação', 'Objeto de teste automatizado E2E')
  await preencher('Tipo Objeto', 'Medicamentos')
  await preencher('Tipo de disputa', 'Aberto')

  await H.clicarPorTexto(page, 'Salvar')
  await new Promise(r => setTimeout(r, 2500))
  H.check('salvar nova licitação redireciona pra listagem', page.url().includes('/licitacoes'), page.url())

  const { data: criadas } = await sb.from('licitacoes').select('*').eq('numeroPregao', 'TESTE-E2E-001')
  H.check('licitação nova foi realmente gravada no banco', criadas && criadas.length === 1, `encontradas: ${criadas?.length}`)
  if (criadas && criadas.length === 1) {
    codigoNovo = criadas[0].codigo
    H.check('campos gravados corretamente', criadas[0].numeroProcesso === 'PROC-E2E-001' && criadas[0].portal === 'COMPRASNET',
      JSON.stringify({ p: criadas[0].numeroProcesso, portal: criadas[0].portal }))
    H.check('licitação nasce sem status (Ganhou/Perdeu não é mais campo do formulário)', !criadas[0].status, `status: ${criadas[0].status}`)
    H.check('código gerado pelo banco (identity), não pelo cliente', typeof criadas[0].codigo === 'number' && criadas[0].codigo > 0, `código: ${criadas[0].codigo}`)
    H.check('criadoPor gravado', criadas[0].criadoPor === criadoPor, `valor: ${criadas[0].criadoPor}`)
  }

  H.secao('5. Editar licitação')
  if (codigoNovo) {
    await page.goto(`${H.BASE}/licitacoes/novo?edit=${codigoNovo}`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 1800))
    const pregaoCarregado = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'))
      const alvo = labels.find(l => l.textContent.trim() === 'Número do Pregão')
      return alvo?.parentElement.querySelector('input')?.value
    })
    H.check('formulário de edição carrega os dados existentes', pregaoCarregado === 'TESTE-E2E-001', `valor: ${pregaoCarregado}`)

    const titulo = await page.$eval('h3', el => el.textContent.trim())
    H.check('título do formulário indica edição (não "Nova Licitação")', titulo !== 'Nova Licitação', `título: "${titulo}"`)

    await preencher('Número do Processo', 'PROC-E2E-EDITADO')
    await H.clicarPorTexto(page, 'Salvar')
    await new Promise(r => setTimeout(r, 2500))
    const { data: editada } = await sb.from('licitacoes').select('*').eq('codigo', codigoNovo).single()
    H.check('edição foi salva no banco', editada?.numeroProcesso === 'PROC-E2E-EDITADO', `valor: ${editada?.numeroProcesso}`)
    H.check('edição não duplicou a licitação (mesmo código)', editada?.codigo === codigoNovo)
  }

  H.secao('6. Detalhe da licitação')
  if (codigoNovo) {
    await page.goto(`${H.BASE}/licitacoes/${codigoNovo}`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 1500))
    t = await H.texto(page)
    H.check('detalhe mostra o número do pregão', t.includes('TESTE-E2E-001'))
    H.check('detalhe mostra "Sem status" antes de alterar', t.includes('Sem status'))
    H.check('detalhe mostra a seção de itens', t.includes('Itens'))
    H.check('detalhe mostra "Nenhum item importado" quando não há itens', t.includes('Nenhum item importado'))
    H.check('detalhe mostra as seções de Declarações e Anexos', t.includes('Declarações') && t.includes('Anexos'))
    H.check('detalhe mostra os botões de documento', t.includes('Imprimir Checklist') && t.includes('Emitir Proposta'))

    H.secao('6b. Alterar status direto na tela de detalhe (sem entrar no formulário)')
    await page.select('select[aria-label="Status da licitação"]', 'Ganhou')
    await new Promise(r => setTimeout(r, 1200))
    const { data: comStatus } = await sb.from('licitacoes').select('status').eq('codigo', codigoNovo).single()
    H.check('alterar o status salva no banco na hora', comStatus?.status === 'Ganhou', `status: ${comStatus?.status}`)
    t = await H.texto(page)
    H.check('o badge atualiza pra "Ganhou" sem precisar recarregar', t.includes('Ganhou'))
    const { data: logStatus } = await sb.from('audit_logs').select('action').order('at', { ascending: false }).limit(1).single()
    H.check('mudança de status é auditada', logStatus?.action === 'licitacao_status', `ação: ${logStatus?.action}`)
  }

  // licitação inexistente
  await page.goto(`${H.BASE}/licitacoes/999999`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1500))
  t = await H.texto(page)
  H.check('licitação inexistente mostra mensagem amigável (não quebra)', t.includes('não encontrada'), t.slice(0, 100).replace(/\n/g, ' '))

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  console.log(`\n[codigo de teste criado: ${codigoNovo}]`)
  require('fs').writeFileSync(__dirname + '/_codigo-teste.txt', String(codigoNovo || ''))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
