import { describe, it, expect } from 'vitest'
import {
  analisarUfs, buscarCidade, comandoDoTexto, entenderMensagem, filtroDoOnde, foraDaColeta, interpretarData,
  linhaPrazo, ondeDasUfs, resolverPeriodo, UFS_LISTA, type Cidade,
} from './conversa-radar'

// 03/11/2026 às 10h em Brasília (13h UTC).
const AGORA = new Date('2026-11-03T13:00:00Z')

describe('datas', () => {
  it('entende as formas que o bot entende', () => {
    expect(interpretarData('até 20/11', AGORA)).toEqual({ chave: 'd20261120' })
    expect(interpretarData('20/11/2026', AGORA)).toEqual({ chave: 'd20261120' })
    expect(interpretarData('dia 5/1/27', AGORA)).toEqual({ chave: 'd20270105' })
    expect(interpretarData('Até o dia 03/11', AGORA)).toEqual({ chave: 'd20261103' })
  })
  it('explica data que não vale', () => {
    expect(interpretarData('31/02', AGORA)).toMatchObject({ erro: expect.stringContaining('não é uma data') })
    expect(interpretarData('01/11', AGORA)).toMatchObject({ erro: expect.stringContaining('ano que vem') })
    expect(interpretarData('20/11/2028', AGORA)).toMatchObject({ erro: expect.stringContaining('longe demais') })
    expect(interpretarData('até 5', AGORA)).toMatchObject({ erro: expect.stringContaining('Não entendi') })
  })
  it('ignora o que não parece data', () => {
    expect(interpretarData('PR SC', AGORA)).toBeNull()
    expect(interpretarData('7 dias', AGORA)).toBeNull()
  })
  it('monta o período no calendário de Brasília', () => {
    const p = resolverPeriodo('7', AGORA)
    expect(p).toMatchObject({ titulo: 'Encerram até 10/11 (7 dias)', publicadasDesde: null })
    expect((p as any).ate.toISOString()).toBe('2026-11-11T02:59:59.999Z')
    expect(resolverPeriodo('hoje', AGORA)).toMatchObject({ titulo: 'Publicadas hoje (03/11)', ate: null })
    expect((resolverPeriodo('hoje', AGORA) as any).publicadasDesde.toISOString()).toBe('2026-11-03T03:00:00.000Z')
    expect(resolverPeriodo('d20261102', AGORA)).toBe('passou')
    expect(resolverPeriodo('d20270115', AGORA)).toMatchObject({ titulo: 'Encerram até 15/01/2027' })
    expect(resolverPeriodo('99', AGORA)).toBeNull()
  })
  it('perto da meia-noite usa o dia de Brasília, não o de Londres', () => {
    // 04/11 às 01h UTC ainda é 03/11 às 22h em Brasília.
    expect(resolverPeriodo('hoje', new Date('2026-11-04T01:00:00Z'))).toMatchObject({ titulo: 'Publicadas hoje (03/11)' })
  })
})

describe('estados e regiões', () => {
  it('lê siglas, regiões, nomes e "todos" misturados', () => {
    expect(analisarUfs('PR SC SP')).toEqual({ validas: ['PR', 'SP', 'SC'].sort((a, b) => UFS_LISTA.indexOf(a) - UFS_LISTA.indexOf(b)), invalidas: [] })
    expect(analisarUfs('sul e SP').validas).toEqual(['PR', 'RS', 'SC', 'SP'])
    expect(analisarUfs('Santa Catarina, centro-oeste').validas).toEqual(['DF', 'GO', 'MT', 'MS', 'SC'])
    expect(analisarUfs('Brasil todo').validas).toHaveLength(27)
    expect(analisarUfs('PR xyz').invalidas).toEqual(['xyz'])
  })
  it('escolhe o "onde" mais curto', () => {
    expect(ondeDasUfs(['PR'])).toEqual({ tipo: 'uf', uf: 'PR' })
    expect(ondeDasUfs(['SC', 'RS', 'PR'])).toEqual({ tipo: 'regiao', id: 'sul' })
    expect(ondeDasUfs(['PR', 'SP'])).toEqual({ tipo: 'ufs', ufs: ['PR', 'SP'] })
  })
  it('monta o filtro e avisa o que fica fora da coleta', () => {
    expect(filtroDoOnde({ tipo: 'meus' }, ['PR', 'SC'])).toEqual({ ufs: null, municipio: null, titulo: 'Seus estados (PR, SC)' })
    expect(filtroDoOnde({ tipo: 'cidade', nome: 'Maringá', uf: 'PR' }, [])).toEqual({ ufs: ['PR'], municipio: 'Maringá', titulo: 'Maringá (PR)' })
    expect(filtroDoOnde({ tipo: 'regiao', id: 'sul' }, []).titulo).toBe('Região Sul')
    expect(foraDaColeta({ ufs: ['PR', 'SP'], municipio: null, titulo: '' }, ['PR'])).toContain('incluir SP')
    expect(foraDaColeta({ ufs: null, municipio: null, titulo: '' }, ['PR'])).toBeNull()
  })
})

describe('cidades', () => {
  const CIDADES: Cidade[] = [
    { nome: 'Maringá', uf: 'PR' }, { nome: 'Toledo', uf: 'PR' }, { nome: 'Toledo', uf: 'MG' },
    { nome: 'São José dos Pinhais', uf: 'PR' }, { nome: 'São José dos Campos', uf: 'SP' }, { nome: "Pérola d'Oeste", uf: 'PR' },
  ]
  it('acha com ou sem estado, sem acento e com pontuação', () => {
    expect(buscarCidade('maringa', CIDADES)).toEqual({ tipo: 'achou', cidade: { nome: 'Maringá', uf: 'PR' } })
    expect(buscarCidade('Toledo - MG', CIDADES)).toEqual({ tipo: 'achou', cidade: { nome: 'Toledo', uf: 'MG' } })
    expect(buscarCidade('perola doeste', CIDADES)).toMatchObject({ tipo: 'achou' })
  })
  it('pergunta quando há mais de uma', () => {
    expect(buscarCidade('Toledo', CIDADES)).toMatchObject({ tipo: 'varias', opcoes: [{ uf: 'PR' }, { uf: 'MG' }] })
    expect(buscarCidade('sao jose dos', CIDADES)).toMatchObject({ tipo: 'varias' })
    expect(buscarCidade('sao jose dos SP', CIDADES)).toEqual({ tipo: 'achou', cidade: { nome: 'São José dos Campos', uf: 'SP' } })
  })
  it('não acha o que não existe', () => {
    expect(buscarCidade('Gotham', CIDADES)).toEqual({ tipo: 'nenhuma' })
    expect(buscarCidade('to', CIDADES)).toEqual({ tipo: 'nenhuma' })
  })
})

describe('entender a mensagem', () => {
  it('comandos com ou sem barra, acento e enfeites', () => {
    expect(comandoDoTexto('📋 Licitações')).toBe('licitacoes')
    expect(comandoDoTexto('AJUDA!')).toBe('ajuda')
    expect(comandoDoTexto('ver mais')).toBe('mais')
    expect(comandoDoTexto('PR')).toBeNull()
    expect(entenderMensagem('/filtros', null, AGORA)).toEqual({ tipo: 'comando', comando: 'filtros' })
    expect(entenderMensagem('⭐ Acompanhando', null, AGORA)).toEqual({ tipo: 'comando', comando: 'acompanhando' })
  })
  it('período sozinho', () => {
    expect(entenderMensagem('7 dias', null, AGORA)).toEqual({ tipo: 'periodo', chave: '7' })
    expect(entenderMensagem('em até 15 dias', null, AGORA)).toEqual({ tipo: 'periodo', chave: '15' })
    expect(entenderMensagem('publicadas hoje', null, AGORA)).toEqual({ tipo: 'periodo', chave: 'hoje' })
    expect(entenderMensagem('até 20/11', null, AGORA)).toEqual({ tipo: 'periodo', chave: 'd20261120' })
    expect(entenderMensagem('31/02', null, AGORA)).toMatchObject({ tipo: 'erro' })
  })
  it('lugar sozinho ou com período', () => {
    expect(entenderMensagem('PR', null, AGORA)).toEqual({ tipo: 'onde', onde: { tipo: 'uf', uf: 'PR' }, chave: null })
    expect(entenderMensagem('licitações no sul', null, AGORA)).toEqual({ tipo: 'onde', onde: { tipo: 'regiao', id: 'sul' }, chave: null })
    expect(entenderMensagem('sul e SP 15 dias', null, AGORA)).toEqual({ tipo: 'onde', onde: { tipo: 'ufs', ufs: ['PR', 'RS', 'SC', 'SP'] }, chave: '15' })
    expect(entenderMensagem('SC até 20/11', null, AGORA)).toEqual({ tipo: 'onde', onde: { tipo: 'uf', uf: 'SC' }, chave: 'd20261120' })
    expect(entenderMensagem('SC até 31/02', null, AGORA)).toMatchObject({ tipo: 'erro' })
  })
  it('o resto pode ser uma cidade', () => {
    expect(entenderMensagem('Maringá PR', null, AGORA)).toEqual({ tipo: 'livre', texto: 'Maringá PR', chave: null })
    expect(entenderMensagem('licitações em Maringá PR 7 dias', null, AGORA)).toEqual({ tipo: 'livre', texto: 'Maringá PR', chave: '7' })
    expect(entenderMensagem('cidade São Paulo', null, AGORA)).toEqual({ tipo: 'livre', texto: 'São Paulo', chave: null })
  })
  it('quando a conversa pediu uma cidade, o texto é a cidade', () => {
    expect(entenderMensagem('Toledo', 'cidade', AGORA)).toEqual({ tipo: 'livre', texto: 'Toledo', chave: null })
    expect(entenderMensagem('PR', 'cidade', AGORA)).toEqual({ tipo: 'livre', texto: 'PR', chave: null })
    expect(entenderMensagem('ajuda', 'cidade', AGORA)).toEqual({ tipo: 'comando', comando: 'ajuda' })
  })
  it('quando a conversa pediu uma data, insiste na data', () => {
    const esperando = { data: { tipo: 'meus' as const } }
    expect(entenderMensagem('20/11', esperando, AGORA)).toEqual({ tipo: 'periodo', chave: 'd20261120' })
    expect(entenderMensagem('amanhã', esperando, AGORA)).toMatchObject({ tipo: 'erro', texto: expect.stringContaining('Até que dia') })
  })
  it('vazio', () => {
    expect(entenderMensagem('   ', null, AGORA)).toEqual({ tipo: 'vazio' })
  })
})

describe('prazo do cartão', () => {
  it('conta os dias e marca as encerradas', () => {
    expect(linhaPrazo('2026-11-08T13:00:00Z', AGORA)).toMatch(/^Encerra 08\/11.*\(faltam 5 dias\)$/)
    expect(linhaPrazo('2026-11-03T20:00:00Z', AGORA)).toContain('(último dia)')
    expect(linhaPrazo('2026-11-01T13:00:00Z', AGORA)).toMatch(/^Encerrou 01\/11/)
    expect(linhaPrazo(null, AGORA)).toBe('Sem data de encerramento')
  })
})
