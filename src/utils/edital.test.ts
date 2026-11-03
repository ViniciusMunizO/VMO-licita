import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import { itensDePncp, juntarItens, partesDoNumero, normalizarDisputa, normalizarJulgamento, numeroBR, preencherDoEdital, primeiraData, sugerirTipoObjeto, type EditalDoRascunho } from './edital'

const campo = (valor: string | null, pagina = 3) => ({ valor, pagina: valor ? pagina : null, trecho: valor, confianca: 'alta' as const })

describe('normalizações', () => {
  it('tipo de disputa vira uma das opções do formulário', () => {
    expect(normalizarDisputa('Aberto')).toBe('Aberto')
    expect(normalizarDisputa('modo de disputa aberto e fechado')).toBe('Aberto-Fechado')
    expect(normalizarDisputa('Fechado/Aberto')).toBe('Fechado-Aberto')
    expect(normalizarDisputa('fechado')).toBe('Fechado')
    expect(normalizarDisputa('não informado')).toBe('')
    expect(normalizarDisputa(null)).toBe('')
  })

  it('julgamento por lote, grupo ou global vira Lote; por item vira Item', () => {
    expect(normalizarJulgamento('Menor preço por item')).toBe('Item')
    expect(normalizarJulgamento('Menor preço por lote')).toBe('Lote')
    expect(normalizarJulgamento('menor preço global')).toBe('Lote')
    expect(normalizarJulgamento('maior desconto')).toBe('')
  })

  it('data do texto vai para o formato do formulário; texto sem data fica vazio', () => {
    expect(primeiraData('Até 10/11/2026 às 17h')).toBe('2026-11-10')
    expect(primeiraData('até 3 dias úteis antes da sessão')).toBe('')
    expect(primeiraData('32/13/2026')).toBe('')
  })

  it('números no jeito brasileiro', () => {
    expect(numeroBR('1.234,50')).toBe(1234.5)
    expect(numeroBR('R$ 12,90')).toBe(12.9)
    expect(numeroBR('300')).toBe(300)
    expect(numeroBR('')).toBeNull()
    expect(numeroBR('caixa')).toBeNull()
  })

  it('tipo de objeto sugerido pelos textos', () => {
    expect(sugerirTipoObjeto(['Aquisição de medicamentos'])).toBe('Medicamentos')
    expect(sugerirTipoObjeto(['Material de limpeza'])).toBe('Materiais')
    expect(sugerirTipoObjeto(['Dipirona comprimido', 'Luva de procedimento'])).toBe('Misto')
    expect(sugerirTipoObjeto(['Serviço de vigilância'])).toBe('')
  })
})

describe('preencherDoEdital', () => {
  const base: EditalDoRascunho = {
    numero: 'X', status: 'pronto', avisos: [],
    pncp: { plataforma: 'https://compras.exemplo.invalid', modoDisputa: 'Aberto', modalidade: 'Pregão', valorEstimado: 100 },
    resumo: null,
  }

  it('sem leitura do edital: usa o que o PNCP tem e marca a origem', () => {
    const p = preencherDoEdital(base)
    expect(p.campos).toMatchObject({ portal: 'https://compras.exemplo.invalid', tipoDisputa: 'Aberto' })
    expect(p.origem.portal).toEqual({ fonte: 'pncp' })
    expect(p.itens).toEqual([])
    expect(p.habilitacao).toEqual({})
  })

  it('com a leitura: preenche tudo o que o edital traz, com página e trecho', () => {
    const p = preencherDoEdital({
      ...base,
      resumo: {
        objeto: campo('Aquisição de medicamentos'),
        plataforma: campo('BLL Compras'),
        modoDisputa: campo('aberto e fechado'),
        criterioJulgamento: campo('menor preço por item'),
        prazoImpugnacao: campo('até 10/11/2026'),
        validadeProposta: campo('60 dias'),
        prazoEntrega: campo('10 dias após o empenho', 12),
        localEntrega: campo('Almoxarifado central'),
        prazoPagamento: campo('30 dias'),
        garantia: { ...campo('12 meses'), confianca: 'baixa' },
        vigencia: campo('12 meses'),
        documentosHabilitacao: [
          { descricao: 'Contrato social' }, { descricao: 'Certidão negativa de débitos trabalhistas (CNDT)' },
          { descricao: 'Balanço patrimonial do último exercício' }, { descricao: 'Autorização de Funcionamento (AFE) da ANVISA' },
          { descricao: 'Atestado de capacidade técnica' },
        ],
        declaracoes: [{ descricao: 'Não emprega menor' }],
        itens: [
          { numero: '1', descricao: 'Dipirona 500 mg', quantidade: '1.000', unidade: 'CP', valorUnitario: '0,25' },
          { numero: null, descricao: 'Soro fisiológico', quantidade: null, unidade: null, valorUnitario: null },
          { numero: '3', descricao: '  ', quantidade: '1', unidade: 'UN', valorUnitario: '1' },
        ],
      },
    })
    expect(p.campos).toEqual({
      portal: 'BLL Compras', tipoDisputa: 'Aberto-Fechado', definJulgamento: 'Item', dataLimiteImpugnacao: '2026-11-10',
      prazoValidade: '60 dias', prazoEntrega: '10 dias após o empenho', localEntrega: 'Almoxarifado central',
      prazoPagamento: '30 dias', prazoGarantia: '12 meses', vigenciaContrato: '12 meses', tipoObjeto: 'Medicamentos',
    })
    expect(p.origem.prazoEntrega).toEqual({ fonte: 'edital', pagina: 12, trecho: '10 dias após o empenho', confianca: 'alta' })
    expect(p.origem.prazoGarantia.confianca).toBe('baixa')
    expect(p.origem.tipoObjeto).toEqual({ fonte: 'sugestao' })
    expect(p.habilitacao).toMatchObject({ habilitacaoJuridica: true, habilitacaoFiscal: true, balanco: true, anvisa: true, outras: true })
    expect(p.habilitacao.outrasTexto).toBe('Atestado de capacidade técnica\nDeclaração: Não emprega menor')
    // Item sem descrição fica de fora; sem número ganha a posição.
    expect(p.itens).toEqual([
      { item: '1', descricao: 'Dipirona 500 mg', unidade: 'CP', quantidade: 1000, valorUnitMunicipio: 0.25, valorTotalMunicipio: 250 },
      { item: '2', descricao: 'Soro fisiológico', unidade: '', quantidade: null, valorUnitMunicipio: null, valorTotalMunicipio: null },
    ])
  })

  it('campo que o edital não traz não inventa nada', () => {
    const p = preencherDoEdital({ ...base, pncp: null, resumo: { prazoImpugnacao: campo('3 dias úteis antes'), validadeProposta: campo(null) } })
    expect(p.campos).toEqual({})
    expect(p.origem).toEqual({})
  })
})

describe('itens do PNCP', () => {
  it('lê o número da compra', () => {
    expect(partesDoNumero('78640489000153-1-000893/2026')).toEqual({ cnpj: '78640489000153', ano: '2026', sequencial: 893 })
    expect(partesDoNumero('TESTE-SITE-1')).toBeNull()
  })
  it('monta a tabela em ordem, com total e sem valor no orçamento sigiloso', () => {
    const t = itensDePncp([
      { numeroItem: 2, descricao: 'Atropina', unidadeMedida: 'Ampola', quantidade: 4700, valorUnitarioEstimado: 1.02, valorTotal: 4794 },
      { numeroItem: 1, descricao: ' Amiodarona 200 mg ', unidadeMedida: 'Comprimido', quantidade: 5000, valorUnitarioEstimado: 0.31 },
      { numeroItem: 3, descricao: 'Sigiloso', unidadeMedida: 'UN', quantidade: 10, valorUnitarioEstimado: 0, valorTotal: 0, orcamentoSigiloso: true },
    ])
    expect(t.map(i => i.item)).toEqual(['1', '2', '3'])
    expect(t[0]).toEqual({ item: '1', descricao: 'Amiodarona 200 mg', unidade: 'Comprimido', quantidade: 5000, valorUnitMunicipio: 0.31, valorTotalMunicipio: 1550 })
    expect(t[1].valorTotalMunicipio).toBe(4794)
    expect(t[2]).toMatchObject({ valorUnitMunicipio: null, valorTotalMunicipio: null })
  })
  it('a lista do PNCP manda; a IA só completa a descrição do mesmo item', () => {
    const pncp = itensDePncp([
      { numeroItem: 1, descricao: 'Amiodarona dosagem: 200 mg', quantidade: 5000, valorUnitarioEstimado: 0.31 },
      { numeroItem: 2, descricao: 'Atropina', quantidade: 4700, valorUnitarioEstimado: 1.02 },
    ])
    const ia = [
      { item: '01', descricao: 'AMIODARONA, CLORIDRATO - COMPRIMIDO 200MG', unidade: 'COMPRIMIDO', quantidade: 9, valorUnitMunicipio: 9, valorTotalMunicipio: 81 },
      { item: '16', descricao: 'Item que só a IA viu', unidade: '', quantidade: 1, valorUnitMunicipio: 1, valorTotalMunicipio: 1 },
    ]
    const j = juntarItens(pncp, ia)
    expect(j).toHaveLength(2)
    expect(j[0]).toMatchObject({ descricao: 'AMIODARONA, CLORIDRATO - COMPRIMIDO 200MG', quantidade: 5000, valorUnitMunicipio: 0.31 })
    expect(j[1].descricao).toBe('Atropina')
  })
})
