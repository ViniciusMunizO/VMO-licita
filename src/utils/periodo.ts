import { splitLegacyDateTime, addMonthsToDate } from './date'

export type Periodo = 'todos' | '1m' | '3m' | '6m' | '1a' | 'custom'

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'todos', label: 'Todo o período' },
  { id: '1m', label: 'Último mês' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: '1a', label: 'Último ano' },
  { id: 'custom', label: 'Data específica' },
]

// Início do intervalo pra cada período pré-definido, contado a partir de
// hoje — "custom" usa as datas escolhidas manualmente, tratado à parte.
export function inicioParaPeriodo(periodo: Periodo, hoje: string): string {
  switch (periodo) {
    case '1m': return addMonthsToDate(hoje, -1)
    case '3m': return addMonthsToDate(hoje, -3)
    case '6m': return addMonthsToDate(hoje, -6)
    case '1a': return addMonthsToDate(hoje, -12)
    default: return ''
  }
}

export function dataDentroDoPeriodo(
  dataValue: string | undefined,
  periodo: Periodo,
  hoje: string,
  dataInicioCustom: string,
  dataFimCustom: string
): boolean {
  if (periodo === 'todos') return true
  const dataLic = splitLegacyDateTime(dataValue).date
  if (!dataLic) return false
  const inicio = periodo === 'custom' ? dataInicioCustom : inicioParaPeriodo(periodo, hoje)
  const fim = periodo === 'custom' ? (dataFimCustom || hoje) : hoje
  if (inicio && dataLic < inicio) return false
  if (fim && dataLic > fim) return false
  return true
}
