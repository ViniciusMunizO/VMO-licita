import { supabase } from './supabaseClient'
import { empresaGuardada, paraApp, nomesDaEmpresa, empresaAtual, MAPA_AUDITORIA } from './banco'

export type AuditEntry = {
  id: string
  at: number
  user?: string
  action: string
  payload?: any
}

// Quem fez a ação o banco grava sozinho (usuario_id = auth.uid()); o nome em
// texto fica só como apoio, caso a pessoa saia da empresa depois.
export async function auditLog(action: string, payload?: any, user?: string) {
  try {
    const empresa = empresaGuardada()
    if (!empresa) return
    await supabase.from('auditoria').insert({ empresa_id: empresa, usuario_nome: user, acao: action, detalhes: payload })
  } catch {
    // Log de auditoria nunca deve travar a ação principal do usuário.
  }
}

async function paraTela(linhas: any[]): Promise<AuditEntry[]> {
  const nomes = await nomesDaEmpresa()
  return linhas.map(l => {
    const e = paraApp(MAPA_AUDITORIA, l) as AuditEntry
    return { ...e, user: nomes[l.usuario_id] || l.usuario_nome || undefined }
  })
}

// Tabela só cresce (uma linha por ação relevante do sistema inteiro) e nunca
// é limpa — sem limite, a tela de auditoria tentaria carregar a trilha
// inteira de uma vez, que fica pesado depois de alguns meses de uso real.
export async function listAuditLogs(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('*')
    .eq('empresa_id', empresaAtual())
    .order('em', { ascending: false })
    .limit(limit)
  if (error) throw error
  return paraTela(data || [])
}

// Nem admin consegue apagar log mais novo que isso — reforçado na regra de
// apagar do banco (migração 0012 do Radar), não é só um limite de interface.
// Existe pra que a própria retenção não vire um jeito de sumir com atividade
// recente.
export const RETENCAO_MINIMA_DIAS = 180

// Retenção/LGPD: busca os logs mais antigos que `cutoffEpoch` e apaga — quem
// chama exporta o retorno pra Excel antes (a tela nunca apaga sem exportar
// primeiro). O banco só deixa admin ativo apagar log com mais de
// RETENCAO_MINIMA_DIAS; se `cutoffEpoch` pedir algo mais recente que isso, o
// delete não afeta essas linhas — por isso reconferimos quais IDs realmente
// sumiram antes de reportar/exportar como "apagado".
export async function purgeAuditLogsOlderThan(cutoffEpoch: number): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('auditoria')
    .select('*')
    .eq('empresa_id', empresaAtual())
    .lt('em', new Date(cutoffEpoch).toISOString())
  if (error) throw error
  const rows = await paraTela(data || [])
  if (rows.length === 0) return []
  const ids = rows.map(r => r.id)
  const { error: delError } = await supabase.from('auditoria').delete().in('id', ids)
  if (delError) throw delError
  const { data: restantes, error: restError } = await supabase.from('auditoria').select('id').in('id', ids)
  if (restError) throw restError
  const idsRestantes = new Set((restantes || []).map((r: any) => r.id))
  return rows.filter(r => !idsRestantes.has(r.id))
}
