import React, { useEffect, useState } from 'react'

type Attachment = {
  id: string
  name: string
  filename: string
  data: string // base64
  date?: string
}

export default function AttachmentsModal({ open, onClose, codigo }: { open: boolean; onClose: () => void; codigo: number }) {
  const key = `attachments_${codigo}`
  const [list, setList] = useState<Attachment[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    let mounted = true
    import('../utils/db').then(async db => {
      await db.migrateFromLocalStorage()
      const raw = await db.dbGet(key)
      if (!mounted) return
      setList(raw || [])
    })
    return () => { mounted = false }
  }, [open, codigo])

  const onFile = (f: File | null) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = async () => {
      const data = String(reader.result)
      const att: Attachment = {
        id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
        name: name || f.name,
        filename: f.name,
        data,
        date: new Date().toISOString(),
      }
      const db = await import('../utils/db')
      // Anexa ao valor mais atual do banco (não ao estado local, que pode
      // estar desatualizado se outra aba mexeu nos anexos nesse meio-tempo).
      const updated = await db.dbUpdate<Attachment[]>(key, (current) => [...(current || []), att])
      setList(updated)
      setName('')
      void recordUpload(att)
    }
    reader.readAsDataURL(f)
  }

  const remove = async (id: string) => {
    const db = await import('../utils/db')
    const updated = await db.dbUpdate<Attachment[]>(key, (current) => (current || []).filter(l => l.id !== id))
    setList(updated)
    void recordRemove(id)
  }

  // audit attachments
  const recordUpload = async (att: Attachment) => {
    try {
      const { auditLog } = await import('../utils/audit')
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('attachment_upload', { codigo, name: att.name, filename: att.filename }, user)
    } catch (err) { /* ignore */ }
  }

  const recordRemove = async (attId: string) => {
    try {
      const { auditLog } = await import('../utils/audit')
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('attachment_remove', { codigo, id: attId }, user)
    } catch (err) { /* ignore */ }
  }

  const download = (att: Attachment) => {
    const parts = att.data.split(',')
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
    const bstr = atob(parts[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    const blob = new Blob([u8arr], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = att.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const getInfo = (att: Attachment) => {
    const parts = att.data.split(',')
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
    const b64 = parts[1] || ''
    const size = Math.round((b64.length * 3) / 4)
    return { mime, size }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
      <div className="bg-white rounded shadow max-w-2xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Anexos — Licitação {codigo}</h4>
          <button onClick={onClose} className="text-gray-500">Fechar</button>
        </div>

        <div className="mb-4">
          <label className="block text-sm">Título do documento</label>
          <div className="mt-1 flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} className="flex-1 p-2 rounded" placeholder="Ex: Edital, Comprovante de entrega..." />
            <label className="btn btn-ghost inline-flex items-center gap-2">
              <input type="file" onChange={e => onFile(e.target.files?.[0] || null)} className="hidden" />
              Selecionar arquivo
            </label>
          </div>
        </div>

        <div className="max-h-64 overflow-auto rounded p-2">
          {list.length === 0 && <p className="text-sm text-gray-500">Nenhum anexo.</p>}
          {list.map(a => {
            const info = getInfo(a)
            const isImage = info.mime.startsWith('image/')
            return (
              <div key={a.id} className="flex justify-between items-center border-b py-2">
                <div className="flex items-center gap-3">
                  {isImage && <img src={a.data} alt={a.name} className="w-12 h-12 object-cover rounded" />}
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.filename} — {Math.round(info.size/1024)} KB</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={a.data} target="_blank" rel="noreferrer" className="btn btn-ghost">Abrir</a>
                  <button onClick={() => download(a)} className="btn btn-primary">Baixar</button>
                  <button onClick={() => remove(a.id)} className="btn" style={{ backgroundColor: 'var(--color-error)', color: '#fff' }}>Remover</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
