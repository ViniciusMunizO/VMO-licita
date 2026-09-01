const H = require('./_harness')

async function main() {
  const { browser, page, erros } = await H.novoBrowser()

  H.secao('1. Autenticação')

  // rota protegida sem login redireciona
  await page.goto(`${H.BASE}/licitacoes`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 600))
  H.check('rota protegida redireciona pro login quando deslogado', page.url().includes('/login'), page.url())

  // login com senha errada
  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  await page.type('#email', H.LOGIN)
  await page.type('#senha', 'senha-errada-999')
  await page.click('button[type="submit"]')
  await new Promise(r => setTimeout(r, 2000))
  const txtErro = await H.texto(page)
  H.check('login com senha errada mostra erro e não entra',
    txtErro.toLowerCase().includes('inválid') && page.url().includes('/login'), page.url())

  // login correto
  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  await page.type('#email', H.LOGIN)
  await page.type('#senha', H.SENHA)
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ])
  H.check('login com credenciais corretas entra no sistema', !page.url().includes('/login'), page.url())

  const txtDash = await H.texto(page)
  H.check('dashboard não mostra tela de conta aguardando ativação', !txtDash.includes('aguardando ativação'))

  // sessão persiste após reload (F5)
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  H.check('sessão persiste após recarregar a página', !page.url().includes('/login'), page.url())

  // "lembrar meu e-mail"
  await H.clicarPorTexto(page, 'Sair')
  await new Promise(r => setTimeout(r, 1200))
  H.check('logout volta pra tela de login', page.url().includes('/login'), page.url())

  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  const emailLembrado = await page.$eval('#email', el => el.value)
  H.check('e-mail não é lembrado quando a checkbox não foi marcada', emailLembrado === '', `valor: "${emailLembrado}"`)

  await page.type('#email', H.LOGIN)
  await page.type('#senha', H.SENHA)
  await page.click('input[type="checkbox"]')
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ])
  await H.clicarPorTexto(page, 'Sair')
  await new Promise(r => setTimeout(r, 1000))
  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  const emailLembrado2 = await page.$eval('#email', el => el.value)
  H.check('e-mail é lembrado quando a checkbox foi marcada', emailLembrado2 === H.LOGIN, `valor: "${emailLembrado2}"`)

  // botão mostrar/ocultar senha
  await page.type('#senha', 'teste123')
  const tipoAntes = await page.$eval('#senha', el => el.type)
  await H.clicarPorTexto(page, 'mostrar')
  const tipoDepois = await page.$eval('#senha', el => el.type)
  H.check('botão "mostrar" alterna a visibilidade da senha', tipoAntes === 'password' && tipoDepois === 'text', `${tipoAntes} → ${tipoDepois}`)

  H.secao('2. Navegação e permissões')
  await H.login(page)

  const rotas = [
    ['/', 'Bem-vindo'],
    ['/licitacoes', 'Licitações'],
    ['/relatorios', 'Relatórios'],
    ['/empresa', 'Informações da Empresa'],
    ['/users', 'Usuários'],
    ['/admin/audit', 'Registro de Auditoria'],
  ]
  for (const [rota, esperado] of rotas) {
    await page.goto(`${H.BASE}${rota}`, { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 900))
    const t = await H.texto(page)
    H.check(`rota ${rota} carrega (contém "${esperado}")`, t.includes(esperado), t.slice(0, 80).replace(/\n/g, ' '))
  }

  // links da navbar
  await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
  const navLinks = await page.$$eval('nav a', els => els.map(e => e.textContent.trim()).filter(Boolean))
  H.check('navbar tem os links principais',
    ['Licitações', 'Relatórios', 'Informações da Empresa', 'Usuários'].every(l => navLinks.some(n => n.includes(l))),
    JSON.stringify(navLinks))

  // o 400 abaixo vem do teste proposital de senha errada (resposta normal do Supabase)
  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
