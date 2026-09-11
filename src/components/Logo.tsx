import React from 'react'
import logoUrl from '../assets/logo-vmo.png'

// Logo da VMO Sistemas — a marca do próprio sistema, usada na interface
// (login, navbar, favicon). A logo da empresa que usa o sistema (o cliente)
// aparece em outro lugar: no cabeçalho dos documentos emitidos, ver
// `src/utils/pdf.ts`.
//
// A marca tem "VMO" em azul-escuro, então só funciona sobre fundo claro.
// Quando precisa ficar sobre superfície escura (variant "inverted"), ela
// entra dentro de um cartão branco — técnica padrão quando não existe uma
// versão clara da marca.

const ASPECT = 1504 / 607

const TAMANHOS = {
  sm: 26,
  md: 42,
  lg: 64,
} as const

type Props = {
  size?: keyof typeof TAMANHOS
  variant?: 'default' | 'inverted'
  className?: string
}

export default function Logo({ size = 'md', variant = 'default', className }: Props) {
  const height = TAMANHOS[size]
  const img = <img src={logoUrl} alt="VMO Sistemas" style={{ display: 'block', height, width: height * ASPECT }} />

  if (variant === 'inverted') {
    return (
      <div className={className} style={{ display: 'inline-block', background: '#fff', borderRadius: 10, padding: '10px 16px' }}>
        {img}
      </div>
    )
  }

  return <div className={className} style={{ display: 'inline-block' }}>{img}</div>
}
