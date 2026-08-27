import { dbGet, dbSet } from './db'

export type AuditEntry = {
  id: string
  at: number
  user?: string
  action: string
  payload?: any
}

const STORE_KEY = 'audit_logs'

export async function auditLog(action: string, payload?: any, user?: string) {
  try {
    const list = (await dbGet(STORE_KEY)) || []
    const entry: AuditEntry = { id: String(Date.now()) + Math.random().toString(36).slice(2, 8), at: Date.now(), user, action, payload }
    list.push(entry)
    await dbSet(STORE_KEY, list)
  } catch (err) {
    // fallback to localStorage
    const raw = localStorage.getItem(STORE_KEY)
    const list = raw ? JSON.parse(raw) : []
    const entry: AuditEntry = { id: String(Date.now()) + Math.random().toString(36).slice(2, 8), at: Date.now(), user, action, payload }
    list.push(entry)
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  }
}
