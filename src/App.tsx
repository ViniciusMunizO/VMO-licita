import React from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { ProtectedRoute } from './components/ProtectedRoute'
import ListLicitacoes from './pages/Licitacoes/List'
import FormLicitacao from './pages/Licitacoes/Form'
import DetailLicitacao from './pages/Licitacoes/Detail'
import Users from './pages/Users'
import CompanyInfo from './pages/CompanyInfo'
import AdminAudit from './pages/AdminAudit'
import { AdminRoute } from './components/AdminRoute'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <nav className="bg-white shadow p-4">
        <div className="container-fixed flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="brand text-lg">Botti Licita</Link>
            <Link to="/licitacoes" className="nav-link text-sm">Licitações</Link>
            <Link to="/empresa" className="nav-link text-sm">Informações da Empresa</Link>
            {(user?.role === 'admin' || user?.role === 'moderador') && <Link to="/users" className="nav-link text-sm">Usuários</Link>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button onClick={() => { logout(); nav('/login') }} className="btn btn-ghost">Sair</button>
          </div>
        </div>
      </nav>
      <main className="container-fixed p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/licitacoes" element={<ProtectedRoute><ListLicitacoes /></ProtectedRoute>} />
          <Route path="/licitacoes/novo" element={<ProtectedRoute><FormLicitacao /></ProtectedRoute>} />
          <Route path="/licitacoes/:codigo" element={<ProtectedRoute><DetailLicitacao /></ProtectedRoute>} />
          <Route path="/empresa" element={<ProtectedRoute><CompanyInfo /></ProtectedRoute>} />
          <Route path="/users" element={<AdminRoute roles={['admin', 'moderador']}><Users /></AdminRoute>} />
          <Route path="/admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
        </Routes>
      </main>
    </div>
  )
}
