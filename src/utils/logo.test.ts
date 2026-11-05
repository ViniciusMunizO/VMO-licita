import { describe, expect, it } from 'vitest'
import { avisosDaLogo, LOGO_ALTURA_PT, LOGO_LARGURA_MAX_PT, medidaNoPdf } from './logo'

describe('logo no PDF', () => {
  it('altura fixa e largura pela proporção', () => {
    expect(medidaNoPdf(3)).toEqual({ largura: 3 * LOGO_ALTURA_PT, altura: LOGO_ALTURA_PT })
    expect(medidaNoPdf(1)).toEqual({ largura: LOGO_ALTURA_PT, altura: LOGO_ALTURA_PT })
  })
  it('logo muito comprida não passa da largura máxima (não encosta no título)', () => {
    const m = medidaNoPdf(12)
    expect(m.largura).toBe(LOGO_LARGURA_MAX_PT)
    expect(m.altura).toBeCloseTo(LOGO_LARGURA_MAX_PT / 12)
  })
  it('proporção inválida não desenha nada', () => {
    expect(medidaNoPdf(0)).toEqual({ largura: 0, altura: 0 })
    expect(medidaNoPdf(NaN)).toEqual({ largura: 0, altura: 0 })
  })
})

describe('avisos ao enviar a logo', () => {
  it('tamanho ideal: nenhum aviso', () => {
    expect(avisosDaLogo(600, 200)).toEqual([])
    expect(avisosDaLogo(500, 500)).toEqual([])
  })
  it('imagem pequena pode sair borrada', () => {
    expect(avisosDaLogo(150, 50)[0]).toContain('pequena')
  })
  it('muito comprida ou vertical', () => {
    expect(avisosDaLogo(1400, 200)[0]).toContain('comprida')
    expect(avisosDaLogo(200, 400)[0]).toContain('mais alta que larga')
  })
})
