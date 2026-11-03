import { supabase } from './supabaseClient'
import { paraNumero, INVALIDO } from './numero'

// O banco é o do Radar, compartilhado por várias empresas (migrações 0012 e
// 0013 do repositório do Radar). Este arquivo junta as três coisas que as
// telas não precisam saber:
//
//   1. qual empresa está aberta agora (quem é de duas empresas escolhe uma);
//   2. o tradutor de nomes: as telas continuam usando os nomes antigos
//      (numeroPregao, codKralen, created_at...) e o banco usa os novos
//      (numero_pregao, codigo_interno, criado_em...);
//   3. o "código" da licitação que as telas usam (1, 2, 3...) é o número do
//      processo dentro da empresa; aqui ele vira o id de verdade do banco.
//
// Quem garante que uma empresa não vê a outra é o banco (RLS). O filtro por
// empresa_id feito aqui é só pra quem é de duas empresas ver uma de cada vez.

// ------------------------------------------------------------------
// 1. Empresa aberta agora
// ------------------------------------------------------------------

const CHAVE_EMPRESA = 'empresa_atual'

function lerGuardada(): string | null {
  try { return localStorage.getItem(CHAVE_EMPRESA) } catch { return null }
}

let atual: string | null = lerGuardada()

export function empresaAtual(): string {
  if (!atual) throw new Error('Nenhuma empresa aberta. Saia e entre de novo no sistema.')
  return atual
}

export function empresaGuardada(): string | null {
  return atual
}

export function definirEmpresaAtual(id: string | null) {
  atual = id
  idsDosProcessos.clear()
  nomesCache = null
  try {
    if (id) localStorage.setItem(CHAVE_EMPRESA, id)
    else localStorage.removeItem(CHAVE_EMPRESA)
  } catch { /* sem localStorage o sistema funciona, só não lembra a empresa */ }
}

// ------------------------------------------------------------------
// 2. Tradutor de nomes
// ------------------------------------------------------------------

// data: '' vira null (o Postgres não aceita '' em coluna de data).
// hora: igual, e o banco devolve "14:30:00" que volta como "14:30".
// epoch: a tela usa milissegundos (Date.now()), o banco usa data e hora.
// numero: texto brasileiro ("1.234,56") vira número.
type Tipo = 'data' | 'hora' | 'epoch' | 'numero'
type Campo = string | { banco: string; tipo?: Tipo; soLeitura?: boolean }
export type Mapa = { campos: Record<string, Campo>; ignorar?: string[] }

function campo(c: Campo): { banco: string; tipo?: Tipo; soLeitura?: boolean } {
  return typeof c === 'string' ? { banco: c } : c
}

function valorParaBanco(v: any, tipo: Tipo | undefined, nome: string): any {
  if (v === undefined) return undefined
  switch (tipo) {
    case 'data':
    case 'hora':
      return v === '' || v === null ? null : v
    case 'epoch':
      return v === null || v === '' ? null : new Date(Number(v)).toISOString()
    case 'numero': {
      const n = paraNumero(v)
      if (n === INVALIDO) throw new Error(`Valor numérico inválido em ${nome}: "${v}".`)
      return n
    }
    default:
      return v
  }
}

function valorParaApp(v: any, tipo: Tipo | undefined): any {
  if (v === null || v === undefined) return v
  switch (tipo) {
    case 'hora':
      return String(v).slice(0, 5)
    case 'epoch':
      return Date.parse(v)
    default:
      return v
  }
}

// Só manda o que veio no objeto: ausente quer dizer "não mexa nessa coluna".
// Campo que o banco não conhece é deixado de fora (com aviso no console), em
// vez de derrubar a gravação inteira.
export function paraBanco(mapa: Mapa, obj: Record<string, any>): Record<string, any> {
  const linha: Record<string, any> = {}
  for (const [chave, valor] of Object.entries(obj)) {
    const c = mapa.campos[chave]
    if (!c) {
      if (!mapa.ignorar?.includes(chave)) console.warn(`[banco] campo "${chave}" não existe no banco novo; ignorado`)
      continue
    }
    const { banco, tipo, soLeitura } = campo(c)
    if (soLeitura) continue
    const v = valorParaBanco(valor, tipo, chave)
    if (v !== undefined) linha[banco] = v
  }
  return linha
}

export function paraApp(mapa: Mapa, linha: Record<string, any>): any {
  const obj: Record<string, any> = {}
  for (const [chave, c] of Object.entries(mapa.campos)) {
    const { banco, tipo } = campo(c)
    if (banco in linha) obj[chave] = valorParaApp(linha[banco], tipo)
  }
  return obj
}

// Nome de quem criou/emitiu, a partir do id da pessoa (o banco guarda o id,
// as telas mostram o nome). Um pedido só por empresa aberta.
let nomesCache: Promise<Record<string, string>> | null = null

export function nomesDaEmpresa(): Promise<Record<string, string>> {
  if (!nomesCache) {
    const empresa = empresaAtual()
    nomesCache = (async () => {
      const { data, error } = await supabase.from('membros').select('usuario_id, nome').eq('empresa_id', empresa)
      if (error) throw error
      const mapa: Record<string, string> = {}
      for (const m of data || []) mapa[m.usuario_id] = m.nome
      return mapa
    })()
    nomesCache.catch(() => { nomesCache = null })
  }
  return nomesCache
}

// ------------------------------------------------------------------
// 3. Código da licitação (número do processo na empresa) <-> id no banco
// ------------------------------------------------------------------

const idsDosProcessos = new Map<string, string>()

export function lembrarProcesso(codigo: number | string, id: string) {
  idsDosProcessos.set(String(codigo), id)
}

export async function idDoProcesso(codigo: number | string): Promise<string> {
  const guardado = idsDosProcessos.get(String(codigo))
  if (guardado) return guardado
  const { data, error } = await supabase.from('processos').select('id')
    .eq('empresa_id', empresaAtual()).eq('numero', codigo).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Licitação ${codigo} não encontrada nesta empresa.`)
  lembrarProcesso(codigo, data.id)
  return data.id
}

// Vários de uma vez (Dashboard e relatórios): devolve id -> código.
export async function codigosPorId(codigos: (number | string)[]): Promise<Record<string, number>> {
  if (codigos.length === 0) return {}
  const { data, error } = await supabase.from('processos').select('id, numero')
    .eq('empresa_id', empresaAtual()).in('numero', codigos)
  if (error) throw error
  const mapa: Record<string, number> = {}
  for (const p of data || []) {
    mapa[p.id] = p.numero
    lembrarProcesso(p.numero, p.id)
  }
  return mapa
}

// ------------------------------------------------------------------
// Mapas de cada tabela (nome na tela -> nome no banco)
// ------------------------------------------------------------------

export const MAPA_PROCESSO: Mapa = {
  campos: {
    codigo: { banco: 'numero', soLeitura: true },
    ano: 'ano',
    contratado: 'contratado',
    contratante: 'orgao',
    numeroPregao: 'numero_pregao',
    numeroProcesso: 'numero_processo',
    portal: 'portal',
    tipoObjeto: 'tipo_objeto',
    objetoLicitacao: 'objeto',
    status: 'status',
    dataCredenciamento: { banco: 'data_credenciamento', tipo: 'data' },
    horaCredenciamento: { banco: 'hora_credenciamento', tipo: 'hora' },
    dataLicitacao: { banco: 'data_licitacao', tipo: 'data' },
    horaLicitacao: { banco: 'hora_licitacao', tipo: 'hora' },
    tipoDisputa: 'tipo_disputa',
    definJulgamento: 'criterio_julgamento',
    prazoValidade: 'prazo_validade',
    prazoEntrega: 'prazo_entrega',
    localEntrega: 'local_entrega',
    prazoPagamento: 'prazo_pagamento',
    prazoGarantia: 'prazo_garantia',
    vigenciaContrato: 'vigencia_contrato',
    habilitacao: 'habilitacao',
    lancadoNoKralen: 'lancado_no_erp',
    bancoId: 'banco_id',
    dataLimiteRecurso: { banco: 'data_limite_recurso', tipo: 'data' },
    dataLimiteImpugnacao: { banco: 'data_limite_impugnacao', tipo: 'data' },
    created_at: { banco: 'criado_em', soLeitura: true },
    updated_at: { banco: 'atualizado_em', soLeitura: true },
  },
  // criadoPor: o banco grava sozinho quem criou (auth.uid()).
  ignorar: ['criadoPor'],
}

export const MAPA_ITEM: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    item: 'item',
    lote: 'lote',
    codKralen: 'codigo_interno',
    descricao: 'descricao',
    unidade: 'unidade',
    quantidade: { banco: 'quantidade', tipo: 'numero' },
    marca: 'marca',
    origemCotacao: 'origem_cotacao',
    valorCusto: { banco: 'valor_custo', tipo: 'numero' },
    totalCusto: { banco: 'total_custo', tipo: 'numero' },
    valorUnitMinimo: { banco: 'valor_unit_minimo', tipo: 'numero' },
    valorTotalMinimo: { banco: 'valor_total_minimo', tipo: 'numero' },
    valorUnitMunicipio: { banco: 'valor_unit_municipio', tipo: 'numero' },
    valorTotalMunicipio: { banco: 'valor_total_municipio', tipo: 'numero' },
    status: 'status',
    vencedor: 'vencedor',
    valorGanho: { banco: 'valor_ganho', tipo: 'numero' },
    desclassificado: 'desclassificado',
    motivoDesclassificacao: 'motivo_desclassificacao',
    created_at: { banco: 'criado_em', soLeitura: true },
    updated_at: { banco: 'atualizado_em', soLeitura: true },
  },
  ignorar: ['licitacaoCodigo'],
}

export const MAPA_ENTREGA: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    itemId: 'item_id',
    quantidade: { banco: 'quantidade', tipo: 'numero' },
    data: { banco: 'data', tipo: 'data' },
    notaFiscal: 'nota_fiscal',
    observacao: 'observacao',
    criadoEm: { banco: 'criado_em', tipo: 'epoch' },
    criadoPor: { banco: 'criado_por', soLeitura: true },
  },
}

export const MAPA_ATA: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    tipo: 'tipo',
    numero: 'numero',
    inicioVigencia: { banco: 'inicio_vigencia', tipo: 'data' },
    fimVigencia: { banco: 'fim_vigencia', tipo: 'data' },
    meses: 'meses',
    observacoes: 'observacoes',
    anexo: 'anexo',
    criadoEm: { banco: 'criado_em', tipo: 'epoch' },
  },
  ignorar: ['licitacaoCodigo', 'criadoPor'],
}

export const MAPA_ANEXO: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    name: 'nome',
    filename: 'arquivo',
    path: 'caminho',
    mime: 'mime',
    size: 'tamanho',
    date: { banco: 'criado_em', soLeitura: true },
  },
  ignorar: ['licitacaoCodigo'],
}

export const MAPA_ORGAO: Mapa = {
  campos: { codigo: 'codigo', nome: 'nome', uf: 'uf' },
}

export const MAPA_DOCUMENTO: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    tipo: 'tipo',
    numero: 'numero',
    dataEmissao: { banco: 'data_emissao', tipo: 'data' },
    dataValidade: { banco: 'data_validade', tipo: 'data' },
    reutilizavel: 'reutilizavel',
    observacao: 'observacao',
    path: 'caminho',
    filename: 'arquivo',
    mime: 'mime',
    size: 'tamanho',
    created_at: { banco: 'criado_em', soLeitura: true },
  },
  ignorar: ['criadoPor'],
}

export const MAPA_EMPRESA: Mapa = {
  campos: {
    razaoSocial: 'razao_social',
    cnpj: 'cnpj',
    inscricaoEstadual: 'inscricao_estadual',
    inscricaoMunicipal: 'inscricao_municipal',
    endereco: 'endereco',
    cep: 'cep',
    cidade: 'cidade',
    uf: 'uf',
    telefone: 'telefone',
    email: 'email',
    bancos: 'bancos',
    representanteNome: 'representante_nome',
    representanteCargo: 'representante_cargo',
    representanteCpf: 'representante_cpf',
    representanteRg: 'representante_rg',
    declaracoesProposta: 'declaracoes_proposta',
    // Configurações da empresa (migração 0013): o que era fixo para um cliente só.
    nomeSistemaInterno: 'nome_sistema_interno',
    tiposObjeto: 'tipos_objeto',
    itensHabilitacao: 'itens_habilitacao',
    logoCaminho: 'logo_caminho',
    updated_at: { banco: 'atualizado_em', soLeitura: true },
  },
  ignorar: ['id', 'empresa_id'],
}

export const MAPA_META: Mapa = {
  campos: {
    periodo: 'periodo',
    valorAlvoGanho: { banco: 'valor_alvo_ganho', tipo: 'numero' },
    taxaAlvoSucesso: { banco: 'taxa_alvo_sucesso', tipo: 'numero' },
    atualizadoEm: { banco: 'atualizado_em', tipo: 'epoch' },
  },
}

export const MAPA_AUDITORIA: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    at: { banco: 'em', tipo: 'epoch' },
    user: 'usuario_nome',
    action: 'acao',
    payload: 'detalhes',
  },
}

export const MAPA_PROPOSTA: Mapa = {
  campos: {
    id: { banco: 'id', soLeitura: true },
    snapshot: 'retrato',
    emitidoEm: { banco: 'emitido_em', tipo: 'epoch' },
  },
}
