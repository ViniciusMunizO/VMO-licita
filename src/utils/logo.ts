// Medidas da logo da empresa no cabeçalho dos PDFs (pdf.ts) e a orientação mostrada em
// "Informações da Empresa" para quem envia a imagem.
//
// No PDF (A4, em pontos: 72 pt = 2,54 cm) a logo tem altura fixa e a largura segue a proporção
// da imagem, até um limite para não encostar no título do documento, que fica à direita.

export const LOGO_ALTURA_PT = 28 // ≈ 1 cm
export const LOGO_LARGURA_MAX_PT = 168 // ≈ 6 cm (6 vezes a altura)

/** Proporção (largura ÷ altura) que melhor ocupa o espaço: horizontal, 3 por 1. */
export const LOGO_PROPORCAO_IDEAL = 3
export const LOGO_IDEAL_PX = { largura: 600, altura: 200 }
const ALTURA_MINIMA_PX = 100 // abaixo disso a logo fica borrada na impressão

export const LOGO_ORIENTACAO =
  `Tamanho ideal: ${LOGO_IDEAL_PX.largura} × ${LOGO_IDEAL_PX.altura} pixels (horizontal, 3 por 1), ` +
  'com fundo branco ou transparente e cores escuras. No documento ela sai com cerca de 1 cm de altura e até 6 cm de largura.'

/** Tamanho da logo no PDF (em pontos), respeitando a altura fixa e a largura máxima. */
export function medidaNoPdf(aspecto: number): { largura: number; altura: number } {
  if (!(aspecto > 0)) return { largura: 0, altura: 0 }
  const largura = LOGO_ALTURA_PT * aspecto
  if (largura <= LOGO_LARGURA_MAX_PT) return { largura, altura: LOGO_ALTURA_PT }
  return { largura: LOGO_LARGURA_MAX_PT, altura: LOGO_LARGURA_MAX_PT / aspecto }
}

/** Avisos (não impedem o envio) quando a imagem foge do tamanho que encaixa bem no documento. */
export function avisosDaLogo(larguraPx: number, alturaPx: number): string[] {
  if (!(larguraPx > 0 && alturaPx > 0)) return []
  const avisos: string[] = []
  const aspecto = larguraPx / alturaPx
  if (alturaPx < ALTURA_MINIMA_PX) {
    avisos.push(`A imagem é pequena (${larguraPx} × ${alturaPx} pixels) e pode sair borrada. Use pelo menos ${LOGO_IDEAL_PX.altura} pixels de altura.`)
  }
  if (aspecto > LOGO_LARGURA_MAX_PT / LOGO_ALTURA_PT) {
    avisos.push('A logo é muito comprida: no documento ela vai ficar baixinha. Prefira uma versão de até 6 por 1, como 600 × 200.')
  } else if (aspecto < 1) {
    avisos.push('A logo é mais alta que larga: no documento ela vai ficar pequena. Se tiver, use a versão horizontal (ex.: 600 × 200).')
  }
  return avisos
}
