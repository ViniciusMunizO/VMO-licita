import { supabase } from './supabaseClient'
import { situacaoDoItem } from './itens'
import { paraNumero, INVALIDO } from './numero'
import { empresaAtual, paraApp, paraBanco, idDoProcesso, codigosPorId, MAPA_ITEM, MAPA_PROCESSO } from './banco'

// Colunas numéricas do banco. Célula vazia vira null (o Postgres rejeita ''),
// e texto no formato brasileiro é convertido pra número antes de gravar —
// veja `paraNumero` (utils/numero.ts). O valor ganho também é número no banco
// multiempresa (antes era texto livre).
const NUMERIC_FIELDS = ['quantidade', 'valorCusto', 'totalCusto', 'valorUnitMinimo', 'valorTotalMinimo', 'valorUnitMunicipio', 'valorTotalMunicipio', 'valorGanho'] as const

const LABELS: Record<string, string> = {
  quantidade: 'Quantidade',
  valorCusto: 'Valor Custo',
  totalCusto: 'Total Custo',
  valorUnitMinimo: 'Valor Unit. Mínimo',
  valorTotalMinimo: 'Valor Total Mínimo',
  valorUnitMunicipio: 'Valor Unit. Município',
  valorTotalMunicipio: 'Valor Total Município',
  valorGanho: 'Valor Ganho',
}

// Item do banco (processo_itens) -> formato das telas, com o código da licitação.
const itemParaTela = (linha: any, licitacaoCodigo: number | string) => ({ ...paraApp(MAPA_ITEM, linha), licitacaoCodigo })

// Só mexe em campo que veio no patch: num update parcial (ex.: marcar
// vencedor, gravar o motivo da desclassificação) os outros campos chegam
// ausentes, e "ausente" quer dizer "não encoste nessa coluna" — nunca
// "apague o valor". Converter ausente em null aqui apagava quantidade,
// custo e totais do item a cada clique em Venceu/Desclassificar.
//
// Devolve também a lista de campos que não dá pra converter, pra quem chama
// avisar em vez de mandar pro banco e tomar erro de tipo.
function sanitizeItem(item: any): { row: any; problemas: string[] } {
  const row = { ...item }
  const problemas: string[] = []
  for (const f of NUMERIC_FIELDS) {
    if (!(f in row)) continue
    const convertido = paraNumero(row[f])
    if (convertido === INVALIDO) problemas.push(`${LABELS[f]}: "${row[f]}"`)
    else row[f] = convertido
  }
  return { row, problemas }
}

export async function listItems(licitacaoCodigo: number | string): Promise<any[]> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { data, error } = await supabase.from('processo_itens').select('*').eq('processo_id', processoId).order('criado_em', { ascending: true })
  if (error) throw error
  return (data || []).map(l => itemParaTela(l, licitacaoCodigo))
}

// Mesma consulta que `listItems`, mas pra várias licitações de uma vez — usada
// nas telas que precisam dos itens de toda a lista (Dashboard, relatórios).
// Fazer `listItems` dentro de um `.map()` vira uma chamada ao banco por
// licitação (N+1); isto troca por uma única chamada com `.in()`.
export async function listItemsByCodigos(licitacaoCodigos: (number | string)[]): Promise<Record<string, any[]>> {
  if (licitacaoCodigos.length === 0) return {}
  const codigoDoProcesso = await codigosPorId(licitacaoCodigos)
  const ids = Object.keys(codigoDoProcesso)
  if (ids.length === 0) return {}
  const { data, error } = await supabase.from('processo_itens').select('*').in('processo_id', ids).order('criado_em', { ascending: true })
  if (error) throw error
  const porCodigo: Record<string, any[]> = {}
  for (const linha of data || []) {
    const codigo = codigoDoProcesso[linha.processo_id]
    ;(porCodigo[String(codigo)] ||= []).push(itemParaTela(linha, codigo))
  }
  return porCodigo
}

// Substitui todos os itens de uma licitação de uma vez — usado pela
// importação de planilha, onde a lista inteira já é conhecida.
//
// A ordem aqui é de propósito "valida -> insere -> apaga os antigos", nunca
// "apaga -> insere": como o PostgREST manda cada comando numa transação
// própria, apagar primeiro significava que qualquer falha no insert (uma
// célula de texto numa coluna numérica bastava) deixava a licitação com zero
// itens, sem rollback e sem aviso na tela. Nesta ordem, falha no insert não
// tira nada do lugar, e falha no delete é desfeita logo abaixo.
export async function replaceItems(licitacaoCodigo: number | string, items: any[]): Promise<any[]> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const rows: any[] = []
  const problemas: string[] = []
  items.forEach((it, i) => {
    // id fica de fora: o item importado é sempre uma linha nova.
    const { id: _id, ...semId } = it
    const { row, problemas: p } = sanitizeItem(semId)
    if (p.length > 0) problemas.push(`linha ${i + 1} (${it.descricao || 'sem descrição'}) — ${p.join(', ')}`)
    rows.push({ ...paraBanco(MAPA_ITEM, row), processo_id: processoId })
  })
  if (problemas.length > 0) {
    const amostra = problemas.slice(0, 5).join('; ')
    const resto = problemas.length > 5 ? ` (e mais ${problemas.length - 5})` : ''
    throw new Error(`Valores numéricos inválidos na planilha, nada foi importado: ${amostra}${resto}.`)
  }

  const { data: antigos, error: listError } = await supabase.from('processo_itens').select('id').eq('processo_id', processoId)
  if (listError) throw listError
  const idsAntigos = (antigos || []).map((r: any) => r.id)

  let novos: any[] = []
  if (rows.length > 0) {
    const { data, error } = await supabase.from('processo_itens').insert(rows).select()
    if (error) throw error // nada foi apagado ainda — a lista antiga continua de pé
    novos = data || []
  }

  if (idsAntigos.length > 0) {
    const { error: delError } = await supabase.from('processo_itens').delete().in('id', idsAntigos)
    if (delError) {
      // Desfaz o insert pra não deixar a licitação com as duas listas juntas.
      if (novos.length > 0) await supabase.from('processo_itens').delete().in('id', novos.map(r => r.id))
      throw delError
    }
  }
  return novos.map(l => itemParaTela(l, licitacaoCodigo))
}

export type HistoricoPrecoItem = {
  ocorrencias: number
  vitorias: number
  taxaVitoria: number | null
  ultimoValorGanho: number | null
  mediaValorUnitMinimo: number | null
}

// Como esse mesmo item (por codKralen, ou por descrição quando não tem
// Kralen) se saiu em cotações passadas — de QUALQUER licitação, não só desta
// — pra ajudar a decidir a margem de uma cotação nova olhando pro que já
// funcionou antes. "Ocorrência"/"vitória" só contam licitação já decidida
// (não conta o que ainda está em aberto, que não diz nada sobre sucesso).
export async function buscarHistoricoPrecoItem(params: { codKralen?: string; descricao?: string; idExcluir?: string }): Promise<HistoricoPrecoItem | null> {
  const codKralen = params.codKralen?.trim()
  const descricao = params.descricao?.trim()
  let query = supabase
    .from('processo_itens')
    .select('id, valor_ganho, valor_unit_minimo, vencedor, desclassificado, criado_em, processos(status)')
    .eq('empresa_id', empresaAtual())
    .order('criado_em', { ascending: true })
  if (codKralen) query = query.eq('codigo_interno', codKralen)
  else if (descricao) query = query.ilike('descricao', descricao)
  else return null

  const { data, error } = await query
  if (error) throw error
  const rows = ((data || []) as any[])
    .filter(it => it.id !== params.idExcluir)
    .map(it => ({ ...paraApp(MAPA_ITEM, it), licitacoes: it.processos && paraApp(MAPA_PROCESSO, it.processos) }))
  if (rows.length === 0) return null

  const decididos = rows.filter(it => situacaoDoItem({ status: it.licitacoes?.status }, it) !== 'Em aberto')
  const vitorias = decididos.filter(it => it.vencedor)
  const ganhosValidos = vitorias.map(it => Number(it.valorGanho)).filter(v => Number.isFinite(v) && v > 0)
  const minimosValidos = rows.map(it => Number(it.valorUnitMinimo)).filter(v => Number.isFinite(v) && v > 0)

  return {
    ocorrencias: decididos.length,
    vitorias: vitorias.length,
    taxaVitoria: decididos.length > 0 ? (vitorias.length / decididos.length) * 100 : null,
    ultimoValorGanho: ganhosValidos.length > 0 ? ganhosValidos[ganhosValidos.length - 1] : null,
    mediaValorUnitMinimo: minimosValidos.length > 0 ? minimosValidos.reduce((a, b) => a + b, 0) / minimosValidos.length : null,
  }
}

// Atualiza só a linha daquele item — vencedor/valorGanho/desclassificado
// e edição inline mexem apenas nessa linha, nunca na lista inteira, então
// dois colaboradores editando itens diferentes da mesma licitação não se
// sobrescrevem mais.
export async function updateItem(id: string, patch: any): Promise<any> {
  const { row, problemas } = sanitizeItem(patch)
  if (problemas.length > 0) throw new Error(`Valor numérico inválido — ${problemas.join(', ')}.`)
  const { data, error } = await supabase.from('processo_itens').update(paraBanco(MAPA_ITEM, row)).eq('id', id)
    .select('*, processos(numero)').single()
  if (error) throw error
  return itemParaTela(data, data.processos?.numero)
}
