import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import logoUrl from '../assets/logo-botti.png'

// A logo entra no PDF como imagem, então precisa virar base64. O arquivo é o
// mesmo que o Vite já empacota pra tela; carregamos uma vez e reaproveitamos.
//
// A logo original é PNG com fundo transparente, e aí cada visualizador de PDF
// decide contra o que compor esse transparente — Chrome usa branco, mas
// Adobe Reader e o preview do Windows usam preto, e a logo saía dentro de um
// retângulo preto. Por isso ela é desenhada sobre um fundo branco e
// convertida pra JPEG, que não tem canal alfa: sem transparência, não há o
// que o visualizador decidir, e o resultado é igual em qualquer um.
//
// A proporção vem do próprio arquivo: trocar a logo por a de outro cliente
// não exige mexer em nenhuma medida aqui.
let logoCache: { dataUrl: string; aspecto: number } | null = null
async function carregarLogo(): Promise<{ dataUrl: string; aspecto: number } | null> {
  if (logoCache) return logoCache
  try {
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    logoCache = {
      // 0.98: a logo é pequena no papel e tem bordas duras, então vale
      // gastar bytes pra não aparecer artefato de compressão em volta dela
      dataUrl: canvas.toDataURL('image/jpeg', 0.98),
      aspecto: img.naturalWidth / img.naturalHeight,
    }
    return logoCache
  } catch (err) {
    // Sem a logo o documento ainda sai — só com o título.
    return null
  }
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

// Recorta uma faixa horizontal do canvas de origem (em pixels do canvas) para
// um canvas novo — usado para dividir um elemento alto em várias páginas de
// PDF, em vez de espremer o conteúdo inteiro numa página só.
function fatiarCanvas(origem: HTMLCanvasElement, sy: number, altura: number): HTMLCanvasElement {
  const fatia = document.createElement('canvas')
  fatia.width = origem.width
  fatia.height = altura
  const ctx = fatia.getContext('2d')!
  ctx.drawImage(origem, 0, sy, origem.width, altura, 0, 0, origem.width, altura)
  return fatia
}

export async function exportElementsToPdf(
  elements: HTMLElement[],
  filename = 'documento.pdf',
  title = 'Documento',
  orientation: 'portrait' | 'landscape' = 'portrait'
) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation })
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfPageHeight = pdf.internal.pageSize.getHeight()

  const headerHeight = 44
  const footerHeight = 30
  // Cor do cabeçalho do documento (título e filete). Acompanha a logo do
  // CLIENTE, não a paleta do sistema — o documento é dele e vai assinado por
  // ele. Ao trocar a logo do cliente, ajustar esta cor junto.
  const primary = '#0F1B3D'
  const availableH = pdfPageHeight - headerHeight - footerHeight

  let pageIndex = 0
  let firstPage = true

  // O cabeçalho leva a logo da empresa que usa o sistema e o nome do
  // documento — nada de marca do sistema. Fundo claro de propósito: a logo é
  // azul-marinho sobre transparente, então sumiria num cabeçalho escuro.
  const logo = await carregarLogo()
  const logoAltura = 28
  const logoLargura = logo ? logoAltura * logo.aspecto : 0

  const drawHeaderFooter = () => {
    pageIndex += 1
    const rgb = hexToRgb(primary)

    if (logo) {
      pdf.addImage(logo.dataUrl, 'JPEG', 12, (headerHeight - logoAltura) / 2, logoLargura, logoAltura)
    }

    pdf.setTextColor(rgb.r, rgb.g, rgb.b)
    pdf.setFontSize(11)
    pdf.text(title, pdfWidth - 12, headerHeight / 2 + 4, { align: 'right' })

    // filete que separa o cabeçalho do conteúdo
    pdf.setDrawColor(rgb.r, rgb.g, rgb.b)
    pdf.setLineWidth(1)
    pdf.line(12, headerHeight, pdfWidth - 12, headerHeight)

    pdf.setFillColor(240, 240, 240)
    pdf.rect(0, pdfPageHeight - footerHeight, pdfWidth, footerHeight, 'F')
    pdf.setTextColor(60, 60, 60)
    pdf.setFontSize(10)
    pdf.text(`Página ${pageIndex}`, pdfWidth / 2 - 20, pdfPageHeight - footerHeight / 2 + 4)
  }

  // JPEG em vez de PNG: uma página cheia de texto anti-aliased comprime muito
  // mal em PNG (sem perdas) — no teste com 40 licitações isso gerava um PDF
  // de mais de 80MB. Em 0.85 o arquivo ficava pequeno mas o texto saía com
  // aquele efeito de "borrado"/artefato de compressão (visível de perto).
  // 0.97 ainda reduz bastante o tamanho frente ao PNG (que é sem perdas),
  // mas com um nível de compressão baixo o bastante pra não degradar borda
  // de texto de forma perceptível.
  const JPEG_QUALITY = 0.97

  const addImagePage = (dataUrl: string, renderedHeight: number) => {
    if (!firstPage) pdf.addPage()
    firstPage = false
    drawHeaderFooter()
    pdf.addImage(dataUrl, 'JPEG', 0, headerHeight + 8, pdfWidth, renderedHeight)
  }

  for (const el of elements) {
    const canvas = await html2canvas(el, { scale: 3 })
    const renderedFullHeight = (canvas.height * pdfWidth) / canvas.width

    if (renderedFullHeight <= availableH) {
      // Cabe inteiro numa página, sem precisar reduzir nem fatiar.
      addImagePage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), renderedFullHeight)
      continue
    }

    // Conteúdo mais alto que uma página: em vez de encolher tudo pra caber
    // numa página só (o que deixava relatórios longos ilegíveis), fatia o
    // canvas em pedaços do tamanho de uma página e continua em páginas
    // seguintes — o corte pode cair no meio de uma linha da tabela, mas o
    // texto continua no tamanho normal, legível.
    const pxPorPt = canvas.width / pdfWidth
    const alturaFatiaPx = Math.max(1, Math.floor(availableH * pxPorPt))
    let sy = 0
    while (sy < canvas.height) {
      const alturaEstaFatia = Math.min(alturaFatiaPx, canvas.height - sy)
      const fatia = fatiarCanvas(canvas, sy, alturaEstaFatia)
      const alturaRenderizada = (alturaEstaFatia * pdfWidth) / canvas.width
      addImagePage(fatia.toDataURL('image/jpeg', JPEG_QUALITY), alturaRenderizada)
      sy += alturaEstaFatia
    }
  }

  pdf.save(filename)
}
