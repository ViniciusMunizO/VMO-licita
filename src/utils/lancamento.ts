import { updateLicitacao, listLicitacoes } from './licitacoes'
import { auditLog } from './audit'

// Marca/desmarca uma licitação como já lançada no sistema interno (ERP) da empresa. Usada no
// detalhe da licitação e no relatório de ganhos, para tirar o registro da lista de "não lançadas"
// sem duplicar a licitação entre os dois sistemas. (No banco: processos.lancado_no_erp.)
export async function marcarLancadoNoSistema(codigo: number, value: boolean, userName?: string): Promise<any[]> {
  await updateLicitacao(codigo, { lancadoNoSistema: value })
  try {
    await auditLog('licitacao_lancamento_toggle', { codigo, lancadoNoSistema: value }, userName)
  } catch { /* ignore */ }
  return listLicitacoes()
}
