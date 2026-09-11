// Gera public/favicon.png a partir do símbolo da logo, em tamanho de ícone.
// Roda de novo se a logo do sistema mudar.
const fs = require('fs')
const puppeteer = require('puppeteer')

const ORIGEM = 'src/assets/logo-vmo-simbolo.png'
const DESTINO = 'public/favicon.png'
const LADO = 128

async function main() {
  const b64 = fs.readFileSync(ORIGEM).toString('base64')
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.goto('about:blank')
    const dataUrl = await page.evaluate(async ({ src, lado }) => {
      const img = new Image()
      img.src = src
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })

      const c = document.createElement('canvas')
      c.width = lado
      c.height = lado
      const ctx = c.getContext('2d')
      // centraliza mantendo a proporção, com fundo transparente (o símbolo é
      // turquesa e lê bem tanto em aba clara quanto escura)
      const escala = Math.min(lado / img.naturalWidth, lado / img.naturalHeight)
      const w = img.naturalWidth * escala
      const h = img.naturalHeight * escala
      ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h)
      return c.toDataURL('image/png')
    }, { src: 'data:image/png;base64,' + b64, lado: LADO })

    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync(DESTINO, Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log(`${DESTINO} gerado (${LADO}x${LADO}, ${(fs.statSync(DESTINO).size / 1024).toFixed(1)} KB)`)
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
