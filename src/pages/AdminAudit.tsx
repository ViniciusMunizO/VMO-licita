import React, { useEffect, useState } from 'react'
import { listAuditLogs } from '../utils/audit'
import { formatEpochBR } from '../utils/date'

export default function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    listAuditLogs().then(raw => { if (mounted) setLogs(raw) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="bg-white p-6 rounded shadow max-w-5xl">
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
