import React from 'react'
import { buildDeclaracaoContext } from '../utils/declaracoes'
import { nowDateExtensoBR } from '../utils/date'
import { formatNumeric } from '../utils/format'
import { agruparPorLote, somaColuna } from '../utils/itens'
import { valorPorExtenso } from '../utils/numeroExtenso'
import { DECLARACAO_PROPOSTA_PADRAO } from '../utils/proposta'

type Props = {
  modelo: any
  items: any[]
  empresa: any
  pageRef?: React.RefObject<HTMLDivElement>
}

const row: React.CSSProperties = { marginTop: 4 }
// Cor dos documentos emitidos: acompanha a logo do CLIENTE, não a paleta do
// sistema — o papel é dele e vai assinado por ele. Por isso não muda quando a
// identidade visual do Licita-VMO muda.
const PRIMARY = '#0F1B3D'

const PROPOSTA_COLUNAS: { key: string; label: string; width: string; numeric?: boolean }[] = [
  { key: 'item', label: 'Item', width: '6%' },
  { key: 'marca', label: 'Marca', width: '12%' },
  { key: 'descricao', label: 'Descrição', width: '38%' },
  { key: 'quantidade', label: 'Qtd', width: '8%', numeric: true },
  { key: 'unidade', label: 'Uni', width: '8%' },
  { key: 'valorUnitMinimo', label: 'Valor Unitário', width: '14%', numeric: true },
  { key: 'valorTotalMinimo', label: 'Valor Total', width: '14%', numeric: true },
]

export default function PrintableProposta({ modelo, items, empresa, pageRef }: Props) {
  const ctx = buildDeclaracaoContext(empresa, modelo)
  const cidadeUf = [ctx.cidade, ctx.uf].filter(Boolean).join('/')
  const colunas = PROPOSTA_COLUNAS
  const grupos = agruparPorLote(items)
  const temLotes = grupos.length > 1 || grupos[0]?.lote !== null
  const valorTotal = somaColuna(items, 'valorTotalMinimo')
  const declaracoes = empresa?.declaracoesProposta || DECLARACAO_PROPOSTA_PADRAO

  return (
    <div ref={pageRef} style={{ width: '794px', padding: 32, background: '#fff', color: '#000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', fontSize: 12, lineHeight: 1.5 }}>
      <header style={{ marginBottom: 12, borderBottom: `2px solid ${PRIMARY}`, paddingBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>{ctx.razaoSocial || 'Empresa'}</div>
        <div style={{ fontSize: 11, color: '#444' }}>CNPJ: {ctx.cnpj || '-'}{ctx.inscricaoEstadual ? ` — I.E.: ${ctx.inscricaoEstadual}` : ''}</div>
        <div style={{ fontSize: 11, color: '#444' }}>{ctx.endereco || '-'}{ctx.cidade ? ` — ${ctx.cidade}` : ''}{ctx.uf ? `/${ctx.uf}` : ''}{ctx.cep ? ` — CEP ${ctx.cep}` : ''}</div>
        {ctx.telefone && <div style={{ fontSize: 11, color: '#444' }}>Tel: {ctx.telefone}</div>}
      </header>

      <div style={row}>À {ctx.contratanteCompleto || '-'}</div>
      <div style={{ ...row, display: 'flex', justifyContent: 'space-between' }}>
        <span>PREGÃO ELETRÔNICO Nº {ctx.numeroPregao || '-'}</span>
        <span>Processo nº: {ctx.numeroProcesso || '-'}</span>
      </div>
      <div style={row}>JULGAMENTO: {ctx.tipoDisputa || '-'}</div>
      <div style={row}>Objeto: {ctx.objetoLicitacao || '-'}</div>

      <div style={{ marginTop: 14 }}>
        <strong>DADOS DA PROPONENTE:</strong>
        <div style={row}>Nome: {ctx.razaoSocial || '-'}</div>
        <div style={row}>CNPJ nº: {ctx.cnpj || '-'}    Insc. Estadual: {ctx.inscricaoEstadual || '-'}    Insc. Municipal: {ctx.inscricaoMunicipal || '-'}</div>
        <div style={row}>Endereço: {ctx.endereco || '-'}</div>
        <div style={row}>CEP: {ctx.cep || '-'}    Cidade: {ctx.cidade || '-'}    UF: {ctx.uf || '-'}</div>
        <div style={row}>Fone: {ctx.telefone || '-'}    E-mail: {ctx.email || '-'}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>DADOS BANCÁRIOS:</strong>
        <div style={row}>{[ctx.banco, ctx.agencia, ctx.conta].filter(Boolean).join(' / ') || '-'}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>DADOS PARA ASSINATURA DO CONTRATO:</strong>
        <div style={row}>{ctx.representanteNome || '-'} - {ctx.representanteCargo || '-'} - CPF: {ctx.representanteCpf || '-'} / RG: {ctx.representanteRg || '-'}.</div>
      </div>

      <h2 style={{ fontSize: 13, textAlign: 'center', background: '#eef0fa', padding: '8px 6px', marginTop: 18, marginBottom: 14, textTransform: 'uppercase' }}>Proposta de Preços</h2>

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#777' }}>Nenhum item cadastrado nesta licitação.</div>
      ) : (
        <>
          {grupos.map((grupo, gi) => (
            <div key={grupo.lote ?? '_'} style={{ marginBottom: gi < grupos.length - 1 ? 14 : 0 }}>
              {grupo.lote !== null && (
                <h3 style={{ fontSize: 11, margin: '0 0 6px 0', color: PRIMARY, fontWeight: 700 }}>Lote {grupo.lote}</h3>
              )}
              <div style={{ border: '1px solid #e4e4f0', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, tableLayout: 'fixed' }}>
                  <colgroup>
                    {colunas.map(c => <col key={c.key} style={{ width: c.width }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      {colunas.map(c => (
                        <th key={c.key} style={{ textAlign: c.numeric ? 'right' : 'left', background: PRIMARY, color: '#fff', padding: '7px 6px', fontSize: 9.5 }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((it, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f7fc' }}>
                        {colunas.map(c => {
                          const value = it[c.key]
                          const display = c.numeric ? formatNumeric(value) : (value === undefined || value === '' ? '-' : String(value))
                          return (
                            <td key={c.key} style={{ padding: '6px 6px', borderBottom: '1px solid #eee', textAlign: c.numeric ? 'right' : 'left', verticalAlign: 'top' }}>{display}</td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {temLotes && (
                    <tfoot>
                      <tr style={{ background: '#f6f6fb' }}>
                        <td colSpan={colunas.length - 1} style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700 }}>Valor Total do Lote:</td>
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700 }}>{formatNumeric(somaColuna(grupo.items, 'valorTotalMinimo'))}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, fontWeight: 700 }}>
            Valor total da Proposta: {formatNumeric(valorTotal)} ({valorPorExtenso(valorTotal)})
          </div>
        </>
      )}

      <div style={{ marginTop: 18, border: '1px solid #e4e4f0', borderRadius: 6, padding: 12, background: '#f6f6fb' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={row}><strong>Validade da Proposta:</strong> {modelo?.prazoValidade || '-'}</div>
            <div style={row}><strong>Prazo de Entrega:</strong> {modelo?.prazoEntrega || 'Conforme edital'}</div>
            <div style={row}><strong>Local de Entrega:</strong> {modelo?.localEntrega || 'Conforme edital'}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={row}><strong>Prazo de Pagamento:</strong> {modelo?.prazoPagamento || 'Conforme edital'}</div>
            <div style={row}><strong>Prazo de Garantia:</strong> {modelo?.prazoGarantia || 'Conforme edital'}</div>
            <div style={row}><strong>Prazo de Vigência:</strong> {modelo?.vigenciaContrato || 'Conforme edital'}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{declaracoes}</div>

      <div style={{ marginTop: 24 }}>{cidadeUf || '-'}, {nowDateExtensoBR()}</div>

      <div style={{ marginTop: 56 }}>
        <div style={{ borderTop: '1px solid #000', width: 300, marginBottom: 6 }} />
        <div><strong>{ctx.razaoSocial || '-'}</strong></div>
        <div>CNPJ: {ctx.cnpj || '-'}</div>
        <div>{ctx.representanteNome || '-'}</div>
        <div>{ctx.representanteCargo || '-'}</div>
        <div>RG Nº {ctx.representanteRg || '-'}</div>
        <div>CPF Nº {ctx.representanteCpf || '-'}</div>
      </div>
    </div>
  )
}
