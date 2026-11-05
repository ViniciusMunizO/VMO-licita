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
  it('a linha de texto passa do fim da página: corta antes dela', () => {
    // texto de 980 a 1010; o fim ideal (1000) cai no meio dele -> corta em 979
    const semTinta = documento([[940, 960], [980, 1010]])
    expect(alturaDaFatia(0, 1000, 3000, semTinta)).toBe(979)
  })
  it('o fim ideal cai num espaço vazio: corta ali mesmo', () => {
    expect(alturaDaFatia(0, 1000, 3000, documento([[900, 990]]))).toBe(1000)
  })
  it('sem nenhum espaço vazio no último terço (imagem cheia): corta no máximo', () => {
    expect(alturaDaFatia(0, 900, 3000, () => false)).toBe(900)
  })
  it('funciona a partir do meio do documento', () => {
    const semTinta = documento([[1990, 2030]])
    expect(alturaDaFatia(1000, 1000, 5000, semTinta)).toBe(989)
  })
})
