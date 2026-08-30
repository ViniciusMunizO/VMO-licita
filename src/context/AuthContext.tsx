import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../utils/supabaseClient'
import { getProfile } from '../utils/auth'

type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'moderador' | 'user'
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaura a sessão ao carregar a página (o Supabase já persiste o token
  // sozinho) e escuta troca/expiração de sessão em outras abas.
  useEffect(() => {
    let mounted = true

    const carregarDeSessao = async (session: any) => {
      if (!session?.user) {
        if (mounted) setUser(null)
        return
      }
      const profile = await getProfile(session.user.id, session.user.email || '')
      if (!mounted) return
      const u: User = { id: session.user.id, name: profile.name, email: session.user.email || '', role: profile.role }
      localStorage.setItem('user_name', u.name)
      setUser(u)
    }

    supabase.auth.getSession().then(({ data }) => {
      carregarDeSessao(data.session).finally(() => { if (mounted) setLoading(false) })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      carregarDeSessao(session)
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new Error('Login ou senha inválidos')
    const profile = await getProfile(data.user.id, data.user.email || '')
    const u: User = { id: data.user.id, name: profile.name, email: data.user.email || '', role: profile.role }
    localStorage.setItem('user_name', u.name)
    setUser(u)
  }

  const logout = () => {
    supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
