import { supabase } from './supabaseClient'

export type AuditEntry = {
  id: string
  at: number
  user?: string
  action: string
  payload?: any
}

export async function auditLog(action: string, payload?: any, user?: string) {
  try {
    await supabase.from('audit_logs').insert({ at: Date.now(), user, action, payload })
  } catch {
    // Log de auditoria nunca deve travar a ação principal do usuário.
  }
}

// Tabela só cresce (uma linha por ação relevante do sistema inteiro) e nunca
// é limpa — sem limite, a tela de auditoria tentaria carregar a trilha
// inteira de uma vez, que fica pesado depois de alguns meses de uso real.
export async function listAuditLogs(limit = 200): Promise<AuditEntry[]> {
  // O nome exibido vem de `profiles` via `user_id` (preenchido pelo Postgres,
  // não pelo cliente) — só cai pro texto livre da coluna `"user"` em linhas
  // gravadas antes da migração 0007, onde `user_id` é null.
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, at, user, action, payload, profiles(name)')
    .order('at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map((row: any) => ({
    id: row.id,
    at: row.at,
    action: row.action,
    payload: row.payload,
    user: row.profiles?.name || row.user || undefined,
  }))
}

// Nem admin consegue apagar log mais novo que isso — reforçado na policy de
// delete (migração 0012), não é só um limite de interface. Existe pra que a
// própria retenção não vire um jeito de sumir com atividade recente.
export const RETENCAO_MINIMA_DIAS = 180

// Retenção/LGPD: busca os logs mais antigos que `cutoffEpoch` e apaga — quem
// chama exporta o retorno pra Excel antes (a tela nunca apaga sem exportar
// primeiro). RLS só deixa admin ativo apagar log com mais de
// RETENCAO_MINIMA_DIAS (migração 0012); se `cutoffEpoch` pedir algo mais
// recente que isso, o delete não afeta essas linhas — por isso reconferimos
// quais IDs realmente sumiram antes de reportar/exportar como "apagado".
export async function purgeAuditLogsOlderThan(cutoffEpoch: number): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, at, user, action, payload, profiles(name)')
    .lt('at', cutoffEpoch)
  if (error) throw error
  const rows: AuditEntry[] = (data || []).map((row: any) => ({
    id: row.id,
    at: row.at,
    action: row.action,
    payload: row.payload,
    user: row.profiles?.name || row.user || undefined,
  }))
  if (rows.length === 0) return []
  const ids = rows.map(r => r.id)
  const { error: delError } = await supabase.from('audit_logs').delete().in('id', ids)
  if (delError) throw delError
  const { data: restantes, error: restError } = await supabase.from('audit_logs').select('id').in('id', ids)
  if (restError) throw restError
  const idsRestantes = new Set((restantes || []).map((r: any) => r.id))
  return rows.filter(r => !idsRestantes.has(r.id))
}
