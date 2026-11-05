import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { gerarPlanilhaItens, itensDaPlanilha, linhasDaPlanilha, nomeDoArquivo, normalizar } from './modelo-cotacao'

const ITENS = [
  { item: '1', descricao: 'Amiodarona 200 mg', unidade: 'Comprimido', quantidade: 5000, valorUnitMunicipio: 0.31, valorTotalMunicipio: 1550 },
  { item: '2', descricao: 'Atropina 0,5 mg/ml', unidade: 'Ampola', quantidade: '4.700', valorUnitMunicipio: '1,02', valorTotalMunicipio: null },
]
const CAB = { orgao: 'Universidade Fictícia', pregao: '185/2026', processo: '150/2026', objeto: 'Medicamentos', data: '04/11/2026' }

// Escreve o .xlsx de verdade e lê de volta como o "Importar Itens" lê.
function idaEVolta(itens: Record<string, any>[]) {
  const bytes = XLSX.write(gerarPlanilhaItens(itens, CAB), { type: 'array', bookType: 'xlsx' })
  const wb = XLSX.read(bytes, { type: 'array' })
  return XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
}

describe('planilha de itens no modelo de cotação', () => {
  it('volta pela importação com os mesmos itens', () => {
    const lido = itensDaPlanilha(idaEVolta(ITENS))
    if ('erro' in lido) throw new Error(lido.erro)
    expect(lido.itens).toHaveLength(2)
    expect(lido.itens[0]).toMatchObject({ item: '1', descricao: 'Amiodarona 200 mg', unidade: 'Comprimido', quantidade: 5000, valorUnitMunicipio: 0.31, valorTotalMunicipio: 1550 })
    // Texto brasileiro vira número; o total é calculado (quantidade × unitário).
    expect(lido.itens[1]).toMatchObject({ quantidade: 4700, valorUnitMunicipio: 1.02, valorTotalMunicipio: 4794 })
  })
  it('traz o bloco do pregão e a âncora na coluna B', () => {
    const { linhas, linhaCabecalho } = linhasDaPlanilha(ITENS, CAB)
    expect(linhas[1]).toEqual(['', 'Órgão:', 'Universidade Fictícia'])
    expect(linhas[linhaCabecalho][1]).toBe('CÓD. INTERNO')
  })
  it('sem itens gera o modelo vazio, que também é aceito', () => {
    const lido = itensDaPlanilha(idaEVolta([]))
    expect(lido).toEqual({ itens: [] })
  })
  it('o total tem fórmula, para recalcular quando a pessoa muda o valor no Excel', () => {
    const ws = gerarPlanilhaItens(ITENS, CAB).Sheets['Cotação']
    const celula = Object.values(ws).find((c: any) => c?.f?.includes('*') && c.v === 1550) as any
    expect(celula?.f).toMatch(/F\d+\*L\d+/)
  })
  it('aceita cabeçalho com ou sem acento e dá nome ao arquivo', () => {
    expect(normalizar(' Valor Mínimo ')).toBe('VALOR MINIMO')
    expect(nomeDoArquivo('185/2026')).toBe('itens-pregao-185-2026.xlsx')
    expect(nomeDoArquivo('')).toBe('itens-licitacao.xlsx')
  })
  it('recusa planilha fora do modelo', () => {
    expect(itensDaPlanilha([['qualquer', 'coisa']])).toMatchObject({ erro: expect.stringContaining('CÓD. INTERNO') })
  })
  it('ainda lê os arquivos antigos, com "COD. KRALEN" no lugar de "CÓD. INTERNO"', () => {
    const linhas = idaEVolta(ITENS).map(l => l.map(v => (v === 'CÓD. INTERNO' ? 'COD. KRALEN' : v)))
    const lido = itensDaPlanilha(linhas)
    if ('erro' in lido) throw new Error(lido.erro)
    expect(lido.itens).toHaveLength(2)
  })
  it('"COD" no bloco do pregão sem "ITEM" ao lado não vira âncora', () => {
    expect(itensDaPlanilha([['', 'Código do processo:', '150/2026']])).toHaveProperty('erro')
  })
})
