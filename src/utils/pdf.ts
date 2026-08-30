import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

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
  const primary = '#0F1B3D'
  const availableH = pdfPageHeight - headerHeight - footerHeight

  let pageIndex = 0
  let firstPage = true

  const drawHeaderFooter = () => {
    pageIndex += 1
    const rgb = hexToRgb(primary)
    pdf.setFillColor(rgb.r, rgb.g, rgb.b)
    pdf.rect(0, 0, pdfWidth, headerHeight, 'F')
    const accent = hexToRgb('#EF4136')
    pdf.setFillColor(accent.r, accent.g, accent.b)
    pdf.rect(12, 17, 6, 6, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.text('Botti Licita', 24, 28)
    pdf.setFontSize(10)
    pdf.setTextColor(240, 240, 240)
    pdf.text(title, pdfWidth - 12, 28, { align: 'right' })

    pdf.setFillColor(240, 240, 240)
    pdf.rect(0, pdfPageHeight - footerHeight, pdfWidth, footerHeight, 'F')
    pdf.setTextColor(60, 60, 60)
    pdf.setFontSize(10)
    pdf.text(`Página ${pageIndex}`, pdfWidth / 2 - 20, pdfPageHeight - footerHeight / 2 + 4)
  }

  // JPEG em vez de PNG: uma página cheia de texto anti-aliased comprime muito
  // mal em PNG (sem perdas) — no teste com 40 licitações isso gerava um PDF
  // de mais de 80MB. Em qualidade 0.85 o JPEG fica visualmente idêntico pra
  // esse tipo de conteúdo (fundo claro + texto) e reduz o arquivo em ~90%.
  const JPEG_QUALITY = 0.85

  const addImagePage = (dataUrl: string, renderedHeight: number) => {
    if (!firstPage) pdf.addPage()
    firstPage = false
    drawHeaderFooter()
    pdf.addImage(dataUrl, 'JPEG', 0, headerHeight + 8, pdfWidth, renderedHeight)
  }

  for (const el of elements) {
    const canvas = await html2canvas(el, { scale: 2 })
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
