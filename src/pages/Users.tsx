import React, { useState, useEffect } from 'react'
import { getUsers, addUser, StoredUser } from '../utils/auth'

const ROLE_LABELS: Record<StoredUser['role'], string> = {
  admin: 'Administrador',
  moderador: 'Moderador',
  user: 'Usuário',
}

export default function Users() {
  const [users, setUsers] = useState<StoredUser[]>([])
  const [name, setName] = useState('')
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StoredUser['role']>('user')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getUsers().then(u => { if (mounted) setUsers(u) })
    return () => { mounted = false }
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const result = await addUser({ name, login: loginValue, password, role })
    if (!result.ok) {
      setError('Já existe um usuário com esse login.')
      return
    }
    setUsers(result.users)
    setName('')
    setLoginValue('')
    setPassword('')
    setRole('user')
  }

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Gerenciar Usuários</h3>
      <div className="bg-white p-4 rounded shadow mb-4">
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Login</label>
            <input value={loginValue} onChange={e => setLoginValue(e.target.value)} className="w-full p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 rounded" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Perfil</label>
            <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full p-2 rounded">
              <option value="user">Usuário</option>
              <option value="moderador">Moderador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button className="btn btn-primary" type="submit">Criar</button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500">
              <th className="p-2">ID</th>
              <th className="p-2">Nome</th>
              <th className="p-2">Login</th>
              <th className="p-2">Perfil</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.id}</td>
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.login}</td>
                <td className="p-2">{ROLE_LABELS[u.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
