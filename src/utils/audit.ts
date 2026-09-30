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

export async function listAuditLogs(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from('audit_logs').select('*').order('at', { ascending: false })
  if (error) throw error
  return data || []
}
