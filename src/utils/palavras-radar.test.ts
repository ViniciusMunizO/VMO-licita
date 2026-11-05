import { describe, it, expect } from 'vitest'
import {
  adicionarPalavra, dicaDeEscrita, frasePalavra, normalizar, separarPalavras, sugerirSinonimos, trocarPalavra,
} from './palavras-radar'

describe('separar as palavras do campo', () => {
  it('aceita vírgula, ponto e vírgula e linha nova, sem repetir', () => {
    expect(separarPalavras('detergente,  Material  de limpeza; merenda\nDetergente, ,DETERGENTE ')).toEqual([
      'detergente', 'Material de limpeza', 'merenda',
    ])
  })
  it('acento e maiúscula contam como a mesma palavra', () => {
    expect(separarPalavras('Remédio, remedio')).toEqual(['Remédio'])
    expect(normalizar('  Gêneros   Alimentícios ')).toBe('generos alimenticios')
  })
})

describe('sinônimos', () => {
  it('sugere o jeito que os órgãos escrevem', () => {
    expect(sugerirSinonimos(['Remédios', 'carro'])).toEqual([
      { de: 'Remédios', para: 'medicamento' },
      { de: 'carro', para: 'veículo' },
    ])
    expect(sugerirSinonimos(['materiais de escritório'])).toEqual([{ de: 'materiais de escritório', para: 'material de expediente' }])
  })
  it('não sugere o que já está no campo, nem repete', () => {
    expect(sugerirSinonimos(['remedio', 'medicamentos'])).toEqual([])
    expect(sugerirSinonimos(['gasolina', 'diesel'])).toEqual([{ de: 'gasolina', para: 'combustível' }])
    expect(sugerirSinonimos(['merenda', 'gêneros alimentícios'])).toEqual([{ de: 'merenda', para: 'alimentação escolar' }])
  })
  it('palavra comum não ganha sugestão', () => {
    expect(sugerirSinonimos(['limpeza', 'detergente', 'luvas'])).toEqual([])
  })
})

describe('trocar e adicionar', () => {
  it('troca só a palavra certa e mantém a ordem', () => {
    expect(trocarPalavra('detergente, limpesa, merenda', 'Limpesa', 'limpeza')).toBe('detergente, limpeza, merenda')
  })
  it('não duplica se a troca já existe', () => {
    expect(trocarPalavra('limpeza, limpesa', 'limpesa', 'limpeza')).toBe('limpeza')
  })
  it('adiciona no fim, sem repetir', () => {
    expect(adicionarPalavra('remédio', 'medicamento')).toBe('remédio, medicamento')
    expect(adicionarPalavra('', 'medicamento')).toBe('medicamento')
    expect(adicionarPalavra('Medicamento', 'medicamento')).toBe('Medicamento')
  })
})

describe('frases da conferência', () => {
  it('diz quantas acha e sugere quando acha pouco', () => {
    expect(frasePalavra({ palavra: 'limpeza', abertas: 12, sugestao: null, abertasSugestao: null })).toBe('12 licitações abertas agora')
    expect(frasePalavra({ palavra: 'luva', abertas: 1, sugestao: null, abertasSugestao: null })).toBe('1 licitação aberta agora')
    expect(frasePalavra({ palavra: 'limpesa', abertas: 0, sugestao: 'limpeza', abertasSugestao: 12 }))
      .toBe('nenhuma aberta agora. Quis dizer "limpeza" (12)?')
    expect(frasePalavra({ palavra: 'cadera', abertas: 2, sugestao: 'cadeira', abertasSugestao: 30 }))
      .toBe('2 licitações abertas agora. Mais comum: "cadeira" (30)')
    expect(frasePalavra({ palavra: 'xyz', abertas: 0, sugestao: null, abertasSugestao: null }))
      .toContain('nenhuma aberta agora')
  })
  it('dica da conversa aponta só palavra que não achou nada e tem sugestão', () => {
    expect(dicaDeEscrita([
      { palavra: 'limpeza', abertas: 3, sugestao: null, abertasSugestao: null },
      { palavra: 'xyz', abertas: 0, sugestao: null, abertasSugestao: null },
    ])).toBeNull()
    expect(dicaDeEscrita([{ palavra: 'limpesa', abertas: 0, sugestao: 'limpeza', abertasSugestao: 12 }]))
      .toBe('Talvez seja a escrita: "limpesa" não aparece em nenhuma licitação aberta; "limpeza" aparece em 12. Dá para trocar em ⚙️ Mudar filtros.')
  })
})
