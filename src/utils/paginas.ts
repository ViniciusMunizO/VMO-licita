// Onde virar a página quando um documento é mais alto que uma folha (usado em pdf.ts).
// Separado para poder testar sem navegador.

/**
 * Altura da próxima fatia a partir de `inicio`: o máximo que cabe na página, mas subindo o corte
 * até um espaço sem tinta (procura no último terço da página). O corte cai no meio desse espaço,
 * para sobrar folga embaixo da última linha e em cima da primeira linha da página seguinte.
 * Se não achar espaço vazio, corta no máximo.
 */
export function alturaDaFatia(inicio: number, maximo: number, total: number, semTinta: (y: number) => boolean): number {
  if (total - inicio <= maximo) return total - inicio
  const fimIdeal = inicio + maximo
  const limite = inicio + Math.floor(maximo * 2 / 3)
  for (let y = fimIdeal; y > limite; y--) {
    if (!semTinta(y)) continue
    let topoDoVazio = y
    while (topoDoVazio - 1 > limite && semTinta(topoDoVazio - 1)) topoDoVazio--
    return Math.floor((topoDoVazio + y + 1) / 2) - inicio
  }
  return maximo
}
