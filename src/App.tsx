import React from 'react'
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { ProtectedRoute } from './components/ProtectedRoute'
import ListLicitacoes from './pages/Licitacoes/List'
import FormLicitacao from './pages/Licitacoes/Form'
import DetailLicitacao from './pages/Licitacoes/Detail'
import RelatoriosIndex from './pages/Relatorios/Index'
import Users from './pages/Users'
import CompanyInfo from './pages/CompanyInfo'
import AdminAudit from './pages/AdminAudit'
import { AdminRoute } from './components/AdminRoute'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { IconLicitacoes, IconRelatorios, IconEmpresa, IconUsuarios } from './components/NavIcons'

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
      style={({ isActive }) => (isActive ? { backgroundColor: 'var(--color-primary)' } : undefined)}
    >
      {icon}
      {children}
    </NavLink>
  )
}

function iniciais(nome?: string) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase()
}

export default function App() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  if (user && !user.ativo) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <Logo size="md" />
          <h2 className="text-lg font-semibold mt-6 mb-2">Conta aguardando ativação</h2>
          <p className="text-sm text-gray-500 mb-6">
            Seu login foi criado, mas ainda não foi liberado pelo administrador do sistema. Fale com quem administra sua conta pra ativar o acesso.
          </p>
          <button onClick={() => { logout(); nav('/login') }} className="btn btn-ghost">Sair</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {user && (
        <nav className="bg-white shadow-sm sticky top-0 z-10">
          <div
            className="h-[3px] w-full"
            style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-accent))' }}
          />
          <div className="container-fixed flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center">
                <Logo size="md" />
              </Link>
              <div className="flex items-center gap-1">
                <NavItem to="/licitacoes" icon={<IconLicitacoes />}>Licitações</NavItem>
                <NavItem to="/relatorios" icon={<IconRelatorios />}>Relatórios</NavItem>
                <NavItem to="/empresa" icon={<IconEmpresa />}>Informações da Empresa</NavItem>
                {(user?.role === 'admin' || user?.role === 'moderador') && (
                  <NavItem to="/users" icon={<IconUsuarios />}>Usuários</NavItem>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {iniciais(user?.name)}
                </div>
                <span className="text-sm text-gray-600 hidden sm:inline">{user?.name}</span>
              </div>
              <button onClick={() => { logout(); nav('/login') }} className="btn btn-ghost">Sair</button>
            </div>
          </div>
        </nav>
      )}
      <main className={user ? 'container-fixed p-6' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/licitacoes" element={<ProtectedRoute><ListLicitacoes /></ProtectedRoute>} />
          <Route path="/licitacoes/novo" element={<ProtectedRoute><FormLicitacao /></ProtectedRoute>} />
          <Route path="/licitacoes/:codigo" element={<ProtectedRoute><DetailLicitacao /></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute><RelatoriosIndex /></ProtectedRoute>} />
          <Route path="/empresa" element={<ProtectedRoute><CompanyInfo /></ProtectedRoute>} />
          <Route path="/users" element={<AdminRoute roles={['admin', 'moderador']}><Users /></AdminRoute>} />
          <Route path="/admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
        </Routes>
      </main>
    </div>
  )
}
