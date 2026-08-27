import React, { useEffect, useState } from 'react'

// Inputs de texto com máscara fixa DD/MM/AAAA e HH:mm.
// Formatação nativa de <input type="date"/"time"> depende do idioma do
// navegador/SO (ex: en-US mostra MM/DD/AAAA e AM/PM) — esses componentes
// garantem o formato brasileiro independente da configuração do navegador.
// O valor exposto via value/onChange continua em ISO (YYYY-MM-DD / HH:mm).

function isoDateToBR(iso: string): string {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function brDateToIso(br: string): string {
  const digits = br.replace(/\D/g, '')
  if (digits.length !== 8) return ''
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  return `${y}-${m}-${d}`
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('/')
}

function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  const parts = [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean)
  return parts.join(':')
}

type BaseProps = {
  value?: string
  onChange?: (isoValue: string) => void
  readOnly?: boolean
  className?: string
}

export function DateInputBR({ value, onChange, readOnly, className }: BaseProps) {
  const [text, setText] = useState(() => isoDateToBR(value || ''))

  useEffect(() => {
    setText(isoDateToBR(value || ''))
  }, [value])

  if (readOnly) {
    return <input type="text" value={text} readOnly className={className} />
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      value={text}
      className={className}
      onChange={e => {
        const masked = maskDate(e.target.value)
        setText(masked)
        const iso = brDateToIso(masked)
        if (iso) onChange?.(iso)
        else if (masked === '') onChange?.('')
      }}
    />
  )
}

export function TimeInputBR({ value, onChange, readOnly, className }: BaseProps) {
  const [text, setText] = useState(value || '')

  useEffect(() => {
    setText(value || '')
  }, [value])

  if (readOnly) {
    return <input type="text" value={text} readOnly className={className} />
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="hh:mm"
      value={text}
      className={className}
      onChange={e => {
        const masked = maskTime(e.target.value)
        setText(masked)
        if (/^\d{2}:\d{2}$/.test(masked)) onChange?.(masked)
        else if (masked === '') onChange?.('')
      }}
    />
  )
}
