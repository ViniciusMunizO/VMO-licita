import { updateLicitacao, listLicitacoes } from './licitacoes'
import { auditLog } from './audit'

// Marca/desmarca uma licitação como já lançada no Kralen — mesma lógica do
// checkbox "Licitação Lançada no KRALEN" do sistema Access atual, usada tanto
// no detalhe da licitação quanto no relatório de ganhos pra tirar o registro
// da lista de "não lançados" sem duplicar a licitação entre os dois sistemas.
export async function setLancadoNoKralen(codigo: number, value: boolean, userName?: string): Promise<any[]> {
  await updateLicitacao(codigo, { lancadoNoKralen: value })
  try {
    await auditLog('licitacao_kralen_toggle', { codigo, lancadoNoKralen: value }, userName)
  } catch { /* ignore */ }
  return listLicitacoes()
}
