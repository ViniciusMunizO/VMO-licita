import React, { useEffect, useState } from 'react'
import { dbGet } from '../utils/db'
import { formatEpochBR } from '../utils/date'

export default function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      await import('../utils/db').then(m => m.migrateFromLocalStorage())
      const { dbGet } = await import('../utils/db')
      const raw = (await dbGet('audit_logs')) || (localStorage.getItem('audit_logs') ? JSON.parse(localStorage.getItem('audit_logs') || '[]') : [])
      if (!mounted) return
      setLogs(raw.reverse())
    }
    void load()
    return () => { mounted = false }
  }, [])

  return (
    <div className="bg-white p-6 rounded shadow max-w-4xl">
      <h3 className="text-xl font-semibold mb-4">Audit Log</h3>
      <div className="max-h-96 overflow-auto border rounded p-2">
        {logs.length === 0 && <div className="text-sm text-gray-500">Nenhum log de auditoria.</div>}
        {logs.map((l: any) => (
          <div key={l.id} className="p-2 border-b">
            <div className="text-sm text-gray-700">{formatEpochBR(l.at)} — <strong>{l.action}</strong> — {l.user || 'unknown'}</div>
            <pre className="text-xs mt-1 bg-gray-50 p-2 rounded">{JSON.stringify(l.payload, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
