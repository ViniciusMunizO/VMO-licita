import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

const DESTAQUES = [
  { titulo: 'Licitações', texto: 'Cadastro, itens e situação de cada processo num só lugar.' },
  { titulo: 'Propostas', texto: 'Emissão de proposta em PDF a partir do modelo da sua empresa.' },
  { titulo: 'Relatórios', texto: 'Ganhos, perdidos e desclassificados, com totais por período.' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      nav('/')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 text-white relative overflow-hidden" style={{ background: 'linear-gradient(155deg, var(--color-primary), var(--color-secondary))' }}>
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }}
        />
        <div className="relative">
          <Logo variant="inverted" size="lg" />
        </div>

        <div className="relative">
          <h1 className="text-3xl font-semibold leading-snug mb-3 text-balance text-white">
            Do cadastro à proposta, sem perder o controle.
          </h1>
          <p className="text-white/75 mb-10 max-w-sm">
            Sistema de gestão de licitações públicas — moldado pra como sua empresa realmente opera.
          </p>

          <div className="space-y-5">
            {DESTAQUES.map(d => (
              <div key={d.titulo} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-white/70 mt-2 flex-shrink-0" />
                <div>
                  <div className="font-medium">{d.titulo}</div>
                  <div className="text-sm text-white/70">{d.texto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/50">© {new Date().getFullYear()} Botti Licita</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex justify-center mb-8">
            <Logo size="md" />
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Entrar</h1>
          <p className="text-sm text-gray-500 mb-8">Use seu e-mail e senha pra acessar o sistema.</p>

          <form onSubmit={submit} className="space-y-4" autoComplete="on">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full p-2.5 rounded-lg bg-white"
                placeholder="seu.email@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full p-2.5 pr-16 rounded-lg bg-white"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  {showPassword ? 'ocultar' : 'mostrar'}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg border-l-4" style={{ backgroundColor: '#fef2f2', borderColor: 'var(--color-error)', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium disabled:opacity-60">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
