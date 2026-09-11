// Tira print das telas principais pra conferir a paleta a olho — não valida
// nada sozinho, é só pra olhar. As imagens vão pra scripts/_shots/, que é
// ignorada pelo git.
const fs = require('fs')
const H = require('./_harness')

const DIR = __dirname + '/_shots'
async function main() {
  fs.mkdirSync(DIR, { recursive: true })
  const { browser, page, erros } = await H.novoBrowser()
  await page.setViewport({ width: 1500, height: 980 })

  await page.goto(`${H.BASE}/login`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 1200))
  await page.screenshot({ path: DIR + '/login.png' })

  await H.login(page)
  await page.goto(`${H.BASE}/`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 2000))
  await page.screenshot({ path: DIR + '/dashboard.png', fullPage: true })

  await page.goto(`${H.BASE}/relatorios`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 2000))
  await page.screenshot({ path: DIR + '/relatorios.png' })

  console.log('prints em scripts/_shots/ | erros:', erros.filter(e => !e.includes('status of 400')))
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
