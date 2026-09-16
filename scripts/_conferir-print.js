// Verificação visual only: screenshot de cada seção com o CSS de impressão
// aplicado (mesmo @media print do PDF), pra conferir o layout sem precisar
// rasterizar o PDF em si (poppler/ghostscript não estão disponíveis aqui).
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const SRC = path.join(__dirname, '_apresentacao-comercial.html')
const OUT_DIR = path.join(__dirname, '_shots', 'print')
const TMP_HTML = path.join(__dirname, '_shots', '_apresentacao-print-check.html')

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const fragmento = fs.readFileSync(SRC, 'utf8')
  fs.writeFileSync(TMP_HTML, `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8">\n${fragmento}\n</head><body></body></html>`, 'utf8')

  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1150, height: 1200 })
  await page.goto('file://' + TMP_HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMediaType('print')
  await new Promise(r => setTimeout(r, 300))

  const ids = ['capa', 'diagnostico', 'modulos', 'automacoes', 'seguranca', 'funcionamento', 'identidade', 'proposta']
  for (const id of ids) {
    const el = await page.$('#' + id)
    if (!el) { console.log('faltou:', id); continue }
    await el.screenshot({ path: path.join(OUT_DIR, id + '.png') })
  }
  await browser.close()
  fs.unlinkSync(TMP_HTML)
  console.log('prints em', OUT_DIR)
}
main().catch(e => { console.error(e); process.exit(1) })
