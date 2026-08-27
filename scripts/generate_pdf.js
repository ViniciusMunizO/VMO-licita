const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

async function run() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(60000)

  const appUrl = 'http://localhost:5173/login'
  await page.goto(appUrl, { waitUntil: 'networkidle2' })

  // login as admin - locate inputs by order
  await page.waitForSelector('form')
  const inputs = await page.$$('form input')
  if (inputs.length >= 1) await inputs[0].click({ clickCount: 3 })
  if (inputs.length >= 1) await inputs[0].type('admin')
  if (inputs.length >= 2) await inputs[1].type('password')
  // submit the form
  const buttons = await page.$$('form button')
  if (buttons.length > 0) {
    await Promise.all([
      buttons[0].click(),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ])
  } else {
    await page.keyboard.press('Enter')
    await page.waitForNavigation({ waitUntil: 'networkidle2' })
  }

  // go to new licitacao
  await page.goto('http://localhost:5173/licitacoes/novo', { waitUntil: 'networkidle2' })
  // ensure printable elements are rendered in DOM (form loads and printable hidden nodes are created)
  await page.waitForSelector('#print-page-1')
  await page.waitForSelector('#print-page-2')

  // inject html2canvas and jspdf UMD builds into the page so they are available as globals
  await page.addScriptTag({ path: require.resolve('html2canvas/dist/html2canvas.min.js') })
  await page.addScriptTag({ path: require.resolve('jspdf/dist/jspdf.umd.min.js') })

  // evaluate and build PDF via html2canvas + jsPDF in page context
  const dataUri = await page.evaluate(async () => {
    // load globals
    const p1 = document.getElementById('print-page-1')
    const p2 = document.getElementById('print-page-2')
    if (!p1 || !p2) throw new Error('Print pages not found')
    // ensure libraries available
    // html2canvas and jspdf are loaded by the app bundles
    // convert nodes to canvases
    // eslint-disable-next-line no-undef
    const canvas1 = await html2canvas(p1, { scale: 2 })
    const img1 = canvas1.toDataURL('image/png')
    // eslint-disable-next-line no-undef
    const canvas2 = await html2canvas(p2, { scale: 2 })
    const img2 = canvas2.toDataURL('image/png')
    // eslint-disable-next-line no-undef
    const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' })
    const w = pdf.internal.pageSize.getWidth()
    const pimg1 = pdf.getImageProperties(img1)
    const h1 = (pimg1.height * w) / pimg1.width
    pdf.addImage(img1, 'PNG', 0, 0, w, h1)
    pdf.addPage()
    const pimg2 = pdf.getImageProperties(img2)
    const h2 = (pimg2.height * w) / pimg2.width
    pdf.addImage(img2, 'PNG', 0, 0, w, h2)
    return pdf.output('datauristring')
  })

  // convert dataURI to buffer
  const matches = dataUri.match(/^data:application\/pdf;filename=generated.pdf;base64,(.+)$/) || dataUri.match(/^data:application\/pdf;base64,(.+)$/) || dataUri.match(/^data:application\/(.+);base64,(.+)$/)
  let base64
  if (matches) {
    base64 = matches[matches.length - 1]
  } else {
    // fallback: strip data:*;base64,
    base64 = dataUri.split(',')[1]
  }

  const buffer = Buffer.from(base64, 'base64')
  const outPath = path.resolve(__dirname, '..', 'output', `checklist_${Date.now()}.pdf`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buffer)
  console.log('PDF salvo em', outPath)
  // also generate items-only PDF
  const dataUriItems = await page.evaluate(async () => {
    const p2 = document.getElementById('print-page-2')
    if (!p2) throw new Error('print-page-2 not found')
    // eslint-disable-next-line no-undef
    const canvas = await html2canvas(p2, { scale: 2 })
    const img = canvas.toDataURL('image/png')
    // eslint-disable-next-line no-undef
    const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' })
    const w = pdf.internal.pageSize.getWidth()
    const pimg = pdf.getImageProperties(img)
    const h = (pimg.height * w) / pimg.width
    pdf.addImage(img, 'PNG', 0, 0, w, h)
    return pdf.output('datauristring')
  })

  const base64Items = dataUriItems.split(',')[1]
  const bufferItems = Buffer.from(base64Items, 'base64')
  const outPathItems = path.resolve(__dirname, '..', 'output', `itens_${Date.now()}.pdf`)
  fs.writeFileSync(outPathItems, bufferItems)
  console.log('PDF de itens salvo em', outPathItems)

  await browser.close()
}

run().catch(err => { console.error(err); process.exit(1) })
