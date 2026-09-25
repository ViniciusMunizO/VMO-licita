import * as XLSX from 'xlsx'

// Cada relatório já monta suas linhas como array de objetos simples (mesma
// forma dos dados que vão pra tabela em tela) — aqui só vira planilha.
export function exportRowsToExcel(rows: Record<string, any>[], filename: string, sheetName = 'Relatório') {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  XLSX.writeFile(book, filename)
}
