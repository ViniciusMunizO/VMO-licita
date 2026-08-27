import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { dbGet } from '../utils/db'
import { exportElementsToPdf } from '../utils/pdf'
import { DECLARACOES, buildDeclaracaoContext, renderDeclaracaoText, DeclaracaoContext } from '../utils/declaracoes'
import PrintableDeclaracao from './PrintableDeclaracao'

function slugify(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Campos que aparecem nas declarações — se algum estiver faltando, o texto
// gerado sai com lacunas, então avisamos antes de deixar emitir.
const REQUIRED_EMPRESA_FIELDS: { key: string; label: string }[] = [
  { key: 'razaoSocial', label: 'Razão Social' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'cep', label: 'CEP' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'UF' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'banco', label: 'Banco' },
  { key: 'agencia', label: 'Agência' },
  { key: 'conta', label: 'Conta' },
  { key: 'representanteNome', label: 'Nome do Representante Legal' },
  { key: 'representanteCargo', label: 'Cargo' },
  { key: 'representanteCpf', label: 'CPF' },
  { key: 'representanteRg', label: 'RG' },
]

const DECLARACOES_ORDENADAS = [...DECLARACOES].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))

export default function DeclaracoesSection({ modelo }: { modelo: any }) {
  const [empresa, setEmpresa] = useState<any>(null)
  const [current, setCurrent] = useState<{ titulo: string; corpo: string; ctx: DeclaracaoContext; filename: string } | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customTitulo, setCustomTitulo] = useState('')
  const [customCorpo, setCustomCorpo] = useState('')
  const pageRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    dbGet('empresa_info').then(v => { if (mounted) setEmpresa(v || null) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!current) return
    let cancelled = false
    const run = async () => {
      await new Promise(r => setTimeout(r, 80))
      if (cancelled || !pageRef.current) return
      await exportElementsToPdf([pageRef.current], current.filename, current.titulo)
    }
    run()
    return () => { cancelled = true }
  }, [current])

  const camposFaltando = REQUIRED_EMPRESA_FIELDS.filter(f => !empresa?.[f.key])
  const empresaIncompleta = !empresa || camposFaltando.length > 0

  const gerar = (titulo: string, corpoTemplate: string) => {
    const ctx = buildDeclaracaoContext(empresa, modelo)
    const corpo = renderDeclaracaoText(corpoTemplate, ctx)
    setCurrent({ titulo, corpo, ctx, filename: `${slugify(titulo)}_${modelo.codigo}.pdf` })
  }

  const gerarPersonalizada = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customTitulo.trim()) return
    gerar(customTitulo, customCorpo)
    setShowCustom(false)
    setCustomTitulo('')
    setCustomCorpo('')
  }

  return (
    <div className="mt-6">
      <h4 className="font-semibold mb-2">Declarações</h4>
      {empresaIncompleta && (
        <div className="text-sm text-yellow-700 bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3">
          {!empresa ? (
            <div>Cadastre as <Link to="/empresa" className="link-primary">Informações da Empresa</Link> antes de emitir declarações.</div>
          ) : (
            <>
              <div>Faltam dados nas <Link to="/empresa" className="link-primary">Informações da Empresa</Link> — as declarações podem sair com lacunas:</div>
              <div className="mt-1 text-xs text-yellow-800">{camposFaltando.map(f => f.label).join(', ')}</div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {DECLARACOES_ORDENADAS.map(d => (
          <button key={d.id} type="button" onClick={() => gerar(d.titulo, d.corpo)} className="btn btn-ghost text-xs justify-start text-left">
            {d.titulo}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t">
        <button type="button" onClick={() => setShowCustom(true)} className="btn btn-primary text-xs">
          + Declaração Personalizada
        </button>
      </div>

      {showCustom && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50">
          <div className="bg-white rounded shadow max-w-2xl w-full p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold">Declaração Personalizada</h4>
              <button onClick={() => setShowCustom(false)} className="text-gray-500">Fechar</button>
            </div>
            <form onSubmit={gerarPersonalizada} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Título</label>
                <input value={customTitulo} onChange={e => setCustomTitulo(e.target.value)} className="w-full p-2 rounded" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Texto</label>
                <textarea value={customCorpo} onChange={e => setCustomCorpo(e.target.value)} className="w-full p-2 rounded" rows={8} />
              </div>
              <button className="btn btn-primary" type="submit">Gerar PDF</button>
            </form>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: -9999 }} aria-hidden>
        {current && <PrintableDeclaracao titulo={current.titulo} corpo={current.corpo} ctx={current.ctx} pageRef={pageRef} />}
      </div>
    </div>
  )
}
