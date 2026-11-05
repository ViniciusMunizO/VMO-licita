import { describe, expect, it } from 'vitest'
import { configDe, listaDeTexto, opcoesTipoObjeto, SISTEMA_PADRAO, TIPOS_OBJETO_PADRAO } from './config-empresa'
import { filtrosSistema, passaFiltroSistema } from './filtroSistema'
import { ITENS_HABILITACAO_PADRAO } from './habilitacao'

describe('configurações da empresa', () => {
  it('sem nada salvo, usa os padrões genéricos (nada de Kralen)', () => {
    expect(configDe(null)).toEqual({ sistema: SISTEMA_PADRAO, tiposObjeto: TIPOS_OBJETO_PADRAO, itensHabilitacao: ITENS_HABILITACAO_PADRAO, logoCaminho: null })
    expect(configDe({ nomeSistemaInterno: '   ', tiposObjeto: [], logoCaminho: '' }).sistema).toBe('ERP')
  })
  it('usa o que a empresa salvou', () => {
    const c = configDe({ nomeSistemaInterno: ' Bling ', tiposObjeto: ['Medicamentos', ' Materiais ', ''], itensHabilitacao: ['Anvisa', ' Laudo '], logoCaminho: 'e1/empresa/logo/x.png' })
    expect(c).toEqual({ sistema: 'Bling', tiposObjeto: ['Medicamentos', 'Materiais'], itensHabilitacao: ['Anvisa', 'Laudo'], logoCaminho: 'e1/empresa/logo/x.png' })
  })
  it('lista digitada: separa por vírgula, ponto e vírgula ou linha, sem repetir', () => {
    expect(listaDeTexto('Medicamentos, materiais;Misto\nmedicamentos, ,')).toEqual(['Medicamentos', 'materiais', 'Misto'])
  })
  it('licitação antiga com tipo fora da lista continua mostrando o valor dela', () => {
    expect(opcoesTipoObjeto(['Produtos', 'Serviços'], 'Medicamentos')).toEqual(['Produtos', 'Serviços', 'Medicamentos'])
    expect(opcoesTipoObjeto(['Produtos'], 'Produtos')).toEqual(['Produtos'])
    expect(opcoesTipoObjeto(['Produtos'], '')).toEqual(['Produtos'])
  })
  it('filtro dos relatórios usa o nome do sistema da empresa', () => {
    expect(filtrosSistema('Omie').map(f => f.label)).toEqual(['Todas', 'Lançadas no Omie', 'Não lançadas no Omie'])
    expect(passaFiltroSistema(true, 'lancadas')).toBe(true)
    expect(passaFiltroSistema(undefined, 'naoLancadas')).toBe(true)
    expect(passaFiltroSistema(true, 'naoLancadas')).toBe(false)
  })
})
