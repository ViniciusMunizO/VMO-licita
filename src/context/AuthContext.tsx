import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../utils/supabaseClient'
import { getProfile, EmpresaDoUsuario } from '../utils/auth'
import { definirEmpresaAtual } from '../utils/banco'

type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'moderador' | 'user'
  ativo: boolean
  // Empresa aberta agora e todas as da pessoa (quem é de duas troca no topo).
  empresaId: string | null
  empresaNome: string | null
  empresas: EmpresaDoUsuario[]
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  trocarEmpresa: (empresaId: string) => void
  // true a partir do momento em que o link de "esqueci minha senha" é aberto
  // (o Supabase autentica a sessão nesse instante) até a senha nova ser
  // definida — usado pelo App pra travar a tela em "Definir nova senha" em
  // vez de deixar entrar direto no sistema com esse login temporário.
  passwordRecovery: boolean
  concluirRedefinicaoSenha: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function montarUsuario(id: string, email: string): Promise<User> {
  const { profile, empresas, empresa } = await getProfile(id, email)
  return {
    id,
    name: profile.name,
    email,
    role: profile.role,
    ativo: profile.ativo,
    empresaId: empresa?.id || null,
    empresaNome: empresa?.nome || null,
    empresas,
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  // Restaura a sessão ao carregar a página (o Supabase já persiste o token
  // sozinho) e escuta troca/expiração de sessão em outras abas.
  useEffect(() => {
    let mounted = true

    const carregarDeSessao = async (session: any) => {
      if (!session?.user) {
        if (mounted) setUser(null)
        return
      }
      const u = await montarUsuario(session.user.id, session.user.email || '')
      if (!mounted) return
      localStorage.setItem('user_name', u.name)
      setUser(u)
    }

    supabase.auth.getSession().then(({ data }) => {
      carregarDeSessao(data.session).finally(() => { if (mounted) setLoading(false) })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // O Supabase autentica a sessão assim que o link do e-mail é aberto —
      // sem essa marca, quem clica no link entraria direto no sistema com
      // esse login temporário em vez de ser obrigado a definir a senha nova.
      // A tela de redefinição não usa `user`, então não vale a pena buscar o
      // perfil agora — o próximo evento (depois da senha trocada) já cuida disso.
      if (event === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); return }
      carregarDeSessao(session)
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    // E-mail não confirmado não é senha errada: dizer isso poupa a pessoa de trocar a senha à toa.
    if (error?.code === 'email_not_confirmed') throw new Error('Este e-mail ainda não foi confirmado. Confirme pelo link enviado ou peça ao administrador.')
    if (error || !data.user) throw new Error('Login ou senha inválidos')
    const u = await montarUsuario(data.user.id, data.user.email || '')
    localStorage.setItem('user_name', u.name)
    setUser(u)
  }

  const logout = () => {
    supabase.auth.signOut()
    definirEmpresaAtual(null)
    setUser(null)
    setPasswordRecovery(false)
  }

  // Recarrega a página inteira de propósito: cada tela guarda listas da
  // empresa anterior no próprio estado, e começar do zero é o jeito mais
  // simples de garantir que nada da outra empresa fica aparecendo.
  const trocarEmpresa = (empresaId: string) => {
    definirEmpresaAtual(empresaId)
    window.location.assign('/')
  }

  const concluirRedefinicaoSenha = () => setPasswordRecovery(false)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, trocarEmpresa, passwordRecovery, concluirRedefinicaoSenha }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
