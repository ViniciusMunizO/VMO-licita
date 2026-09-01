const fs = require('fs')
const puppeteer = require('puppeteer')

const envRaw = fs.readFileSync(__dirname + '/../.env', 'utf8')
const env = Object.fromEntries(envRaw.split('\n').filter(Boolean).map(l => {
  const i = l.indexOf('=')
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
}))

// Credenciais e alvo vêm de variáveis de ambiente — nunca ficam no código.
// A suíte cria e apaga dados de verdade no banco apontado pelo .env, então
// exige confirmação explícita pra não rodar por acidente num ambiente com
// dado real de cliente.
const BASE = process.env.TEST_BASE || 'http://localhost:5173'
const LOGIN = process.env.TEST_LOGIN
const SENHA = process.env.TEST_SENHA

if (process.env.CONFIRMO_TESTE !== 'sim' || !LOGIN || !SENHA) {
  console.error(`
Esta suíte cria e apaga dados no banco configurado em .env.
Rode assim (PowerShell):

  $env:CONFIRMO_TESTE="sim"; $env:TEST_LOGIN="seu@email"; $env:TEST_SENHA="suasenha"; node scripts/_t1-auth.js

Nunca rode apontando pra um banco com dados reais de cliente.
`)
  process.exit(1)
}

const resultados = []
let secaoAtual = ''

function secao(nome) {
  secaoAtual = nome
  console.log(`\n═══ ${nome} ═══`)
}

function check(descricao, condicao, detalhe) {
  const ok = !!condicao
  resultados.push({ secao: secaoAtual, descricao, ok, detalhe })
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} — ${descricao}${!ok && detalhe ? ` (${detalhe})` : ''}`)
  return ok
}

function resumo() {
  const falhas = resultados.filter(r => !r.ok)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TOTAL: ${resultados.length} checagens — ${resultados.length - falhas.length} OK, ${falhas.length} falha(s)`)
  if (falhas.length) {
    console.log('\nFALHAS:')
    for (const f of falhas) console.log(`  [${f.secao}] ${f.descricao}${f.detalhe ? ` — ${f.detalhe}` : ''}`)
  }
  console.log('═'.repeat(60))
  return falhas.length
}

async function novoBrowser() {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  const erros = []
  page.on('pageerror', e => erros.push('pageerror: ' + String(e)))
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text()
      // ignora ruído de rede irrelevante pro teste (favicon etc.)
      if (!t.includes('favicon')) erros.push('console: ' + t)
    }
  })
  return { browser, page, erros }
}

async function limparEDigitar(page, seletor, valor) {
  await page.focus(seletor)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(seletor, valor)
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
  // já logado (sessão restaurada)? o /login redireciona sozinho
  if (!page.url().includes('/login')) return
  await limparEDigitar(page, '#email', LOGIN)
  await limparEDigitar(page, '#senha', SENHA)
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ])
}

async function clicarPorTexto(page, texto, exato = true) {
  const botoes = await page.$$('button, a')
  for (const b of botoes) {
    const t = await page.evaluate(el => el.textContent, b)
    if (!t) continue
    const limpo = t.trim()
    if (exato ? limpo === texto : limpo.includes(texto)) { await b.click(); return true }
  }
  return false
}

async function texto(page) {
  return page.evaluate(() => document.body.innerText)
}

function supabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
}

async function supabaseLogado() {
  const sb = supabase()
  await sb.auth.signInWithPassword({ email: LOGIN, password: SENHA })
  return sb
}

module.exports = { BASE, LOGIN, SENHA, env, secao, check, resumo, novoBrowser, login, limparEDigitar, clicarPorTexto, texto, supabase, supabaseLogado, resultados }
