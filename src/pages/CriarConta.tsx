import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'
import { codigoCompleto, conferirConvite, criarContaComConvite, normalizarCodigo, type Conferencia } from '../utils/convites'

// Criar conta com código de convite (migração 0021). Quem tem o código cria o login aqui:
// convite de empresa nova -> cria a empresa e vira admin; convite de equipe -> entra na empresa.
// Depois de criar, já entra no sistema com o e-mail e a senha escolhidos.

const ALERTA = { backgroundColor: '#fef2f2', borderColor: 'var(--color-error)', color: '#b91c1c' }

export default function CriarConta() {
  const [params] = useSearchParams()
  const [codigo, setCodigo] = useState(() => normalizarCodigo(params.get('codigo') || ''))
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  const mudarCodigo = (texto: string) => {
    setCodigo(normalizarCodigo(texto))
    setConferencia(null)
    setErro('')
  }

  // Confere o código assim que ele estiver completo (sem gastar o convite).
  useEffect(() => {
    if (!codigoCompleto(codigo)) return
    let cancelado = false
    conferirConvite(codigo)
      .then(c => { if (!cancelado) setConferencia(c) })
      .catch(e => { if (!cancelado) setErro(e?.message || 'Não foi possível conferir o código.') })
    return () => { cancelado = true }
  }, [codigo])

  const conferindo = codigoCompleto(codigo) && conferencia === null && !erro
  const valido = conferencia?.valido === true ? conferencia : null

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!valido) { setErro('Confira o código de convite.'); return }
    if (senha !== senha2) { setErro('As duas senhas não são iguais.'); return }
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return }
    setEnviando(true)
    try {
      await criarContaComConvite({ codigo, nome, email, senha, empresa: valido.empresaNova ? empresa : undefined })
      await login(email.trim().toLowerCase(), senha)
      nav('/')
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível criar a conta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size="md" /></div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Criar conta</h1>
        <p className="text-sm text-gray-500 mb-6">Para criar a conta você precisa de um código de convite.</p>

        <form onSubmit={enviar} className="space-y-4" autoComplete="on">
          <div>
            <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">Código de convite</label>
            <input id="codigo" value={codigo} onChange={e => mudarCodigo(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-white font-mono tracking-wider uppercase" placeholder="ABCDE-FGH23"
              autoComplete="off" autoFocus={!codigo} maxLength={14} />
            <p className="text-sm mt-1" aria-live="polite">
              {conferindo && <span className="text-gray-500">Conferindo o código...</span>}
              {!conferindo && conferencia && !conferencia.valido && (
                <span style={{ color: '#b91c1c' }}>Código inválido, já usado ou vencido. Confira com quem te convidou.</span>
              )}
              {!conferindo && valido && (
                <span style={{ color: 'var(--color-success-text, #15803d)' }}>
                  ✓ {valido.empresaNova ? 'Convite para criar a sua empresa.' : `Convite para entrar na empresa ${valido.empresaNome || ''}.`}
                </span>
              )}
            </p>
          </div>

          {valido && (
            <>
              {valido.empresaNova && (
                <div>
                  <label htmlFor="empresa" className="block text-sm font-medium text-gray-700 mb-1">Nome da sua empresa</label>
                  <input id="empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} maxLength={120}
                    className="w-full p-2.5 rounded-lg bg-white" autoComplete="organization" required />
                </div>
              )}
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Seu nome</label>
                <input id="nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={120}
                  className="w-full p-2.5 rounded-lg bg-white" autoComplete="name" required />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white" autoComplete="username" placeholder="seu.email@empresa.com" required />
              </div>
              <div>
                <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">Senha (mínimo 8 caracteres)</label>
                <div className="relative">
                  <input id="senha" type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                    className="w-full p-2.5 pr-16 rounded-lg bg-white" autoComplete="new-password" minLength={8} maxLength={72} required />
                  <button type="button" onClick={() => setMostrarSenha(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                    {mostrarSenha ? 'ocultar' : 'mostrar'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="senha2" className="block text-sm font-medium text-gray-700 mb-1">Repita a senha</label>
                <input id="senha2" type={mostrarSenha ? 'text' : 'password'} value={senha2} onChange={e => setSenha2(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white" autoComplete="new-password" maxLength={72} required />
              </div>
            </>
          )}

          {erro && <div role="alert" className="text-sm px-3 py-2 rounded-lg border-l-4" style={ALERTA}>{erro}</div>}

          <button type="submit" disabled={!valido || enviando} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium disabled:opacity-60">
            {enviando ? 'Criando a conta...' : 'Criar conta e entrar'}
          </button>
          <p className="text-sm text-gray-500 text-center">
            Já tem conta? <Link to="/login" className="link-primary">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
