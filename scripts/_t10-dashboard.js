const H = require('./_harness')

// Cria licitações cobrindo os três casos do painel e confere o que cai em
// cada card. Os registros criados aqui são apagados no fim.
async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  await H.login(page)
  const sb = await H.supabaseLogado()

  const hoje = new Date()
  const emDias = (n) => {
    const d = new Date(hoje.getTime() + n * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }

  const fixtures = [
    { contratado: 'DASH-FUTURA-ABERTA', contratante: { nome: 'DASH-FUTURA-ABERTA' }, ano: 2026, status: null, dataLicitacao: emDias(5), horaLicitacao: '09:00', tipoObjeto: 'Medicamentos' },
    { contratado: 'DASH-FUTURA-GANHA', contratante: { nome: 'DASH-FUTURA-GANHA' }, ano: 2026, status: 'Ganhou', dataLicitacao: emDias(6), horaLicitacao: '09:00', tipoObjeto: 'Medicamentos' },
    { contratado: 'DASH-PASSADA-ABERTA', contratante: { nome: 'DASH-PASSADA-ABERTA' }, ano: 2026, status: null, dataLicitacao: emDias(-10), horaLicitacao: '09:00', tipoObjeto: 'Materiais' },
    { contratado: 'DASH-PASSADA-PERDIDA', contratante: { nome: 'DASH-PASSADA-PERDIDA' }, ano: 2026, status: 'Perdeu', dataLicitacao: emDias(-3), horaLicitacao: '09:00', tipoObjeto: 'Materiais' },
  ]

  const criadas = []
  for (const f of fixtures) {
    const { data, error } = await sb.from('licitacoes').insert(f).select().single()
    if (error) { console.error('falha ao criar fixture:', error.message); process.exit(1) }
    criadas.push(data)
  }
  const limpar = async () => {
    for (const l of criadas) await sb.from('licitacoes').delete().eq('codigo', l.codigo)
  }

  try {
    await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 2500))

    const cards = await page.evaluate(() => {
      const pega = (titulo) => {
        const h = Array.from(document.querySelectorAll('h4')).find(x => x.textContent.trim().startsWith(titulo))
        return h ? h.closest('.bg-white').innerText : ''
      }
      return {
        proximas: pega('Próximas licitações'),
        aguardando: pega('Aguardando resultado'),
      }
    })

    H.secao('39. Painel — card "Próximas licitações"')
    H.check('card existe', cards.proximas.length > 0)
    H.check('mostra licitação em aberto com data futura', cards.proximas.includes('DASH-FUTURA-ABERTA'))
    H.check('NÃO mostra licitação já ganha (mesmo com data futura)', !cards.proximas.includes('DASH-FUTURA-GANHA'),
      'licitação decidida ainda aparece como próxima')
    H.check('NÃO mostra licitação com data passada', !cards.proximas.includes('DASH-PASSADA-ABERTA'))

    H.secao('40. Painel — card "Aguardando resultado"')
    H.check('card existe', cards.aguardando.length > 0)
    H.check('mostra licitação passada e sem status', cards.aguardando.includes('DASH-PASSADA-ABERTA'))
    H.check('NÃO mostra licitação passada já decidida', !cards.aguardando.includes('DASH-PASSADA-PERDIDA'))
    H.check('NÃO mostra licitação futura', !cards.aguardando.includes('DASH-FUTURA-ABERTA'))
    H.check('indica há quanto tempo está parada', /há \d+ dias?/.test(cards.aguardando), cards.aguardando.slice(0, 160).replace(/\n/g, ' | '))
    H.check('explica por que isso importa', cards.aguardando.includes('ficam fora dos relatórios'))

    H.secao('41. Painel — contador do topo')
    const contadorProximas = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.bg-white')).find(d => d.innerText.startsWith('Próximas licitações\n'))
      return el ? el.innerText.split('\n')[1] : null
    })
    const { data: todas } = await sb.from('licitacoes').select('status,dataLicitacao,horaLicitacao')
    const agora = Date.now()
    const esperado = todas.filter(l => {
      if (l.status) return false
      if (!l.dataLicitacao) return false
      const d = new Date(`${l.dataLicitacao.split('T')[0]}T${l.horaLicitacao || '00:00'}`)
      return d.getTime() >= agora
    }).length
    H.check('contador "Próximas licitações" bate com a regra (em aberto + futura)',
      Number(contadorProximas) === esperado, `tela: ${contadorProximas}, esperado: ${esperado}`)

    H.secao('42. Painel — estado vazio')
    // encerra a pendência e confere que o card esvazia
    const pendente = criadas.find(l => l.contratado === 'DASH-PASSADA-ABERTA')
    await sb.from('licitacoes').update({ status: 'Perdeu' }).eq('codigo', pendente.codigo)
    await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 2500))
    const aguardandoDepois = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h4')).find(x => x.textContent.trim().startsWith('Aguardando resultado'))
      return h ? h.closest('.bg-white').innerText : ''
    })
    H.check('lançar o resultado tira a licitação do card', !aguardandoDepois.includes('DASH-PASSADA-ABERTA'),
      aguardandoDepois.slice(0, 160).replace(/\n/g, ' | '))

    const errosReais = erros.filter(e => !e.includes('status of 400'))
    H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))
  } finally {
    await limpar()
    await browser.close()
  }

  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
