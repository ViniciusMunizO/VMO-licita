import { describe, expect, it } from 'vitest'
import { alturaDaFatia } from './paginas'

// Simula a imagem do documento: linhas com texto (tinta) e faixas vazias entre elas.
function documento(linhasComTinta: [number, number][]) {
  return (y: number) => !linhasComTinta.some(([a, b]) => y >= a && y <= b)
}

describe('virar a página sem cortar linha', () => {
  it('o resto cabe: leva tudo', () => {
    expect(alturaDaFatia(900, 1000, 1500, () => false)).toBe(600)
  })
  it('a linha de texto passa do fim da página: corta no meio do espaço antes dela', () => {
    // texto de 940 a 960 e de 980 a 1010; o fim ideal (1000) cai no meio do segundo:
    // o espaço vazio vai de 961 a 979, então corta em 970 (folga dos dois lados)
    const semTinta = documento([[940, 960], [980, 1010]])
    expect(alturaDaFatia(0, 1000, 3000, semTinta)).toBe(970)
  })
  it('o fim ideal cai num espaço vazio: corta no meio dele', () => {
    // vazio de 991 a 1000 (o fim ideal): corta em 996
    expect(alturaDaFatia(0, 1000, 3000, documento([[900, 990], [1001, 1100]]))).toBe(996)
  })
  it('nenhuma linha com tinta é cortada (simulação de uma tabela longa)', () => {
    // linhas de texto de 20 px a cada 34 px
    const linhas: [number, number][] = Array.from({ length: 300 }, (_, i) => [i * 34 + 7, i * 34 + 27])
    const semTinta = documento(linhas)
    let y = 0
    while (y < 10_000) {
      const h = alturaDaFatia(y, 1234, 10_000, semTinta)
      y += h
      if (y < 10_000) { expect(semTinta(y - 1)).toBe(true); expect(semTinta(y)).toBe(true) }
    }
  })
  it('sem nenhum espaço vazio no último terço (imagem cheia): corta no máximo', () => {
    expect(alturaDaFatia(0, 900, 3000, () => false)).toBe(900)
  })
  it('funciona a partir do meio do documento', () => {
    // vazio de 1667 (limite) a 1989: corta no meio, sem passar do último terço
    const semTinta = documento([[1600, 1666], [1990, 2030]])
    expect(alturaDaFatia(1000, 1000, 5000, semTinta)).toBe(828)
  })
})
