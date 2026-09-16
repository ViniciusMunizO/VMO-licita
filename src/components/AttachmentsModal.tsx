import React, { useEffect, useState } from 'react'
import { listAttachments, addAttachment, removeAttachment, getAttachmentData } from '../utils/attachments'
import { auditLog } from '../utils/audit'
import { urlsAssinadas, urlAssinada, baixarAnexo, formatarTamanho, MAX_ANEXO_BYTES } from '../utils/arquivo'

type Attachment = {
  id: string
  name: string
  filename: string
  path?: string | null
  mime?: string | null
  size?: number | null
  date?: string
}

export default function AttachmentsModal({ open, onClose, codigo }: { open: boolean; onClose: () => void; codigo: number }) {
  const [list, setList] = useState<Attachment[]>([])
  const [name, setName] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  // Caminho no bucket -> URL assinada. O bucket é privado, então não existe
  // link fixo: as URLs são geradas de uma vez pra lista toda ao carregar.
  const [urls, setUrls] = useState<Record<string, string>>({})

  const carregarUrls = async (anexos: Attachment[]) => {
    const paths = anexos.map(a => a.path).filter(Boolean) as string[]
    if (paths.length === 0) return setUrls({})
    try {
      setUrls(await urlsAssinadas(paths))
    } catch {
      // Sem as URLs a lista ainda serve (nome, tamanho, remover); abrir e
      // baixar caem no caminho sob demanda, que gera a URL na hora.
      setUrls({})
    }
  }

  useEffect(() => {
    if (!open) return
    let mounted = true
    listAttachments(codigo)
      .then(raw => {
        if (!mounted) return
        setList(raw || [])
        void carregarUrls(raw || [])
      })
      // Sem isso, falha de leitura mostrava "Nenhum anexo" — a mesma tela de
      // quando realmente não há anexo, o que é bem pior do que um erro.
      .catch(() => { if (mounted) setErro('Não consegui carregar os anexos desta licitação.') })
    return () => { mounted = false }
  }, [open, codigo])

  const onFile = async (f: File | null) => {
    if (!f) return
    setErro('')
    setSalvando(true)
    try {
      const att = { name: name || f.name, file: f }
      const updated = await addAttachment(codigo, att)
      setList(updated)
      await carregarUrls(updated)
      setName('')
      void recordUpload({ name: att.name, filename: f.name })
    } catch (err: any) {
      setErro(err?.message || 'Não consegui salvar o anexo. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const remove = async (id: string) => {
    setErro('')
    try {
      const updated = await removeAttachment(id, codigo)
      setList(updated)
      void recordRemove(id)
    } catch (err: any) {
      setErro(err?.message || 'Não consegui remover o anexo.')
    }
  }

  // audit attachments
  const recordUpload = async (att: { name: string; filename: string }) => {
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('attachment_upload', { codigo, name: att.name, filename: att.filename }, user)
    } catch (err) { /* ignore */ }
  }

  const recordRemove = async (attId: string) => {
    try {
      const user = localStorage.getItem('user_name') || undefined
      await auditLog('attachment_remove', { codigo, id: attId }, user)
    } catch (err) { /* ignore */ }
  }

  // Anexo antigo (anterior ao Storage) não tem `path`: o conteúdo continua em
  // base64 no banco e só é buscado quando alguém realmente abre o arquivo.
  const referencia = async (a: Attachment) => (
    a.path ? { path: a.path, filename: a.filename } : { data: await getAttachmentData(a.id), filename: a.filename }
  )

  const abrir = async (a: Attachment) => {
    setErro('')
    // A aba é aberta antes do await de propósito: abrir depois de uma operação
    // assíncrona é exatamente o que os bloqueadores de pop-up barram.
    const aba = window.open('', '_blank')
    try {
      const url = a.path ? urls[a.path] || await urlAssinada(a.path) : await getAttachmentData(a.id)
      if (!url) {
        aba?.close()
        setErro('O conteúdo deste anexo não está disponível.')
        return
      }
      if (aba) aba.location.href = url
    } catch (err: any) {
      aba?.close()
      setErro(err?.message || 'Não consegui abrir o anexo.')
    }
  }

  const baixar = async (a: Attachment) => {
    setErro('')
    try {
      await baixarAnexo(await referencia(a))
    } catch (err: any) {
      setErro(err?.message || 'Não consegui baixar o anexo.')
    }
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
            <label className={`btn btn-ghost inline-flex items-center gap-2 ${salvando ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                type="file"
                disabled={salvando}
                // Limpar o value deixa o onChange disparar de novo quando o
                // mesmo arquivo é escolhido duas vezes seguidas (reenviar
                // depois de um erro é justamente o caso comum).
                onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void onFile(f) }}
                className="hidden"
              />
              {salvando ? 'Enviando...' : 'Selecionar arquivo'}
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo por anexo: {formatarTamanho(MAX_ANEXO_BYTES)}.</p>
          {erro && <p className="text-sm mt-2" style={{ color: 'var(--color-error)' }}>{erro}</p>}
        </div>

        <div className="max-h-64 overflow-auto rounded p-2">
          {list.length === 0 && <p className="text-sm text-gray-500">Nenhum anexo.</p>}
          {list.map(a => {
            const thumb = a.path && a.mime?.startsWith('image/') ? urls[a.path] : undefined
            return (
              <div key={a.id} className="flex justify-between items-center border-b py-2">
                <div className="flex items-center gap-3">
                  {thumb && <img src={thumb} alt={a.name} className="w-12 h-12 object-cover rounded" />}
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.filename} — {formatarTamanho(a.size)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrir(a)} className="btn btn-ghost">Abrir</button>
                  <button onClick={() => baixar(a)} className="btn btn-primary">Baixar</button>
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
