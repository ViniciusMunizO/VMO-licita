const fs = require('fs')
const path = require('path')
const H = require('./_harness')

const CODIGO = Number(fs.readFileSync(__dirname + '/_codigo-teste.txt', 'utf8').trim())
if (!CODIGO) {
  console.error('Sem licitação de teste válida. Rode scripts/_t2-licitacoes.js antes desta suíte.')
  process.exit(1)
}

const DEST = path.join(__dirname, '_pdfs')

// Baixa os PDFs gerados pela aplicação pra conferir o conteúdo do arquivo em
// si — não só se a geração não deu erro.
async function main() {
  fs.rmSync(DEST, { recursive: true, force: true })
  fs.mkdirSync(DEST, { recursive: true })

  const { browser, page, erros } = await H.novoBrowser()
  const cdp = await page.createCDPSession()
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DEST })

  await H.login(page)
  await page.goto(`${H.BASE}/licitacoes/${CODIGO}`, { waitUntil: 'networkidle0' })
  await new Promise(r => setTimeout(r, 2500))

  H.secao('38. Cabeçalho dos PDFs: logo da empresa, sem marca do sistema')

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

  await H.clicarPorTexto(page, 'Declaração Unificada')
  await new Promise(r => setTimeout(r, 6000))

  const arquivos = fs.readdirSync(DEST).filter(f => f.endsWith('.pdf'))
  H.check('os três tipos de PDF são gerados e baixados', arquivos.length === 3, JSON.stringify(arquivos))

  const esperado = [
    ['itens', 'Itens'],
    ['proposta', 'Proposta'],
    ['declaracao', 'Unificada'],
  ]

  for (const [prefixo, tituloEsperado] of esperado) {
    const arquivo = arquivos.find(f => f.startsWith(prefixo))
    if (!arquivo) { H.check(`PDF "${prefixo}" foi gerado`, false); continue }
    const bytes = fs.readFileSync(path.join(DEST, arquivo))
    const conteudo = bytes.toString('latin1')

    H.check(`[${prefixo}] não contém o nome do sistema (Licita-VMO)`, !conteudo.includes('Licita-VMO'))
    H.check(`[${prefixo}] não contém "Licita VMO" em nenhuma variação`, !/Licita[-\s]?VMO/i.test(conteudo))
    H.check(`[${prefixo}] traz o nome do documento no cabeçalho`, conteudo.includes(tituloEsperado), `procurando "${tituloEsperado}"`)
    H.check(`[${prefixo}] tem imagem embutida (a logo)`, conteudo.includes('/XObject'))
    H.check(`[${prefixo}] arquivo tem tamanho plausível`, bytes.length > 20000, `${(bytes.length / 1024).toFixed(0)} KB`)

    // Nenhuma imagem transparente: com transparência, cada visualizador
    // escolhe contra o que compor (o Chrome usa branco, mas Adobe Reader e o
    // preview do Windows usam preto) e a logo aparecia dentro de um retângulo
    // preto. Sem canal alfa, sai igual em qualquer visualizador.
    H.check(`[${prefixo}] nenhuma imagem com máscara de transparência (/SMask)`, !conteudo.includes('/SMask'),
      'imagem transparente pode sair com fundo preto dependendo do visualizador')
    H.check(`[${prefixo}] nenhuma máscara em tons de cinza embutida`, !conteudo.includes('/ColorSpace /DeviceGray'))
  }

  const errosReais = erros.filter(e => !e.includes('status of 400'))
  H.check('nenhum erro inesperado de console/página', errosReais.length === 0, JSON.stringify(errosReais.slice(0, 3)))

  fs.rmSync(DEST, { recursive: true, force: true })
  await browser.close()
  process.exit(H.resumo() > 0 ? 1 : 0)
}

main().catch(e => { console.error('erro geral:', e); process.exit(1) })
