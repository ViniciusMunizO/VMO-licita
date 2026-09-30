// Datas de licitação são guardadas como data (YYYY-MM-DD) e horário (HH:mm) separados.
// Registros antigos podem ainda ter um datetime-local completo (YYYY-MM-DDTHH:mm) no
// campo de data; as funções abaixo toleram os dois formatos.

export function splitLegacyDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const [date, time] = value.split('T')
  return { date: date || '', time: time || '' }
}

export function formatDateBR(dateValue?: string): string {
  const { date } = splitLegacyDateTime(dateValue)
  if (!date) return '-'
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${d}/${m}/${y}`
}

export function combineDateTime(dateValue?: string, timeValue?: string): Date | null {
  const { date, time } = splitLegacyDateTime(dateValue)
  if (!date) return null
  const iso = `${date}T${time || timeValue || '00:00'}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export function formatDateTimeBR(dateValue?: string, timeValue?: string): string {
  const { date, time } = splitLegacyDateTime(dateValue)
  const datePart = formatDateBR(date)
  const timePart = time || timeValue
  if (datePart === '-') return '-'
  return timePart ? `${datePart} ${timePart}` : datePart
}

const BRASILIA_TZ = 'America/Sao_Paulo'

// Data/hora atuais no fuso de Brasília, independente do fuso horário do
// dispositivo/servidor onde o app está rodando.
export function nowInBrasilia(): { date: string; time: string } {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: BRASILIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: BRASILIA_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  return { date, time }
}

// Formata um timestamp (epoch ms) como DD/MM/AAAA HH:mm no fuso de Brasília —
// usado em logs de auditoria e histórico de versões.
export function formatEpochBR(ms: number): string {
  const d = new Date(ms)
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: BRASILIA_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: BRASILIA_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${date} ${time}`
}

// Data atual por extenso, para o fecho de declarações (ex: "14 de agosto de 2026").
export function nowDateExtensoBR(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: BRASILIA_TZ, day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('day')} de ${get('month')} de ${get('year')}`
}

// Dias até uma data "YYYY-MM-DD" (negativo = já passou). Null quando `data`
// está vazia ou não é uma data válida. Genérico — usado tanto pro alerta de
// validade de documentos da empresa quanto pro alerta de prazos de
// recurso/impugnação no Dashboard.
export function diasParaVencer(data: string | null | undefined, hoje: string): number | null {
  if (!data) return null
  const a = new Date(`${data}T00:00:00`)
  const b = new Date(`${hoje}T00:00:00`)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

// Soma meses a uma data "YYYY-MM-DD", usado para calcular o fim de vigência
// de uma ata/contrato a partir do início + quantidade de meses.
export function addMonthsToDate(dateValue: string, months: number): string {
  const { date } = splitLegacyDateTime(dateValue)
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return ''
  const result = new Date(y, m - 1 + months, d)
  const yyyy = result.getFullYear()
  const mm = String(result.getMonth() + 1).padStart(2, '0')
  const dd = String(result.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
