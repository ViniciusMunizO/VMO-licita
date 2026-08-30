import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth()
  // Enquanto a sessão do Supabase ainda está sendo restaurada (ex.: acabou
  // de dar F5), não redireciona pro login — senão todo refresh de página
  // manda quem já está logado de volta pra tela de login por um instante.
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}
