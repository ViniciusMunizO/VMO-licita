// Confirmação antes de ação destrutiva (remover anexo, ata, documento, conta
// bancária) — texto único pra não ter uma variação de aviso por tela, e um
// ponto só pra trocar de diálogo nativo por um modal próprio no futuro.
export function confirmarRemocao(item: string, observacao?: string): boolean {
  const aviso = `Remover ${item}? Essa ação não pode ser desfeita.`
  return window.confirm(observacao ? `${aviso}\n\n${observacao}` : aviso)
}
