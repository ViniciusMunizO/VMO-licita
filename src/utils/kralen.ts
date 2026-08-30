// Marca/desmarca uma licitação como já lançada no Kralen — mesma lógica do
// checkbox "Licitação Lançada no KRALEN" do sistema Access atual, usada tanto
// no detalhe da licitação quanto no relatório de ganhos para tirar o registro
// da lista de "não lançados" sem duplicar a licitação entre os dois sistemas.
export async function setLancadoNoKralen(codigo: number, value: boolean, userName?: string): Promise<any[]> {
  const { dbUpdate } = await import('./db')
  const list = await dbUpdate<any[]>('licitacoes', (current) => {
    const next = [...(current || [])]
    const idx = next.findIndex((l: any) => String(l.codigo) === String(codigo))
    if (idx >= 0) next[idx] = { ...next[idx], lancadoNoKralen: value }
    return next
  })
  try {
    const { auditLog } = await import('./audit')
    await auditLog('licitacao_kralen_toggle', { codigo, lancadoNoKralen: value }, userName)
  } catch (err) { /* ignore */ }
  return list
}
