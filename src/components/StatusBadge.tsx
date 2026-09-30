import React from 'react'

export default function StatusBadge({ status }: { status?: string }) {
  return (
    <span
      className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap"
      style={
        status === 'Ganhou' ? { backgroundColor: '#dcfce7', color: '#15803d' }
          : status === 'Perdeu' ? { backgroundColor: '#fee2e2', color: 'var(--color-error-text)' }
          : { backgroundColor: '#f3f4f6', color: '#6b7280' }
      }
    >
      {status || 'Sem status'}
    </span>
  )
}
