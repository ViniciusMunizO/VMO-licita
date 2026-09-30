import { supabase } from './supabaseClient'

// Colunas numéricas do banco. Célula vazia vira null (o Postgres rejeita ''),
// e texto no formato brasileiro é convertido pra número antes de gravar —
// veja `paraNumero`.
const NUMERIC_FIELDS = ['quantidade', 'valorCusto', 'totalCusto', 'valorUnitMinimo', 'valorTotalMinimo', 'valorUnitMunicipio', 'valorTotalMunicipio'] as const

const LABELS: Record<string, string> = {
  quantidade: 'Quantidade',
  valorCusto: 'Valor Custo',
  totalCusto: 'Total Custo',
  valorUnitMinimo: 'Valor Unit. Mínimo',
  valorTotalMinimo: 'Valor Total Mínimo',
  valorUnitMunicipio: 'Valor Unit. Município',
  valorTotalMunicipio: 'Valor Total Município',
}

// Marcador de valor que não dá pra interpretar como número — diferente de
// null (vazio, que é gravável). Quem chama decide o que fazer: a importação
// aborta antes de escrever qualquer coisa, a edição inline reclama do campo.
const INVALIDO = Symbol('numero invalido')

// Converte o que chega da planilha ou do input de texto pra número.
//
// O caso silenciosamente perigoso é "1.000": `Number()` devolve 1, e o
// sistema gravava mil como um sem ninguém perceber. Por isso o ponto não é
// tratado como decimal quando o texto tem cara de separador de milhar
// (grupos de exatamente 3 dígitos). Quando aparecem os dois separadores, o
// último a aparecer é o decimal — cobre tanto "1.200,50" (pt-BR) quanto
// "1,200.50", que às vezes escapa de planilha configurada em inglês.
function paraNumero(valor: any): number | null | typeof INVALIDO {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : INVALIDO
  if (typeof valor !== 'string') return INVALIDO

  //   = espaço não-separável, comum em valor copiado de portal/planilha.
  const texto = valor.replace(/ /g, ' ').replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (texto === '') return null
  if (!/^-?[\d.,]+$/.test(texto)) return INVALIDO

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')
  let normalizado: string
  if (temVirgula && temPonto) {
    const decimal = texto.lastIndexOf(',') > texto.lastIndexOf('.') ? ',' : '.'
    const milhar = decimal === ',' ? '.' : ','
    normalizado = texto.split(milhar).join('').replace(decimal, '.')
  } else if (temVirgula) {
    normalizado = texto.replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.split('.').join('')
  } else {
    normalizado = texto
  }

  const num = Number(normalizado)
  return Number.isFinite(num) ? num : INVALIDO
}

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
  const { data, error } = await supabase.from('items').select('*').eq('licitacaoCodigo', licitacaoCodigo).order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Mesma consulta que `listItems`, mas pra várias licitações de uma vez — usada
// nas telas que precisam dos itens de toda a lista (Dashboard, relatórios).
// Fazer `listItems` dentro de um `.map()` vira uma chamada ao banco por
// licitação (N+1); isto troca por uma única chamada com `.in()`.
export async function listItemsByCodigos(licitacaoCodigos: (number | string)[]): Promise<Record<string, any[]>> {
  if (licitacaoCodigos.length === 0) return {}
  const { data, error } = await supabase.from('items').select('*').in('licitacaoCodigo', licitacaoCodigos).order('created_at', { ascending: true })
  if (error) throw error
  const porCodigo: Record<string, any[]> = {}
  for (const it of data || []) {
    const k = String(it.licitacaoCodigo)
    ;(porCodigo[k] ||= []).push(it)
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
  const rows: any[] = []
  const problemas: string[] = []
  items.forEach((it, i) => {
    const { row, problemas: p } = sanitizeItem({ ...it, licitacaoCodigo })
    if (p.length > 0) problemas.push(`linha ${i + 1} (${it.descricao || 'sem descrição'}) — ${p.join(', ')}`)
    rows.push(row)
  })
  if (problemas.length > 0) {
    const amostra = problemas.slice(0, 5).join('; ')
    const resto = problemas.length > 5 ? ` (e mais ${problemas.length - 5})` : ''
    throw new Error(`Valores numéricos inválidos na planilha, nada foi importado: ${amostra}${resto}.`)
  }

  const { data: antigos, error: listError } = await supabase.from('items').select('id').eq('licitacaoCodigo', licitacaoCodigo)
  if (listError) throw listError
  const idsAntigos = (antigos || []).map((r: any) => r.id)

  let novos: any[] = []
  if (rows.length > 0) {
    const { data, error } = await supabase.from('items').insert(rows).select()
    if (error) throw error // nada foi apagado ainda — a lista antiga continua de pé
    novos = data || []
  }

  if (idsAntigos.length > 0) {
    const { error: delError } = await supabase.from('items').delete().in('id', idsAntigos)
    if (delError) {
      // Desfaz o insert pra não deixar a licitação com as duas listas juntas.
      if (novos.length > 0) await supabase.from('items').delete().in('id', novos.map(r => r.id))
      throw delError
    }
  }
  return novos
}

// Atualiza só a linha daquele item — vencedor/valorGanho/desclassificado
// e edição inline mexem apenas nessa linha, nunca na lista inteira, então
// dois colaboradores editando itens diferentes da mesma licitação não se
// sobrescrevem mais.
export async function updateItem(id: string, patch: any): Promise<any> {
  const { row, problemas } = sanitizeItem(patch)
  if (problemas.length > 0) throw new Error(`Valor numérico inválido — ${problemas.join(', ')}.`)
  const { data, error } = await supabase.from('items').update(row).eq('id', id).select().single()
  if (error) throw error
  return data
}
