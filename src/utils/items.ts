import { supabase } from './supabaseClient'

// Colunas numéricas não aceitam string vazia — a importação de planilha às
// vezes traz célula vazia como '' em vez de undefined. Convertida pra null
// antes de gravar, senão o Postgres rejeita o insert/update inteiro.
const NUMERIC_FIELDS = ['quantidade', 'valorEdital', 'totalEdital', 'valorCusto', 'tx', 'custoUnitario', 'totalCusto', 'custoCaixa']

function sanitizeItem(item: any) {
  const out = { ...item }
  for (const f of NUMERIC_FIELDS) {
    if (out[f] === '' || out[f] === undefined) out[f] = null
  }
  return out
}

export async function listItems(licitacaoCodigo: number | string): Promise<any[]> {
  const { data, error } = await supabase.from('items').select('*').eq('licitacaoCodigo', licitacaoCodigo).order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Substitui todos os itens de uma licitação de uma vez — usado pela
// importação de planilha, onde a lista inteira já é conhecida.
export async function replaceItems(licitacaoCodigo: number | string, items: any[]): Promise<any[]> {
  const { error: delError } = await supabase.from('items').delete().eq('licitacaoCodigo', licitacaoCodigo)
  if (delError) throw delError
  if (items.length === 0) return []
  const rows = items.map(it => sanitizeItem({ ...it, licitacaoCodigo }))
  const { data, error } = await supabase.from('items').insert(rows).select()
  if (error) throw error
  return data || []
}

// Atualiza só a linha daquele item — vencedor/valorGanho/desclassificado
// e edição inline mexem apenas nessa linha, nunca na lista inteira, então
// dois colaboradores editando itens diferentes da mesma licitação não se
// sobrescrevem mais.
export async function updateItem(id: string, patch: any): Promise<any> {
  const { data, error } = await supabase.from('items').update(sanitizeItem(patch)).eq('id', id).select().single()
  if (error) throw error
  return data
}
