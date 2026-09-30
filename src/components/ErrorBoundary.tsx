import React from 'react'
import Logo from './Logo'

type Props = { children: React.ReactNode }
type State = { error: Error | null }

// Sem isto, um erro de render em qualquer tela (ex.: um campo inesperado
// vindo do banco) derrubava o React inteiro pra uma página em branco, sem
// nenhuma explicação nem jeito de sair de lá a não ser fechar a aba.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 text-gray-800 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <div className="flex justify-center mb-6"><Logo size="md" /></div>
          <h2 className="text-lg font-semibold mb-2">Ocorreu um erro inesperado</h2>
          <p className="text-sm text-gray-500 mb-6">
            A tela travou por um motivo inesperado. Recarregar a página costuma resolver — se continuar acontecendo, avise quem administra o sistema.
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">Recarregar página</button>
        </div>
      </div>
    )
  }
}
