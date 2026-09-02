// Abre um PDF no visualizador do Chrome e tira print, pra conferência visual.
const path = require('path')
const { pathToFileURL } = require('url')
const puppeteer = require('puppeteer')

async function main() {
  const arquivo = process.argv[2]
  const saida = process.argv[3]
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1000, height: 1300 })
  await page.goto(pathToFileURL(path.resolve(arquivo)).href, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 4000))
  await page.screenshot({ path: saida })
  console.log('print salvo em', saida)
  await browser.close()
}

main().catch(e => { console.error('erro:', e.message); process.exit(1) })
