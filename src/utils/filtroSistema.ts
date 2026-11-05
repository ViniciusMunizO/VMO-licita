// Filtro dos relatórios: licitações já lançadas ou não no sistema interno (ERP) da empresa.
// O nome do sistema vem das configurações da empresa (useConfigEmpresa().sistema).
export type FiltroSistema = 'todas' | 'lancadas' | 'naoLancadas'

export function filtrosSistema(sistema: string): { id: FiltroSistema; label: string }[] {
  return [
    { id: 'todas', label: 'Todas' },
    { id: 'lancadas', label: `Lançadas no ${sistema}` },
    { id: 'naoLancadas', label: `Não lançadas no ${sistema}` },
  ]
}

export function passaFiltroSistema(lancado: boolean | undefined, filtro: FiltroSistema): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'lancadas') return !!lancado
  return !lancado
}
