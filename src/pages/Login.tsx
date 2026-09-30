import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabaseClient'
import Logo from '../components/Logo'

const DESTAQUES = [
  { titulo: 'Licitações', texto: 'Cadastro, itens e situação de cada processo num só lugar.' },
  { titulo: 'Propostas', texto: 'Emissão de proposta em PDF a partir do modelo da sua empresa.' },
  { titulo: 'Relatórios', texto: 'Ganhos, perdidos e desclassificados, com totais por período.' },
]

const EMAIL_LEMBRADO_KEY = 'login_email_lembrado'

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_LEMBRADO_KEY) || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [lembrar, setLembrar] = useState(() => !!localStorage.getItem(EMAIL_LEMBRADO_KEY))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modoRecuperar, setModoRecuperar] = useState(false)
  const [recuperarEmail, setRecuperarEmail] = useState('')
  const [recuperarEnviado, setRecuperarEnviado] = useState(false)
  const [recuperarErro, setRecuperarErro] = useState('')
  const [recuperarEnviando, setRecuperarEnviando] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  const enviarRecuperacao = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecuperarErro('')
    setRecuperarEnviando(true)
    try {
      // BASE_URL entra aqui porque o app pode ser servido num subcaminho
      // (ver vite.config.ts) — sem isso, o link do e-mail cairia fora da
      // rota da SPA nesse tipo de deploy.
      const { error: err } = await supabase.auth.resetPasswordForEmail(recuperarEmail, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}redefinir-senha`,
      })
      if (err) throw err
      setRecuperarEnviado(true)
    } catch {
      // Mensagem genérica de propósito: não confirmar/negar se o e-mail
      // existe evita que alguém use este formulário pra descobrir quem tem
      // conta no sistema.
      setRecuperarErro('Não consegui enviar o e-mail agora. Tente de novo em alguns minutos.')
    } finally {
      setRecuperarEnviando(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // Só guarda o e-mail (nunca a senha) — a senha em si já fica salva de
      // forma segura pelo próprio gerenciador de senhas do navegador, graças
      // ao autoComplete="current-password" no campo abaixo.
      if (lembrar) localStorage.setItem(EMAIL_LEMBRADO_KEY, email)
      else localStorage.removeItem(EMAIL_LEMBRADO_KEY)
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

        <div className="relative text-xs text-white/50">© {new Date().getFullYear()} Licita-VMO</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex justify-center mb-8">
            <Logo size="md" />
          </div>

          {modoRecuperar ? (
            recuperarEnviado ? (
              <>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">Verifique seu e-mail</h1>
                <p className="text-sm text-gray-500 mb-8">
                  Se <strong>{recuperarEmail}</strong> tiver uma conta no sistema, um link pra redefinir a senha foi enviado pra essa caixa de entrada.
                </p>
                <button
                  type="button"
                  onClick={() => { setModoRecuperar(false); setRecuperarEnviado(false) }}
                  className="btn btn-ghost w-full justify-center py-2.5 text-sm font-medium"
                >
                  Voltar pro login
                </button>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">Esqueci minha senha</h1>
                <p className="text-sm text-gray-500 mb-8">Informe seu e-mail — se tiver conta, mandamos um link pra você definir uma senha nova.</p>
                <form onSubmit={enviarRecuperacao} className="space-y-4">
                  <div>
                    <label htmlFor="emailRecuperar" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      id="emailRecuperar"
                      type="email"
                      value={recuperarEmail}
                      onChange={e => setRecuperarEmail(e.target.value)}
                      autoFocus
                      autoComplete="username"
                      className="w-full p-2.5 rounded-lg bg-white"
                      placeholder="seu.email@empresa.com"
                    />
                  </div>
                  {recuperarErro && (
                    <div role="alert" className="text-sm px-3 py-2 rounded-lg border-l-4" style={{ backgroundColor: '#fef2f2', borderColor: 'var(--color-error)', color: '#b91c1c' }}>
                      {recuperarErro}
                    </div>
                  )}
                  <button type="submit" disabled={recuperarEnviando} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium disabled:opacity-60">
                    {recuperarEnviando ? 'Enviando...' : 'Enviar link de redefinição'}
                  </button>
                  <button type="button" onClick={() => setModoRecuperar(false)} className="btn btn-ghost w-full justify-center py-2.5 text-sm font-medium">
                    Voltar pro login
                  </button>
                </form>
              </>
            )
          ) : (
          <>
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={e => setLembrar(e.target.checked)}
                />
                Lembrar meu e-mail
              </label>
              <button
                type="button"
                onClick={() => { setModoRecuperar(true); setRecuperarEmail(email) }}
                className="text-sm link-primary"
              >
                Esqueci minha senha
              </button>
            </div>

            {error && (
              <div role="alert" className="text-sm px-3 py-2 rounded-lg border-l-4" style={{ backgroundColor: '#fef2f2', borderColor: 'var(--color-error)', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium disabled:opacity-60">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
