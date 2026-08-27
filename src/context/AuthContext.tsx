import React, { createContext, useContext, useState, ReactNode } from 'react'
import { findUserByCredentials } from '../utils/auth'

type User = {
  id: number
  name: string
  login: string
  role: 'admin' | 'moderador' | 'user'
}

type AuthContextValue = {
  user: User | null
  login: (login: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) as User : null
  })

  const login = async (loginInput: string, password: string) => {
    const found = await findUserByCredentials(loginInput.trim(), password)
    if (!found) throw new Error('Login ou senha inválidos')
    const u: User = { id: found.id, name: found.name, login: found.login, role: found.role }
    localStorage.setItem('user_name', u.name)
    localStorage.setItem('auth_user', JSON.stringify(u))
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('auth_user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
