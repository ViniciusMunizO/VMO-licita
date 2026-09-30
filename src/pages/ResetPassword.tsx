import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

const SENHA_MIN_LENGTH = 6

export default function ResetPassword() {
  const { concluirRedefinicaoSenha, logout } = useAuth()
  const nav = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < SENHA_MIN_LENGTH) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MIN_LENGTH} caracteres.`)
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    setSalvando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setSucesso(true)
    } catch (err: any) {
      setErro(err?.message || 'Não consegui salvar a senha nova. Peça um novo link de redefinição.')
    } finally {
      setSalvando(false)
    }
  }

  // Só libera a tela normal depois do clique — sem isso, `passwordRecovery`
  // vira `false` mas o app continua em /redefinir-senha e essa mesma rota
  // renderiza o formulário de novo, como se nada tivesse acontecido.
  const continuar = () => {
    concluirRedefinicaoSenha()
    nav('/', { replace: true })
  }

  const cancelar = () => {
    logout()
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><Logo size="md" /></div>

        {sucesso ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Senha alterada</h1>
            <p className="text-sm text-gray-500 mb-8">Sua senha foi salva. Pode continuar pro sistema.</p>
            <button onClick={continuar} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium">
              Continuar
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Definir nova senha</h1>
            <p className="text-sm text-gray-500 mb-8">Escolha uma senha nova pra continuar.</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="senhaNova" className="block text-sm font-medium text-gray-700 mb-1">Senha nova</label>
                <input
                  id="senhaNova"
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoFocus
                  autoComplete="new-password"
                  className="w-full p-2.5 rounded-lg bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="senhaConfirma" className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha nova</label>
                <input
                  id="senhaConfirma"
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  autoComplete="new-password"
                  className="w-full p-2.5 rounded-lg bg-white"
                  placeholder="••••••••"
                />
              </div>

              {erro && (
                <div role="alert" className="text-sm px-3 py-2 rounded-lg border-l-4" style={{ backgroundColor: '#fef2f2', borderColor: 'var(--color-error)', color: '#b91c1c' }}>
                  {erro}
                </div>
              )}

              <button type="submit" disabled={salvando} className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium disabled:opacity-60">
                {salvando ? 'Salvando...' : 'Salvar senha nova'}
              </button>
              <button type="button" onClick={cancelar} className="btn btn-ghost w-full justify-center py-2.5 text-sm font-medium">
                Cancelar e voltar pro login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
