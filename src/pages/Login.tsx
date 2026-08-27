import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [loginValue, setLoginValue] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const nav = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(loginValue, password)
      nav('/')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm">Login</label>
          <input value={loginValue} onChange={e => setLoginValue(e.target.value)} className="w-full p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm">Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 rounded" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn btn-primary">Entrar</button>
      </form>
    </div>
  )
}
