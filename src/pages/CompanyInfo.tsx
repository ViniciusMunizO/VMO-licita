import React, { useEffect, useState } from 'react'
import { getEmpresaInfo, saveEmpresaInfo } from '../utils/empresa'
import { DECLARACAO_PROPOSTA_PADRAO } from '../utils/proposta'
import { confirmarRemocao } from '../utils/confirmar'
import DocumentosEmpresaSection from '../components/DocumentosEmpresaSection'

type BancoConta = {
  id: string
  apelido: string
  banco: string
  agencia: string
  conta: string
}

type EmpresaInfo = {
  razaoSocial: string
  cnpj: string
  inscricaoEstadual: string
  inscricaoMunicipal: string
  endereco: string
  cep: string
  cidade: string
  uf: string
  telefone: string
  email: string
  bancos: BancoConta[]
  representanteNome: string
  representanteCargo: string
  representanteCpf: string
  representanteRg: string
  declaracoesProposta: string
}

const empty: EmpresaInfo = {
  razaoSocial: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '',
  endereco: '', cep: '', cidade: '', uf: '', telefone: '', email: '',
  bancos: [],
  representanteNome: '', representanteCargo: '', representanteCpf: '', representanteRg: '',
  declaracoesProposta: ''
}

function novaConta(): BancoConta {
  return { id: crypto.randomUUID(), apelido: '', banco: '', agencia: '', conta: '' }
}

// Avisos de formato, não bloqueiam o Salvar — CNPJ/CEP de verdade (digitados
// com ou sem pontuação) sempre batem; o aviso só aparece pra quem claramente
// digitou algo incompleto ou com letra, antes que isso pare num PDF emitido.
function avisoCnpj(v: string): string {
  const digitos = v.replace(/\D/g, '')
  if (!v || digitos.length === 14) return ''
  return 'CNPJ costuma ter 14 dígitos.'
}

function avisoCep(v: string): string {
  const digitos = v.replace(/\D/g, '')
  if (!v || digitos.length === 8) return ''
  return 'CEP costuma ter 8 dígitos.'
}

export default function CompanyInfo() {
  const [form, setForm] = useState<EmpresaInfo>(empty)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let mounted = true
    getEmpresaInfo().then((raw) => {
      if (!mounted) return
      // Campos que nunca foram preenchidos voltam `null` do banco — sem isso
      // o React reclama de input controlado recebendo `null` como value.
      const semNulos = Object.fromEntries(Object.entries(raw || {}).filter(([, v]) => v !== null))
      setForm({ ...empty, ...semNulos })
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const set = (k: keyof EmpresaInfo) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await saveEmpresaInfo(form)
      setSavedAt(Date.now())
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível salvar as informações da empresa.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Carregando...</div>

  return (
    <div className="bg-white p-4 sm:p-6 rounded shadow max-w-5xl mx-auto">
      <h3 className="text-xl font-semibold mb-1">Informações da Empresa</h3>
      <p className="text-sm text-gray-500 mb-4">Esses dados são usados automaticamente nos documentos emitidos pelo sistema.</p>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="emp-razaoSocial" className="block text-sm text-gray-600">Razão Social</label>
          <input id="emp-razaoSocial" value={form.razaoSocial} onChange={set('razaoSocial')} className="w-full p-2 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="emp-cnpj" className="block text-sm text-gray-600">CNPJ</label>
            <input id="emp-cnpj" value={form.cnpj} onChange={set('cnpj')} className="w-full p-2 rounded" />
            {avisoCnpj(form.cnpj) && <p className="text-xs mt-1" style={{ color: '#b45309' }}>{avisoCnpj(form.cnpj)}</p>}
          </div>
          <div>
            <label htmlFor="emp-ie" className="block text-sm text-gray-600">Inscrição Estadual</label>
            <input id="emp-ie" value={form.inscricaoEstadual} onChange={set('inscricaoEstadual')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="emp-im" className="block text-sm text-gray-600">Inscrição Municipal</label>
            <input id="emp-im" value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} className="w-full p-2 rounded" />
          </div>
        </div>

        <div>
          <label htmlFor="emp-endereco" className="block text-sm text-gray-600">Endereço</label>
          <input id="emp-endereco" value={form.endereco} onChange={set('endereco')} className="w-full p-2 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="emp-cep" className="block text-sm text-gray-600">CEP</label>
            <input id="emp-cep" value={form.cep} onChange={set('cep')} className="w-full p-2 rounded" />
            {avisoCep(form.cep) && <p className="text-xs mt-1" style={{ color: '#b45309' }}>{avisoCep(form.cep)}</p>}
          </div>
          <div>
            <label htmlFor="emp-cidade" className="block text-sm text-gray-600">Cidade</label>
            <input id="emp-cidade" value={form.cidade} onChange={set('cidade')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="emp-uf" className="block text-sm text-gray-600">UF</label>
            <input id="emp-uf" value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} maxLength={2} className="w-full p-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emp-telefone" className="block text-sm text-gray-600">Telefone</label>
            <input id="emp-telefone" value={form.telefone} onChange={set('telefone')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label htmlFor="emp-email" className="block text-sm text-gray-600">E-mail</label>
            <input id="emp-email" type="email" value={form.email} onChange={set('email')} className="w-full p-2 rounded" />
          </div>
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
            <div>
              <h4 className="font-semibold">Contas Bancárias</h4>
              <p className="text-sm text-gray-500">Cadastre quantas contas precisar — na licitação você escolhe qual delas entra na Proposta e nas Declarações.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, bancos: [...f.bancos, novaConta()] }))}
              className="btn btn-ghost text-sm"
            >
              + Adicionar conta
            </button>
          </div>

          {form.bancos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma conta cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {form.bancos.map((conta, idx) => (
                <div key={conta.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end border-t pt-3 first:border-t-0 first:pt-0">
                  <div>
                    <label htmlFor={`conta-apelido-${conta.id}`} className="block text-sm text-gray-600">Apelido</label>
                    <input
                      id={`conta-apelido-${conta.id}`}
                      value={conta.apelido}
                      placeholder="ex.: Conta principal"
                      onChange={e => setForm(f => {
                        const bancos = [...f.bancos]; bancos[idx] = { ...bancos[idx], apelido: e.target.value }
                        return { ...f, bancos }
                      })}
                      className="w-full p-2 rounded"
                    />
                  </div>
                  <div>
                    <label htmlFor={`conta-banco-${conta.id}`} className="block text-sm text-gray-600">Banco</label>
                    <input
                      id={`conta-banco-${conta.id}`}
                      value={conta.banco}
                      onChange={e => setForm(f => {
                        const bancos = [...f.bancos]; bancos[idx] = { ...bancos[idx], banco: e.target.value }
                        return { ...f, bancos }
                      })}
                      className="w-full p-2 rounded"
                    />
                  </div>
                  <div>
                    <label htmlFor={`conta-agencia-${conta.id}`} className="block text-sm text-gray-600">Agência</label>
                    <input
                      id={`conta-agencia-${conta.id}`}
                      value={conta.agencia}
                      onChange={e => setForm(f => {
                        const bancos = [...f.bancos]; bancos[idx] = { ...bancos[idx], agencia: e.target.value }
                        return { ...f, bancos }
                      })}
                      className="w-full p-2 rounded"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor={`conta-conta-${conta.id}`} className="block text-sm text-gray-600">Conta</label>
                      <input
                        id={`conta-conta-${conta.id}`}
                        value={conta.conta}
                        onChange={e => setForm(f => {
                          const bancos = [...f.bancos]; bancos[idx] = { ...bancos[idx], conta: e.target.value }
                          return { ...f, bancos }
                        })}
                        className="w-full p-2 rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmarRemocao('esta conta bancária', 'A remoção só vale depois de clicar em Salvar.')) return
                        setForm(f => ({ ...f, bancos: f.bancos.filter((_, i) => i !== idx) }))
                      }}
                      className="btn btn-ghost text-sm"
                      style={{ color: 'var(--color-error-text)' }}
                      title="Remover conta"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <h4 className="font-semibold mb-3">Dados para Assinatura do Contrato</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-repNome" className="block text-sm text-gray-600">Nome do Representante Legal</label>
              <input id="emp-repNome" value={form.representanteNome} onChange={set('representanteNome')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label htmlFor="emp-repCargo" className="block text-sm text-gray-600">Cargo</label>
              <input id="emp-repCargo" value={form.representanteCargo} onChange={set('representanteCargo')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label htmlFor="emp-repCpf" className="block text-sm text-gray-600">CPF</label>
              <input id="emp-repCpf" value={form.representanteCpf} onChange={set('representanteCpf')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label htmlFor="emp-repRg" className="block text-sm text-gray-600">RG</label>
              <input id="emp-repRg" value={form.representanteRg} onChange={set('representanteRg')} className="w-full p-2 rounded" />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <h4 className="font-semibold mb-1">Modelo de Proposta</h4>
          <p id="emp-declaracoes-desc" className="text-sm text-gray-500 mb-3">Texto de declarações usado ao emitir a Proposta de Preços. Deixe em branco para usar o texto padrão, ou personalize (ex.: acrescentar cláusulas específicas do seu ramo).</p>
          <textarea
            aria-describedby="emp-declaracoes-desc"
            value={form.declaracoesProposta}
            onChange={e => setForm(f => ({ ...f, declaracoesProposta: e.target.value }))}
            className="w-full p-2 rounded"
            rows={5}
            placeholder={DECLARACAO_PROPOSTA_PADRAO}
          />
        </div>

        {erro && (
          <div role="alert" className="p-3 rounded text-sm" style={{ backgroundColor: 'var(--color-error-text)', color: '#fff' }}>
            {erro}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
          {savedAt && !salvando && <span className="text-sm text-green-600">Informações salvas.</span>}
        </div>
      </form>

      <DocumentosEmpresaSection />
    </div>
  )
}
