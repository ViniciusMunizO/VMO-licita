import React, { useEffect, useState } from 'react'
import { dbGet, dbSet } from '../utils/db'

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
  banco: string
  agencia: string
  conta: string
  representanteNome: string
  representanteCargo: string
  representanteCpf: string
  representanteRg: string
}

const empty: EmpresaInfo = {
  razaoSocial: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '',
  endereco: '', cep: '', cidade: '', uf: '', telefone: '', email: '',
  banco: '', agencia: '', conta: '',
  representanteNome: '', representanteCargo: '', representanteCpf: '', representanteRg: ''
}

const STORE_KEY = 'empresa_info'

export default function CompanyInfo() {
  const [form, setForm] = useState<EmpresaInfo>(empty)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    dbGet(STORE_KEY).then((raw) => {
      if (!mounted) return
      setForm({ ...empty, ...(raw || {}) })
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const set = (k: keyof EmpresaInfo) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    await dbSet(STORE_KEY, form)
    setSavedAt(Date.now())
  }

  if (loading) return <div className="text-sm text-gray-500">Carregando...</div>

  return (
    <div className="bg-white p-6 rounded shadow max-w-3xl mx-auto">
      <h3 className="text-xl font-semibold mb-1">Informações da Empresa</h3>
      <p className="text-sm text-gray-500 mb-4">Esses dados são usados automaticamente nos documentos emitidos pelo sistema.</p>

      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Razão Social</label>
          <input value={form.razaoSocial} onChange={set('razaoSocial')} className="w-full p-2 rounded" />
        </div>

        <div className="grid grid-cols-3 gap-4">
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

        <div className="grid grid-cols-3 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
          <h4 className="font-semibold mb-3">Dados Bancários</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Banco</label>
              <input value={form.banco} onChange={set('banco')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Agência</label>
              <input value={form.agencia} onChange={set('agencia')} className="w-full p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Conta</label>
              <input value={form.conta} onChange={set('conta')} className="w-full p-2 rounded" />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border rounded p-4">
          <h4 className="font-semibold mb-3">Dados para Assinatura do Contrato</h4>
          <div className="grid grid-cols-2 gap-4">
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

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" type="submit">Salvar</button>
          {savedAt && <span className="text-sm text-green-600">Informações salvas.</span>}
        </div>
      </form>
    </div>
  )
}
