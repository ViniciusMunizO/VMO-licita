import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { IconLicitacoes, IconRelatorios, IconEmpresa, IconUsuarios, IconMenu, IconFechar } from './components/NavIcons'

// Cada página vira um chunk próprio, baixado só quando a rota é visitada —
// sem isso, jsPDF/html2canvas/xlsx (usados só em algumas telas) entravam
// todos no bundle inicial, que passava de 1,5 MB antes disso.
const Login = lazy(() => import('./pages/Login'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ListLicitacoes = lazy(() => import('./pages/Licitacoes/List'))
const FormLicitacao = lazy(() => import('./pages/Licitacoes/Form'))
const DetailLicitacao = lazy(() => import('./pages/Licitacoes/Detail'))
const RelatoriosIndex = lazy(() => import('./pages/Relatorios/Index'))
const Users = lazy(() => import('./pages/Users'))
const CompanyInfo = lazy(() => import('./pages/CompanyInfo'))
const AdminAudit = lazy(() => import('./pages/AdminAudit'))

function NavItem({ to, icon, children, onClick }: { to: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
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
  const { user, logout, passwordRecovery } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  // Abaixo de `lg` os itens viram gaveta. O corte é em `lg` e não em `md`
  // porque "Informações da Empresa" é um rótulo longo: com os quatro itens,
  // a logo e o nome do usuário, a barra só cabe inteira a partir de ~1024px.
  const [menuAberto, setMenuAberto] = useState(false)

  // Navegou: fecha a gaveta. Sem isto ela fica aberta por cima da tela nova.
  useEffect(() => { setMenuAberto(false) }, [location.pathname])

  const sair = () => { setMenuAberto(false); logout(); nav('/login') }

  // Trava em "definir senha nova" independente da rota — o link do e-mail já
  // autentica a sessão, então sem isto quem clicasse no link entraria direto
  // no sistema com esse login temporário em vez de trocar a senha primeiro.
  if (passwordRecovery) return <ResetPassword />

  if (user && !user.ativo) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <Logo size="md" />
          <h2 className="text-lg font-semibold mt-6 mb-2">Conta aguardando ativação</h2>
          <p className="text-sm text-gray-500 mb-6">
            Seu login foi criado, mas ainda não foi liberado pelo administrador do sistema. Fale com quem administra sua conta pra ativar o acesso.
          </p>
          <button onClick={sair} className="btn btn-ghost">Sair</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {user && (
        <nav className="bg-white shadow-sm sticky top-0 z-20">
          <div
            className="h-[3px] w-full"
            style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent), var(--color-accent-claro))' }}
          />
          <div className="container-fixed flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-8 min-w-0">
              <Link to="/" className="flex items-center flex-shrink-0">
                <Logo size="md" />
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                <NavItem to="/licitacoes" icon={<IconLicitacoes />}>Licitações</NavItem>
                <NavItem to="/relatorios" icon={<IconRelatorios />}>Relatórios</NavItem>
                {user?.role === 'admin' && (
                  <NavItem to="/empresa" icon={<IconEmpresa />}>Informações da Empresa</NavItem>
                )}
                {(user?.role === 'admin' || user?.role === 'moderador') && (
                  <NavItem to="/users" icon={<IconUsuarios />}>Usuários</NavItem>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {iniciais(user?.name)}
                </div>
                {/* O nome é a primeira coisa a sair quando falta espaço: a
                    inicial no avatar já identifica quem está logado. */}
                <span className="text-sm text-gray-600 hidden xl:inline truncate">{user?.name}</span>
              </div>
              <button onClick={sair} className="btn btn-ghost hidden lg:inline-flex">Sair</button>
              <button
                type="button"
                onClick={() => setMenuAberto(a => !a)}
                className="lg:hidden p-2 -mr-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={menuAberto}
              >
                {menuAberto ? <IconFechar /> : <IconMenu />}
              </button>
            </div>
          </div>

          {menuAberto && (
            <div className="lg:hidden border-t border-gray-100">
              <div className="container-fixed py-2 flex flex-col gap-0.5">
                <NavItem to="/licitacoes" icon={<IconLicitacoes />} onClick={() => setMenuAberto(false)}>Licitações</NavItem>
                <NavItem to="/relatorios" icon={<IconRelatorios />} onClick={() => setMenuAberto(false)}>Relatórios</NavItem>
                {user?.role === 'admin' && (
                  <NavItem to="/empresa" icon={<IconEmpresa />} onClick={() => setMenuAberto(false)}>Informações da Empresa</NavItem>
                )}
                {(user?.role === 'admin' || user?.role === 'moderador') && (
                  <NavItem to="/users" icon={<IconUsuarios />} onClick={() => setMenuAberto(false)}>Usuários</NavItem>
                )}
                <div className="border-t border-gray-100 mt-2 pt-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 truncate px-3">{user?.name}</span>
                  <button onClick={sair} className="btn btn-ghost flex-shrink-0">Sair</button>
                </div>
              </div>
            </div>
          )}
        </nav>
      )}
      <main className={user ? 'container-fixed py-4 sm:py-6' : ''}>
        <Suspense fallback={<div className="text-sm text-gray-500 p-6">Carregando...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/licitacoes" element={<ProtectedRoute><ListLicitacoes /></ProtectedRoute>} />
            <Route path="/licitacoes/novo" element={<ProtectedRoute><FormLicitacao /></ProtectedRoute>} />
            <Route path="/licitacoes/:codigo" element={<ProtectedRoute><DetailLicitacao /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><RelatoriosIndex /></ProtectedRoute>} />
            <Route path="/empresa" element={<AdminRoute><CompanyInfo /></AdminRoute>} />
            <Route path="/users" element={<AdminRoute roles={['admin', 'moderador']}><Users /></AdminRoute>} />
            <Route path="/admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
