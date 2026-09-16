import React, { useState } from 'react'
import { DateInputBR } from './DateTimeBR'
import { addMonthsToDate, formatDateBR } from '../utils/date'
import { formatarTamanho, MAX_ANEXO_BYTES } from '../utils/arquivo'

export type Ata = {
  id: string
  tipo: string
  numero: string
  inicioVigencia: string
  fimVigencia: string
  meses?: number
  observacoes?: string
  // Gravado na ata: `path` aponta pro objeto no bucket. `data` (base64) só
  // aparece nas atas criadas antes da migração pro Storage.
  anexo?: { name: string; path?: string; data?: string; mime?: string; size?: number } | null
  // O arquivo escolhido no formulário, ainda não enviado. Quem envia é o
  // `saveAta` da tela de detalhe, que sabe o código da licitação (e assim um
  // modal cancelado não deixa arquivo solto no bucket).
  arquivo?: File | null
  criadoEm: number
  criadoPor?: string
}

const TIPOS = ['Ata de Registro de Preços', 'Contrato', 'Aditivo de Prazo', 'Aditivo de Preços', 'Outros']

export default function AtaContratoModal({ open, onClose, onSave, criadoPor }: {
  open: boolean
  onClose: () => void
  // Devolve a promessa da gravação: o modal só fecha depois que o banco
  // confirmou. Fechar antes disso era o que fazia uma falha passar
  // despercebida — a ata sumia da tela como se nunca tivesse sido criada.
  onSave: (ata: Ata) => Promise<void>
  criadoPor?: string
}) {
  const [tipo, setTipo] = useState(TIPOS[0])
  const [numero, setNumero] = useState('')
  const [inicioVigencia, setInicioVigencia] = useState('')
  const [fimVigencia, setFimVigencia] = useState('')
  const [meses, setMeses] = useState(12)
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [showMesesPopup, setShowMesesPopup] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (!open) return null

  const handleInicioChange = (iso: string) => {
    setInicioVigencia(iso)
    if (iso) setShowMesesPopup(true)
  }

  const confirmMeses = () => {
    if (inicioVigencia) setFimVigencia(addMonthsToDate(inicioVigencia, meses))
    setShowMesesPopup(false)
  }

  // Só guarda o arquivo escolhido — o envio acontece no Salvar. Antes, aqui
  // se lia o arquivo inteiro pra base64 de forma assíncrona, e submeter antes
  // dessa leitura terminar gravava a ata com anexo nulo, sem aviso nenhum.
  const onFile = (f: File | null) => {
    if (!f) return
    if (f.size > MAX_ANEXO_BYTES) {
      setArquivo(null)
      setErro(`O arquivo tem ${formatarTamanho(f.size)} e o limite é ${formatarTamanho(MAX_ANEXO_BYTES)}. Anexe uma versão menor (ou compactada).`)
      return
    }
    setErro('')
    setArquivo(f)
  }

  const reset = () => {
    setTipo(TIPOS[0])
    setNumero('')
    setInicioVigencia('')
    setFimVigencia('')
    setMeses(12)
    setObservacoes('')
    setArquivo(null)
    setErro('')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const ata: Ata = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
      tipo,
      numero,
      inicioVigencia,
      fimVigencia,
      meses,
      observacoes: observacoes || undefined,
      arquivo,
      criadoEm: Date.now(),
      criadoPor,
    }
    setErro('')
    setSalvando(true)
    try {
      await onSave(ata)
      reset()
      onClose()
    } catch (err: any) {
      setErro(err?.message || 'Não consegui salvar a ata/contrato. Os dados continuam preenchidos, tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50 overflow-auto">
      <div className="bg-white rounded shadow max-w-xl w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Nova Ata / Contrato</h4>
          <button onClick={() => { reset(); onClose() }} className="text-gray-500">Fechar</button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full p-2 rounded">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600">Número da Ata/Contrato</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} className="w-full p-2 rounded" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600">Início da Vigência</label>
              <DateInputBR value={inicioVigencia} onChange={handleInicioChange} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Fim da Vigência</label>
              <DateInputBR value={fimVigencia} onChange={setFimVigencia} className="w-full p-2 rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600">Observações Adicionais</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="w-full p-2 rounded" rows={3} />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Anexo</label>
            <label className={`btn btn-ghost inline-flex items-center gap-2 ${salvando ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                type="file"
                disabled={salvando}
                // Limpar o value deixa o onChange disparar de novo quando o
                // mesmo arquivo é escolhido duas vezes seguidas.
                onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void onFile(f) }}
                className="hidden"
              />
              {arquivo ? arquivo.name : 'Selecionar arquivo'}
            </label>
            <p className="text-xs text-gray-500 mt-1">Tamanho máximo: {formatarTamanho(MAX_ANEXO_BYTES)}.</p>
          </div>

          {erro && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{erro}</p>}

          <button className="btn btn-primary disabled:opacity-50" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>

      {showMesesPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded shadow p-4 w-80">
            <h5 className="font-semibold mb-1">Quantidade de meses de vigência</h5>
            <p className="text-xs text-gray-500 mb-3">A partir de {formatDateBR(inicioVigencia)}. O fim da vigência pode ser ajustado depois.</p>
            <input
              type="number"
              min={1}
              value={meses}
              onChange={e => setMeses(Number(e.target.value) || 1)}
              className="w-full p-2 rounded mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={confirmMeses} className="btn btn-primary">Confirmar</button>
              <button type="button" onClick={() => setShowMesesPopup(false)} className="btn btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
