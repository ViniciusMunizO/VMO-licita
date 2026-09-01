const fs = require('fs')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())
if (!CODIGO) {
  console.error('Sem licitação de teste válida. Rode scripts/_t2-licitacoes.js antes desta suíte.')
  process.exit(1)
}

async function main() {
  const { browser, page, erros } = await H.novoBrowser()
  const sb = await H.supabaseLogado()
  const { data: perfil } = await sb.from('profiles').select('*').eq('id', (await sb.auth.getUser()).data.user.id).single()

  H.secao('25. Segurança — acesso anônimo')
  const anon = H.supabase()
  for (const tabela of ['licitacoes', 'items', 'attachments', 'atas', 'contratantes', 'empresa_info', 'profiles', 'audit_logs']) {
    const { data, error } = await anon.from(tabela).select('*')
    H.check(`anônimo não lê "${tabela}"`, !error && data.length === 0, error ? error.message : `linhas: ${data.length}`)
  }
  const { error: insErr } = await anon.from('licitacoes').insert({ ano: 2026, contratado: 'INVASOR' })
  H.check('anônimo não consegue inserir dados', !!insErr, insErr ? insErr.message : 'INSERÇÃO PASSOU!')

  H.secao('26. Segurança — autenticação')
  const { error: signupErr } = await anon.auth.signUp({ email: `teste.${Date.now()}@example.com`, password: 'Senha123456!' })
  H.check('cadastro público está desabilitado', !!signupErr, signupErr?.message || 'CADASTRO PERMITIDO!')

  const { error: anonErr } = await anon.auth.signInAnonymously()
  H.check('login anônimo está desabilitado', !!anonErr, anonErr?.message || 'LOGIN ANÔNIMO PERMITIDO!')

  const { error: brutErr } = await anon.auth.signInWithPassword({ email: H.LOGIN, password: 'chute-errado-123' })
  H.check('senha errada é rejeitada', !!brutErr, brutErr?.message)

  H.secao('27. Segurança — escalação de privilégio')
  const { error: roleErr } = await sb.from('profiles').update({ role: 'admin' }).eq('id', perfil.id)
  const { data: perfilDepois } = await sb.from('profiles').select('*').eq('id', perfil.id).single()
  H.check('usuário não consegue alterar o próprio papel (role travado)',
    !!roleErr || perfilDepois.role === perfil.role,
    roleErr ? roleErr.message : `role: ${perfil.role} → ${perfilDepois.role}`)

  const { error: ativoErr } = await sb.from('profiles').update({ ativo: false }).eq('id', perfil.id)
  const { data: perfilDepois2 } = await sb.from('profiles').select('*').eq('id', perfil.id).single()
  H.check('usuário não consegue alterar o próprio "ativo"',
    !!ativoErr || perfilDepois2.ativo === true,
    ativoErr ? ativoErr.message : `ativo: ${perfilDepois2.ativo}`)

  const { error: nomeErr } = await sb.from('profiles').update({ name: perfil.name }).eq('id', perfil.id)
  H.check('usuário ainda consegue atualizar o próprio nome', !nomeErr, nomeErr?.message)

  H.secao('28. Segurança — trilha de auditoria')
  const { data: logAntes } = await sb.from('audit_logs').select('*').limit(1).single()
  const { count: delCount, error: delErr } = await sb.from('audit_logs').delete({ count: 'exact' }).eq('id', logAntes.id)
  const { data: logDepois } = await sb.from('audit_logs').select('*').eq('id', logAntes.id).maybeSingle()
  H.check('log de auditoria não pode ser apagado', !!delErr || (logDepois !== null),
    delErr ? delErr.message : `linhas apagadas: ${delCount}`)

  const { error: updErr } = await sb.from('audit_logs').update({ action: 'ADULTERADO' }).eq('id', logAntes.id)
  const { data: logDepois2 } = await sb.from('audit_logs').select('*').eq('id', logAntes.id).maybeSingle()
  H.check('log de auditoria não pode ser alterado', !!updErr || logDepois2?.action === logAntes.action,
    updErr ? updErr.message : `action: ${logAntes.action} → ${logDepois2?.action}`)

  H.secao('29. Integridade de dados')
  const { data: itens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO)
  H.check('itens continuam vinculados à licitação certa', itens.every(i => i.licitacaoCodigo === CODIGO))
  H.check('nenhum item ficou com quantidade nula indevidamente',
    itens.every(i => i.quantidade !== null), JSON.stringify(itens.map(i => ({ d: i.descricao, q: i.quantidade }))))

  // cascade delete: apagar licitação apaga itens
  const { data: novaLic } = await sb.from('licitacoes').insert({ ano: 2026, contratado: 'TESTE CASCADE' }).select().single()
  await sb.from('items').insert({ licitacaoCodigo: novaLic.codigo, descricao: 'ITEM CASCADE', quantidade: 1 })
  await sb.from('licitacoes').delete().eq('codigo', novaLic.codigo)
  const { data: itensOrfaos } = await sb.from('items').select('*').eq('licitacaoCodigo', novaLic.codigo)
  H.check('apagar licitação apaga os itens dela (cascade)', itensOrfaos.length === 0, `órfãos: ${itensOrfaos.length}`)

  H.secao('30. Casos extremos de dados')
  const { data: itemBase } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO).limit(1).single()

  // número muito grande
  const { error: bigErr } = await sb.from('items').update({ quantidade: 999999999 }).eq('id', itemBase.id)
  H.check('aceita quantidade muito grande sem quebrar', !bigErr, bigErr?.message)

  // decimal com muitas casas
  const { error: decErr } = await sb.from('items').update({ valorCusto: 0.123456789 }).eq('id', itemBase.id)
  H.check('aceita decimal com muitas casas', !decErr, decErr?.message)

  // texto muito longo em campo livre
  const textoEnorme = 'X'.repeat(5000)
  const { error: longErr } = await sb.from('items').update({ descricao: textoEnorme }).eq('id', itemBase.id)
  H.check('aceita descrição muito longa sem quebrar', !longErr, longErr?.message)

  // restaura
  await sb.from('items').update({ descricao: itemBase.descricao, quantidade: itemBase.quantidade, valorCusto: itemBase.valorCusto }).eq('id', itemBase.id)

  H.secao('31. XSS / conteúdo malicioso é exibido como texto')
  const payload = '<img src=x onerror="window.__xss=1">ITEM XSS'
  await sb.from('items').update({ descricao: payload }).eq('id', itemBase.id)

  await H.login(page)
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1800))
  const xssExecutou = await page.evaluate(() => window.__xss === 1)
  H.check('conteúdo com HTML/script não é executado (React escapa)', !xssExecutou)
  const t = await H.texto(page)
  H.check('conteúdo malicioso aparece como texto literal', t.includes('ITEM XSS') || t.includes('onerror'), 'não encontrado na tela')

  // também no PDF (printElement usa outerHTML do DOM já escapado)
  const errosAntes = erros.length
  await H.clicarPorTexto(page, 'Exportar Itens (PDF)')
  await new Promise(r => setTimeout(r, 4000))
  const xssPdf = await page.evaluate(() => window.__xss === 1)
  H.check('conteúdo malicioso não executa na geração de PDF', !xssPdf)
  H.check('geração de PDF com conteúdo estranho não quebra', erros.length === errosAntes, JSON.stringify(erros.slice(errosAntes)))

  await sb.from('items').update({ descricao: itemBase.descricao }).eq('id', itemBase.id)

  H.secao('32. Edições simultâneas em itens diferentes')
  const { data: doisItens } = await sb.from('items').select('*').eq('licitacaoCodigo', CODIGO).limit(2)
  if (doisItens.length === 2) {
    await Promise.all([
      sb.from('items').update({ marca: 'MARCA-A' }).eq('id', doisItens[0].id),
      sb.from('items').update({ marca: 'MARCA-B' }).eq('id', doisItens[1].id),
    ])
    const { data: apos } = await sb.from('items').select('*').in('id', [doisItens[0].id, doisItens[1].id])
    const a = apos.find(i => i.id === doisItens[0].id)
    const b = apos.find(i => i.id === doisItens[1].id)
    H.check('editar dois itens ao mesmo tempo não sobrescreve um ao outro',
      a.marca === 'MARCA-A' && b.marca === 'MARCA-B', JSON.stringify({ a: a.marca, b: b.marca }))
    await sb.from('items').update({ marca: doisItens[0].marca }).eq('id', doisItens[0].id)
    await sb.from('items').update({ marca: doisItens[1].marca }).eq('id', doisItens[1].id)
  }

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
