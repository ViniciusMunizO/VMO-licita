import { describe, expect, it } from 'vitest'
import { destinatario } from './declaracoes'

describe('para quem vai a proposta e as declarações', () => {
  it('nome de órgão vai como veio (sem "Prefeitura Municipal de" na frente)', () => {
    expect(destinatario('Universidade Estadual de Londrina', 'PR')).toBe('UNIVERSIDADE ESTADUAL DE LONDRINA/PR')
    expect(destinatario('MUNICÍPIO DE MARINGÁ', 'pr')).toBe('MUNICÍPIO DE MARINGÁ/PR')
    expect(destinatario('Secretaria de Estado da Saúde', '')).toBe('SECRETARIA DE ESTADO DA SAÚDE')
    expect(destinatario('Prefeitura de Curitiba', 'PR')).toBe('PREFEITURA DE CURITIBA/PR')
  })
  it('só o nome da cidade (cadastro antigo) continua indo para a prefeitura', () => {
    expect(destinatario('Curitiba', 'PR')).toBe('PREFEITURA MUNICIPAL DE CURITIBA/PR')
    expect(destinatario('São José dos Pinhais', null)).toBe('PREFEITURA MUNICIPAL DE SÃO JOSÉ DOS PINHAIS')
  })
  it('sem nome, fica vazio', () => {
    expect(destinatario('', 'PR')).toBe('')
    expect(destinatario(null, null)).toBe('')
  })
})
