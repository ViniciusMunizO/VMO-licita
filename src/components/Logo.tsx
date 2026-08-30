import React from 'react'
import logoUrl from '../assets/logo-botti.png'

// Logo oficial da Botti Global Pharma (src/assets/logo-botti.png, fundo
// removido). A marca é navy-sobre-transparente — só existe em versão pra
// fundo claro. Quando precisa ficar sobre uma superfície escura (variant
// "inverted"), ela entra dentro de um cartão branco, técnica padrão quando
// não existe uma versão clara da marca.

const ASPECT = 548 / 171

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
  const img = <img src={logoUrl} alt="Botti Global Pharma" style={{ display: 'block', height, width: height * ASPECT }} />

  if (variant === 'inverted') {
    return (
      <div className={className} style={{ display: 'inline-block', background: '#fff', borderRadius: 10, padding: '10px 16px' }}>
        {img}
      </div>
    )
  }

  return <div className={className} style={{ display: 'inline-block' }}>{img}</div>
}
