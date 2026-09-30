import React, { useEffect, useState } from 'react'
import {
  listDocumentosEmpresa, addDocumentoEmpresa, updateDocumentoEmpresa, removeDocumentoEmpresa,
  DocumentoEmpresa,
} from '../utils/documentos'
import { urlsAssinadas, urlAssinada, baixarAnexo, formatarTamanho, MAX_ANEXO_BYTES } from '../utils/arquivo'
import { nowInBrasilia, diasParaVencer } from '../utils/date'
import { confirmarRemocao } from '../utils/confirmar'
import { DateInputBR } from './DateTimeBR'

const FORM_VAZIO = { tipo: '', numero: '', dataEmissao: '', dataValidade: '', reutilizavel: true, observacao: '' }

function corValidade(dias: number | null): string {
  if (dias === null) return '#6b7280'
  if (dias < 0) return 'var(--color-error)'
  if (dias <= 30) return '#b45309'
  return '#15803d'
}

function textoValidade(dias: number | null): string {
  if (dias === null) return 'Sem validade'
  if (dias < 0) return `Venceu há ${Math.abs(dias)} dia(s)`
  if (dias === 0) return 'Vence hoje'
  return `Vence em ${dias} dia(s)`
}

export default function DocumentosEmpresaSection() {
  const [docs, setDocs] = useState<DocumentoEmpresa[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [form, setForm] = useState(FORM_VAZIO)
  const [file, setFile] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const hoje = nowInBrasilia().date

  const carregarUrls = async (lista: DocumentoEmpresa[]) => {
    const paths = lista.map(d => d.path).filter(Boolean) as string[]
    if (paths.length === 0) return setUrls({})
    try { setUrls(await urlsAssinadas(paths)) } catch { setUrls({}) }
  }

  const carregar = () => {
    listDocumentosEmpresa()
      .then(list => { setDocs(list); void carregarUrls(list) })
      .catch(() => setErro('Não consegui carregar os documentos da empresa.'))
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim() || !file) {
      setErro('Informe o tipo do documento e selecione o arquivo.')
      return
    }
    setErro('')
    setSalvando(true)
    try {
      const userName = localStorage.getItem('user_name') || undefined
      const list = await addDocumentoEmpresa({ ...form, file, criadoPor: userName })
      setDocs(list)
      await carregarUrls(list)
      setForm(FORM_VAZIO)
      setFile(null)
    } catch (err: any) {
      setErro(err?.message || 'Não consegui salvar o documento.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarReutilizavel = async (d: DocumentoEmpresa) => {
    const list = await updateDocumentoEmpresa(d.id, { reutilizavel: !d.reutilizavel })
    setDocs(list)
  }

  const remover = async (id: string) => {
    if (!confirmarRemocao('este documento', 'Se ele estiver anexado em alguma licitação, a cópia de lá continua intacta.')) return
    setErro('')
    try {
      const list = await removeDocumentoEmpresa(id)
      setDocs(list)
    } catch (err: any) {
      setErro(err?.message || 'Não consegui remover o documento.')
    }
  }

  const abrir = async (d: DocumentoEmpresa) => {
    if (!d.path) return
    const aba = window.open('', '_blank')
    try {
      const url = urls[d.path] || await urlAssinada(d.path)
      if (aba) aba.location.href = url
    } catch {
      aba?.close()
      setErro('Não consegui abrir o documento.')
    }
  }

  const baixar = async (d: DocumentoEmpresa) => {
    if (!d.path) return
    try { await baixarAnexo({ path: d.path, filename: d.filename }) } catch { setErro('Não consegui baixar o documento.') }
  }

  return (
    <div className="mt-6 bg-white border rounded p-4">
      <h4 className="font-semibold mb-1">Documentos e Certidões da Empresa</h4>
      <p className="text-sm text-gray-500 mb-4">
        Cadastre certidões e documentos com data de validade (CND, CRF do FGTS, atestados etc.) pra acompanhar o vencimento pelo Dashboard.
        Marcados como "reutilizável" ficam disponíveis pra anexar direto em qualquer licitação, sem re-enviar o arquivo.
      </p>

      <form onSubmit={salvar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-4 border-b pb-4">
        <div>
          <label className="block text-sm text-gray-600">Tipo</label>
          <input
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            placeholder="Ex: CND Federal"
            className="w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Número</label>
          <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="w-full p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Emissão</label>
          <DateInputBR value={form.dataEmissao} onChange={v => setForm(f => ({ ...f, dataEmissao: v }))} className="w-full p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Validade</label>
          <DateInputBR value={form.dataValidade} onChange={v => setForm(f => ({ ...f, dataValidade: v }))} className="w-full p-2 rounded" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-600">Observação</label>
          <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} className="w-full p-2 rounded" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.reutilizavel} onChange={e => setForm(f => ({ ...f, reutilizavel: e.target.checked }))} />
          Reutilizável em licitações
        </label>
        <div className="flex gap-2">
          <label className={`btn btn-ghost flex-1 text-center ${salvando ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="file"
              disabled={salvando}
              onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = '' }}
              className="hidden"
            />
            {file ? file.name : 'Selecionar arquivo'}
          </label>
          <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? 'Enviando...' : 'Adicionar'}
          </button>
        </div>
      </form>
      <p className="text-xs text-gray-500 -mt-2 mb-3">Tamanho máximo por arquivo: {formatarTamanho(MAX_ANEXO_BYTES)}.</p>

      {erro && <p className="text-sm mb-3" style={{ color: 'var(--color-error)' }}>{erro}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum documento cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(d => {
            const dias = diasParaVencer(d.dataValidade, hoje)
            return (
              <div key={d.id} className="flex flex-wrap justify-between items-center gap-3 border-b py-2 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{d.tipo}{d.numero ? ` — ${d.numero}` : ''}</div>
                  <div className="text-xs text-gray-500">
                    {d.filename} — {formatarTamanho(d.size)}
                    {' · '}
                    <span style={{ color: corValidade(dias) }}>{textoValidade(dias)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={d.reutilizavel} onChange={() => alternarReutilizavel(d)} />
                    Reutilizável
                  </label>
                  <button onClick={() => abrir(d)} className="btn btn-ghost text-sm">Abrir</button>
                  <button onClick={() => baixar(d)} className="btn btn-ghost text-sm">Baixar</button>
                  <button onClick={() => remover(d.id)} className="btn text-sm" style={{ backgroundColor: 'var(--color-error)', color: '#fff' }}>Remover</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
