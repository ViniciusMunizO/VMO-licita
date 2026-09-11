import React, { useEffect, useState } from 'react'
import { listProfiles, Profile } from '../utils/auth'

const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Administrador',
  moderador: 'Moderador',
  user: 'Usuário',
}

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    listProfiles().then(u => { if (mounted) { setUsers(u); setLoading(false) } })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Usuários</h3>

      <div className="text-sm px-3 py-2 rounded-lg border-l-4 bg-cyan-50 mb-4" style={{ borderColor: 'var(--color-primary)' }}>
        Criação de novo usuário é feita direto no painel do Supabase (Authentication → Add user). Depois de criado, o papel dele (Administrador/Moderador/Usuário) pode ser ajustado na tabela <code>profiles</code> — e ele só enxerga o sistema depois que alguém marcar <code>ativo = true</code> na linha dele nessa mesma tabela.
      </div>

      <div className="bg-white p-4 rounded shadow">
        {loading ? (
          <div className="text-sm text-gray-500">Carregando...</div>
        ) : (
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
