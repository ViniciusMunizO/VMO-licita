import React, { useEffect, useState } from 'react'
import { listProfiles, Profile } from '../utils/auth'
import { gerarConviteEquipe, linkDoConvite } from '../utils/convites'

// Convidar alguém da equipe: o admin gera um código (vale uma vez e por 7 dias) e manda o link.
// A pessoa abre o link, cria a conta e já entra na empresa. Limite: 4 pessoas ativas.
function ConvidarPessoa() {
  const [papel, setPapel] = useState<'membro' | 'admin'>('membro')
  const [codigo, setCodigo] = useState('')
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  const gerar = async () => {
    setErro('')
    setCopiado(false)
    setGerando(true)
    try {
      setCodigo(await gerarConviteEquipe(papel))
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível gerar o convite.')
    } finally {
      setGerando(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkDoConvite(codigo))
      setCopiado(true)
    } catch {
      setErro('Não consegui copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <section className="bg-white p-4 rounded shadow mb-4 grid gap-3 text-sm" aria-label="Convidar pessoa">
      <div>
        <h4 className="font-semibold text-base">Convidar pessoa</h4>
        <p className="text-gray-600">Gere um código e mande o link para a pessoa. Ela cria a conta e já entra na empresa. O código vale uma vez e por 7 dias. A empresa pode ter até 4 pessoas ativas.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="convite-papel" className="text-gray-600">Entra como</label>
        <select id="convite-papel" value={papel} onChange={e => setPapel(e.target.value as 'membro' | 'admin')} className="p-2 rounded">
          <option value="membro">Usuário</option>
          <option value="admin">Administrador</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={gerar} disabled={gerando}>
          {gerando ? 'Gerando...' : 'Gerar código'}
        </button>
      </div>
      {codigo && (
        <div className="rounded p-3 grid gap-1" style={{ background: 'var(--color-bg-subtle, #f3f4f6)' }}>
          <p>Código: <b className="font-mono text-lg select-all">{codigo}</b></p>
          <p className="break-all select-all text-gray-700">{linkDoConvite(codigo)}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn btn-ghost" onClick={copiar}>Copiar link</button>
            {copiado && <span role="status" className="text-gray-600">Link copiado.</span>}
          </div>
          <p className="text-gray-600">Anote ou mande agora: o código não aparece de novo depois que você sair desta página.</p>
        </div>
      )}
      {erro && <p role="alert" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
    </section>
  )
}

const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Administrador',
  moderador: 'Moderador',
  user: 'Usuário',
}

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true
    listProfiles().then(u => {
      if (!mounted) return
      setUsers(u)
      setLoading(false)
    }).catch(err => {
      if (!mounted) return
      setErro(err?.message || 'Não foi possível carregar a lista de usuários.')
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Usuários</h3>

      <ConvidarPessoa />

      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
      <div className="bg-white p-4 rounded shadow">
        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : erro ? null : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="p-2">Nome</th>
                <th className="p-2">Perfil</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{ROLE_LABELS[u.role]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
