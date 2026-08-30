import React from 'react'

// Ícones simples em SVG inline (sem depender de biblioteca externa) — só pra
// dar um pouco mais de identidade visual aos itens do menu principal.
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function IconLicitacoes() {
  return (
    <svg {...base}>
      <path d="M8 3h8a2 2 0 0 1 2 2v14a1 1 0 0 1-1.45.9L12 18l-4.55 1.9A1 1 0 0 1 6 19V5a2 2 0 0 1 2-2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

export function IconRelatorios() {
  return (
    <svg {...base}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12.5" y="8" width="3" height="10" />
      <rect x="18" y="5" width="3" height="13" />
    </svg>
  )
}

export function IconEmpresa() {
  return (
    <svg {...base}>
      <path d="M4 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" />
      <path d="M14 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
      <path d="M9 21v-3M7 8h2M7 11h2M7 14h2" />
      <path d="M2 21h20" />
    </svg>
  )
}

export function IconUsuarios() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16.5 8.5a2.5 2.5 0 1 1 0 5" />
      <path d="M15.5 13.5c2.6.3 4.5 1.9 5 4.7" />
    </svg>
  )
}
