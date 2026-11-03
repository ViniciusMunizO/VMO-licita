import { supabase } from './supabaseClient'
import { empresaAtual, paraApp, paraBanco, lembrarProcesso, nomesDaEmpresa, MAPA_PROCESSO } from './banco'

// No banco multiempresa a licitação mora na tabela `processos`, e o `codigo`
// que as telas mostram é o número do processo dentro da empresa (1, 2, 3...),
// escolhido pelo banco. Ver utils/banco.ts.
async function paraTela(linhas: any[]): Promise<any[]> {
  const nomes = await nomesDaEmpresa()
  return linhas.map(l => {
    lembrarProcesso(l.numero, l.id)
    return { ...paraApp(MAPA_PROCESSO, l), criadoPor: nomes[l.criado_por] }
  })
}

export async function listLicitacoes(): Promise<any[]> {
  const { data, error } = await supabase.from('processos').select('*')
    .eq('empresa_id', empresaAtual()).order('numero', { ascending: false })
  if (error) throw error
  return paraTela(data || [])
}

export async function getLicitacao(codigo: number | string): Promise<any | null> {
  const { data, error } = await supabase.from('processos').select('*')
    .eq('empresa_id', empresaAtual()).eq('numero', codigo).maybeSingle()
  if (error) throw error
  return data ? (await paraTela([data]))[0] : null
}

// Prévia do próximo código, só pra mostrar no formulário antes de salvar —
// quem realmente define o número final é o banco (migração 0013), que nunca
// repete número dentro da empresa mesmo com dois cadastros simultâneos.
export async function previewNextCodigo(): Promise<number> {
  const { data, error } = await supabase.from('processos').select('numero')
    .eq('empresa_id', empresaAtual()).order('numero', { ascending: false }).limit(1)
  if (error) throw error
  return (data?.[0]?.numero || 0) + 1
}

export async function createLicitacao(dados: any): Promise<any> {
  const { codigo, ...rest } = dados
  const { data, error } = await supabase.from('processos')
    .insert({ ...paraBanco(MAPA_PROCESSO, rest), empresa_id: empresaAtual() }).select().single()
  if (error) throw error
  return (await paraTela([data]))[0]
}

export async function updateLicitacao(codigo: number | string, patch: any): Promise<any> {
  const { codigo: _ignore, ...rest } = patch
  const { data, error } = await supabase.from('processos').update(paraBanco(MAPA_PROCESSO, rest))
    .eq('empresa_id', empresaAtual()).eq('numero', codigo).select().single()
  if (error) throw error
  return (await paraTela([data]))[0]
}
