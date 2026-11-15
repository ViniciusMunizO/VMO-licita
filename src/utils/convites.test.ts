import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: {} }))
vi.mock('./banco', () => ({ empresaAtual: () => 'e1' }))

import { codigoCompleto, linkDoConvite, normalizarCodigo } from './convites'

describe('código de convite', () => {
  it('aceita o código escrito de qualquer jeito', () => {
    expect(normalizarCodigo('abcde fgh23')).toBe('ABCDE-FGH23')
    expect(normalizarCodigo('  ABCDEFGH23 ')).toBe('ABCDE-FGH23')
    expect(normalizarCodigo('abcde-fgh23')).toBe('ABCDE-FGH23')
    expect(normalizarCodigo('abc')).toBe('ABC')
    expect(normalizarCodigo('')).toBe('')
  })

  it('só está completo com 10 letras/números', () => {
    expect(codigoCompleto('abcde fgh23')).toBe(true)
    expect(codigoCompleto('abcde-fgh2')).toBe(false)
    expect(codigoCompleto('abcde-fgh234')).toBe(false)
  })

  it('o link abre a página Criar conta com o código', () => {
    expect(linkDoConvite('ABCDE-FGH23', 'https://licitavmo.exemplo.invalid')).toBe(
      'https://licitavmo.exemplo.invalid/criar-conta?codigo=ABCDE-FGH23')
  })
})
