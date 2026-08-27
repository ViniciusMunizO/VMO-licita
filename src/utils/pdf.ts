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

export async function exportElementsToPdf(elements: HTMLElement[], filename = 'documento.pdf', title = 'Documento') {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfPageHeight = pdf.internal.pageSize.getHeight()

  const headerHeight = 44
  const footerHeight = 30
  const primary = '#2C2D7D'
  const secondary = '#5f60af'

  let pageIndex = 0

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    const canvas = await html2canvas(el, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const imgProps = pdf.getImageProperties(imgData)
    let imgRenderedHeight = (imgProps.height * pdfWidth) / imgProps.width

    const availableH = pdfPageHeight - headerHeight - footerHeight
    if (imgRenderedHeight > availableH) {
      const scale = availableH / imgRenderedHeight
      imgRenderedHeight = imgRenderedHeight * scale
    }

    if (i > 0) pdf.addPage()
    pageIndex += 1

    // draw header
    const rgb = hexToRgb(primary)
    pdf.setFillColor(rgb.r, rgb.g, rgb.b)
    pdf.rect(0, 0, pdfWidth, headerHeight, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.text('Botti Licita', 12, 28)
    pdf.setFontSize(10)
    pdf.setTextColor(240, 240, 240)
    pdf.text(`${title} — página ${pageIndex}`, pdfWidth - 12, 28, { align: 'right' })

    // add the content image below header
    const y = headerHeight + 8
    pdf.addImage(imgData, 'PNG', 0, y, pdfWidth, imgRenderedHeight)

    // footer with page number
    pdf.setFillColor(240, 240, 240)
    pdf.rect(0, pdfPageHeight - footerHeight, pdfWidth, footerHeight, 'F')
    pdf.setTextColor(60, 60, 60)
    pdf.setFontSize(10)
    pdf.text(`Página ${pageIndex}`, pdfWidth / 2 - 20, pdfPageHeight - footerHeight / 2 + 4)
  }

  pdf.save(filename)
}

