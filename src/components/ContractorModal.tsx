import React, { useEffect, useState } from 'react'
import { listContratantes, addContratante } from '../utils/contratantes'
import { useModalA11y } from './useModalA11y'

type Contratante = {
  codigo: string
  nome: string
  uf: string
}

export default function ContractorModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (c: Contratante) => void }) {
  const [list, setList] = useState<Contratante[]>([])
  const [form, setForm] = useState<Partial<Contratante>>({ nome: '', uf: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErro('')
    let mounted = true
    listContratantes().then(raw => { if (mounted) setList(raw || []) })
    return () => { mounted = false }
  }, [open])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const updated = await addContratante(form.nome || '', form.uf || '')
      setList(updated)
      setForm({ nome: '', uf: '' })
    } catch (err: any) {
      setErro(err?.message || 'Não consegui cadastrar o contratante. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const modalRef = useModalA11y(open, onClose)

  if (!open) return null

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded shadow max-w-2xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Contratantes (Municípios)</h4>
          <button onClick={onClose} className="text-gray-500">Fechar</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h5 className="font-semibold mb-2">Cadastrar novo</h5>
            <form onSubmit={save} className="space-y-2">
              <input aria-label="Nome do Município" placeholder="Nome do Município" value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full p-2 rounded" required />
              <input aria-label="UF" placeholder="UF" value={form.uf || ''} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} className="w-full p-2 rounded" maxLength={2} required />
              {erro && <p role="alert" className="text-sm" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
              <div className="flex gap-2">
                <button className="btn btn-primary disabled:opacity-50" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>

          <div>
            <h5 className="font-semibold mb-2">Contratantes cadastrados</h5>
            <div className="max-h-60 overflow-auto rounded p-2">
              {list.length === 0 && <p className="text-sm text-gray-500">Nenhum contratante cadastrado.</p>}
              {list.map(c => (
                <div key={c.codigo} className="flex justify-between items-center border-b py-2">
                  <div>
                    <div className="text-sm font-medium">{c.codigo} — {c.nome} / {c.uf}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { onSelect(c); onClose() }} className="btn btn-primary">Selecionar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
