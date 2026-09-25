import React, { useEffect, useState } from 'react'
import { getEmpresaInfo, saveEmpresaInfo } from '../utils/empresa'
import { DECLARACAO_PROPOSTA_PADRAO } from '../utils/proposta'
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

export default function CompanyInfo() {
  const [form, setForm] = useState<EmpresaInfo>(empty)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)

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
    await saveEmpresaInfo(form)
    setSavedAt(Date.now())
  }

  if (loading) return <div className="text-sm text-gray-500">Carregando...</div>

  return (
    <div className="bg-white p-4 sm:p-6 rounded shadow max-w-5xl mx-auto">
      <h3 className="text-xl font-semibold mb-1">Informações da Empresa</h3>
      <p className="text-sm text-gray-500 mb-4">Esses dados são usados automaticamente nos documentos emitidos pelo sistema.</p>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Razão Social</label>
          <input value={form.razaoSocial} onChange={set('razaoSocial')} className="w-full p-2 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600">CNPJ</label>
            <input value={form.cnpj} onChange={set('cnpj')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Inscrição Estadual</label>
            <input value={form.inscricaoEstadual} onChange={set('inscricaoEstadual')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Inscrição Municipal</label>
            <input value={form.inscricaoMunicipal} onChange={set('inscricaoMunicipal')} className="w-full p-2 rounded" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Endereço</label>
          <input value={form.endereco} onChange={set('endereco')} className="w-full p-2 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600">CEP</label>
            <input value={form.cep} onChange={set('cep')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Cidade</label>
            <input value={form.cidade} onChange={set('cidade')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">UF</label>
            <input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} maxLength={2} className="w-full p-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Telefone</label>
            <input value={form.telefone} onChange={set('telefone')} className="w-full p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">E-mail</label>
            <input type="email" value={form.email} onChange={set('email')} className="w-full p-2 rounded" />
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
                    <label className="block text-sm text-gray-600">Apelido</label>
                    <input
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
                    <label className="block text-sm text-gray-600">Banco</label>
                    <input
                      value={conta.banco}
                      onChange={e => setForm(f => {
                        const bancos = [...f.bancos]; bancos[idx] = { ...bancos[idx], banco: e.target.value }
                        return { ...f, bancos }
                      })}
                      className="w-full p-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Agência</label>
                    <input
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
                      <label className="block text-sm text-gray-600">Conta</label>
                      <input
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
                      onClick={() => setForm(f => ({ ...f, bancos: f.bancos.filter((_, i) => i !== idx) }))}
                      className="btn btn-ghost text-sm"
                      style={{ color: 'var(--color-error)' }}
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
              <label className="block text-sm text-gray-600">Nome do Representante Legal</label>
              <input value={form.representanteNome} onChange={set('representanteNome')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Cargo</label>
              <input value={form.representanteCargo} onChange={set('representanteCargo')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">CPF</label>
              <input value={form.representanteCpf} onChange={set('representanteCpf')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">RG</label>
              <input value={form.representanteRg} onChange={set('representanteRg')} className="w-full p-2 rounded" />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <h4 className="font-semibold mb-1">Modelo de Proposta</h4>
          <p className="text-sm text-gray-500 mb-3">Texto de declarações usado ao emitir a Proposta de Preços. Deixe em branco para usar o texto padrão, ou personalize (ex.: acrescentar cláusulas específicas do seu ramo).</p>
          <textarea
            value={form.declaracoesProposta}
            onChange={e => setForm(f => ({ ...f, declaracoesProposta: e.target.value }))}
            className="w-full p-2 rounded"
            rows={5}
            placeholder={DECLARACAO_PROPOSTA_PADRAO}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" type="submit">Salvar</button>
          {savedAt && <span className="text-sm text-green-600">Informações salvas.</span>}
        </div>
      </form>

      <DocumentosEmpresaSection />
    </div>
  )
}
