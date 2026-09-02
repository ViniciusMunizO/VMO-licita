// Gera os PDFs da aplicação e salva em scripts/_pdfs para conferência visual.
const fs = require('fs')
const path = require('path')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())
const DEST = path.join(__dirname, '_pdfs')

async function main() {
  fs.rmSync(DEST, { recursive: true, force: true })
  fs.mkdirSync(DEST, { recursive: true })

  const { browser, page, erros } = await H.novoBrowser()
  const cdp = await page.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DEST })

  await H.login(page)
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 2500))

  await H.clicarPorTexto(page, 'Exportar Itens (PDF)')
  await new Promise(r => setTimeout(r, 6000))

  await H.clicarPorTexto(page, 'Emitir Proposta (PDF)')
  await new Promise(r => setTimeout(r, 1200))
  if ((await H.texto(page)).includes('Conta bancária que vai aparecer na proposta')) {
    await page.evaluate(() => {
      const m = document.querySelector('.fixed.inset-0')
      Array.from(m.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gerar PDF')?.click()
    })
  }
  await new Promise(r => setTimeout(r, 6000))

  await H.clicarPorTexto(page, 'Declaração de Idoneidade')
  await new Promise(r => setTimeout(r, 6000))

  console.log('arquivos baixados:', fs.readdirSync(DEST))
  console.log('erros:', erros)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
