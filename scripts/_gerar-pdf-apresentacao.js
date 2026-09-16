// Gera o PDF da apresentação comercial (scripts/_apresentacao-comercial.html)
// usando o Puppeteer que já é dependência do projeto (mesmo motor dos testes
// E2E). O arquivo-fonte é um fragmento (sem <html>/<head>/<body> — formato
// exigido pro Artifact), então aqui ele é embrulhado num documento completo
// antes de abrir no Chromium, e cada <section> vira uma página do PDF via
// CSS de impressão já embutido no próprio arquivo (@media print).
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const SRC = path.join(__dirname, '_apresentacao-comercial.html')
const OUT_DIR = path.join(__dirname, '_shots')
const TMP_HTML = path.join(OUT_DIR, '_apresentacao-print.html')
const OUT_PDF = path.join(__dirname, '..', 'Licita-VMO - Apresentacao Comercial.pdf')

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const fragmento = fs.readFileSync(SRC, 'utf8')
  // data-theme="light" força o tema claro independente do esquema de cor do
  // Chromium que gera o PDF — sem isso, se o ambiente tiver preferência por
  // escuro, o PDF sai gerado (e fixo) no tema escuro sem ninguém pedir.
  const full = `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8">\n${fragmento}\n</head><body></body></html>`
  fs.writeFileSync(TMP_HTML, full, 'utf8')

  const browser = await puppeteer.launch()
  try {
    const page = await browser.newPage()
    // Largura próxima da de uma página A4 paisagem: os grids de 2/3/4
    // colunas do design ficam do jeito pensado, em vez de empilhar como no
    // celular.
    await page.setViewport({ width: 1150, height: 1200 })
    await page.goto('file://' + TMP_HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.fonts.ready)

    await page.pdf({
      path: OUT_PDF,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  } finally {
    await browser.close()
  }

  fs.unlinkSync(TMP_HTML)
  console.log('PDF gerado em:', OUT_PDF)
}

main().catch(e => { console.error(e); process.exit(1) })
