import React, { useEffect, useState } from 'react'
import { codigoCompleto, conferirConviteLogado, normalizarCodigo, usarMeuConvite, type Conferencia } from '../utils/convites'

// Quem já tem login e está sem empresa entra (ou cria a empresa) com um código de convite.
// Ao terminar, recarrega a página para o login abrir a empresa nova.

export default function UsarConvite() {
  const [codigo, setCodigo] = useState('')
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const mudarCodigo = (texto: string) => {
    setCodigo(normalizarCodigo(texto))
    setConferencia(null)
    setErro('')
  }

  useEffect(() => {
    if (!codigoCompleto(codigo)) return
    let cancelado = false
    conferirConviteLogado(codigo)
      .then(c => { if (!cancelado) setConferencia(c) })
      .catch(e => { if (!cancelado) setErro(e?.message || 'Não foi possível conferir o código.') })
    return () => { cancelado = true }
  }, [codigo])

  const valido = conferencia?.valido === true ? conferencia : null

  const usar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valido) return
    setErro('')
    setEnviando(true)
    try {
      await usarMeuConvite(codigo, valido.empresaNova ? empresa : undefined)
      window.location.reload()
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível usar o convite.')
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={usar} className="grid gap-2 text-left mb-6" aria-label="Usar código de convite">
      <label htmlFor="convite-codigo" className="text-sm font-medium text-gray-700">Tem um código de convite?</label>
      <input id="convite-codigo" value={codigo} onChange={e => mudarCodigo(e.target.value)}
        className="w-full p-2.5 rounded-lg bg-white font-mono tracking-wider uppercase border border-gray-200"
        placeholder="ABCDE-FGH23" autoComplete="off" maxLength={14} />
      <p className="text-sm" aria-live="polite">
        {conferencia && !conferencia.valido && <span style={{ color: '#b91c1c' }}>Código inválido, já usado ou vencido.</span>}
        {valido && (
          <span style={{ color: 'var(--color-success-text, #15803d)' }}>
            ✓ {valido.empresaNova ? 'Convite para criar a sua empresa.' : `Convite para entrar na empresa ${valido.empresaNome || ''}.`}
          </span>
        )}
      </p>
      {valido?.empresaNova && (
        <>
          <label htmlFor="convite-empresa" className="text-sm font-medium text-gray-700">Nome da sua empresa</label>
          <input id="convite-empresa" value={empresa} onChange={e => setEmpresa(e.target.value)} maxLength={120}
            className="w-full p-2.5 rounded-lg bg-white border border-gray-200" autoComplete="organization" required />
        </>
      )}
      {erro && <p role="alert" className="text-sm" style={{ color: '#b91c1c' }}>{erro}</p>}
      <button type="submit" className="btn btn-primary justify-center" disabled={!valido || enviando}>
        {enviando ? 'Entrando...' : valido?.empresaNova ? 'Criar a empresa' : 'Entrar na empresa'}
      </button>
    </form>
  )
}
