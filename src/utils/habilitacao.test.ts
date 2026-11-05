import { describe, expect, it } from 'vitest'
import { itensComChave, itensDaEmpresa, itensDaLicitacao, itensDeTexto, ITENS_HABILITACAO_PADRAO, marcarPeloEdital } from './habilitacao'

describe('lista de itens da empresa', () => {
  it('um item por linha, vírgula não separa, sem repetidos nem vazios', () => {
    expect(itensDeTexto('Habilitação Fiscal, Social e Trabalhista\n\n  Anvisa \nANVISA\nQualificação  Técnica'))
      .toEqual(['Habilitação Fiscal, Social e Trabalhista', 'Anvisa', 'Qualificação Técnica'])
  })
  it('sem lista salva, vale o padrão', () => {
    expect(itensDaEmpresa(null)).toEqual(ITENS_HABILITACAO_PADRAO)
    expect(itensDaEmpresa({ itensHabilitacao: [] })).toEqual(ITENS_HABILITACAO_PADRAO)
    expect(itensDaEmpresa({ itensHabilitacao: ['Anvisa'] })).toEqual(['Anvisa'])
  })
})

describe('chave de cada item', () => {
  it('o padrão usa as chaves antigas onde dá, para as licitações já salvas', () => {
    expect(itensComChave(ITENS_HABILITACAO_PADRAO).map(i => i.chave)).toEqual([
      'habilitacaoJuridica', 'habilitacaoFiscal', 'balanco', 'item:Qualificação Técnica',
    ])
  })
  it('item novo ganha chave própria; repetido não entra duas vezes', () => {
    expect(itensComChave(['Anvisa', 'Registro no CREA', 'anvisa (AFE)'])).toEqual([
      { chave: 'anvisa', rotulo: 'Anvisa' },
      { chave: 'item:Registro no CREA', rotulo: 'Registro no CREA' },
      { chave: 'item:anvisa (AFE)', rotulo: 'anvisa (AFE)' },
    ])
  })
})

describe('itens numa licitação', () => {
  it('licitação antiga: o que estava marcado e saiu da lista continua aparecendo', () => {
    const antiga = { habilitacaoJuridica: true, anvisa: true, bula: false, laudo: false, outras: false }
    expect(itensDaLicitacao(ITENS_HABILITACAO_PADRAO, antiga).map(i => i.rotulo)).toEqual([
      'Habilitação Jurídica', 'Habilitação Fiscal, Social e Trabalhista',
      'Qualificação Econômico-Financeira (Balanço)', 'Qualificação Técnica', 'Anvisa',
    ])
  })
  it('item próprio marcado que saiu da lista também continua', () => {
    const h = { 'item:Registro no CREA': true, 'item:Alvará': false }
    expect(itensDaLicitacao(['Habilitação Jurídica'], h).map(i => i.rotulo)).toEqual(['Habilitação Jurídica', 'Registro no CREA'])
  })
  it('mesmo item escrito com outra maiúscula ou acento usa a marcação já gravada', () => {
    const h = { 'item:Qualificação Técnica': true }
    expect(itensDaLicitacao(['Qualificacao tecnica'], h)).toEqual([{ chave: 'item:Qualificação Técnica', rotulo: 'Qualificacao tecnica' }])
  })
})

describe('sugestão pelo edital', () => {
  const documentos = [
    'Contrato social', 'Certidão negativa de débitos trabalhistas (CNDT)', 'Balanço patrimonial do último exercício',
    'Autorização de Funcionamento (AFE) da ANVISA', 'Atestado de capacidade técnica', 'Registro no CREA',
  ]
  it('empresa com a lista padrão: Anvisa e CREA vão para "Outras"', () => {
    const r = marcarPeloEdital(ITENS_HABILITACAO_PADRAO, documentos)
    expect(r.marcados).toEqual({ habilitacaoJuridica: true, habilitacaoFiscal: true, balanco: true, 'item:Qualificação Técnica': true })
    expect(r.sobras).toEqual(['Autorização de Funcionamento (AFE) da ANVISA', 'Registro no CREA'])
  })
  it('empresa que tem Anvisa e CREA na lista: marca os dois', () => {
    const r = marcarPeloEdital(['Habilitação Jurídica', 'Anvisa', 'Registro no CREA'], documentos)
    expect(r.marcados).toEqual({ habilitacaoJuridica: true, anvisa: true, 'item:Registro no CREA': true })
    expect(r.sobras).toEqual([
      'Certidão negativa de débitos trabalhistas (CNDT)', 'Balanço patrimonial do último exercício', 'Atestado de capacidade técnica',
    ])
  })
})
