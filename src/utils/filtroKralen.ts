export type FiltroKralen = 'todas' | 'lancadas' | 'naoLancadas'

export const FILTROS_KRALEN: { id: FiltroKralen; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'lancadas', label: 'Lançadas no Kralen' },
  { id: 'naoLancadas', label: 'Não lançadas no Kralen' },
]

export function passaFiltroKralen(lancadoNoKralen: boolean | undefined, filtro: FiltroKralen): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'lancadas') return !!lancadoNoKralen
  return !lancadoNoKralen
}
