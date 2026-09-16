import React, { useEffect, useState } from 'react'
import { getEmpresaInfo } from '../utils/empresa'
import { listItems } from '../utils/items'
import { listAttachments } from '../utils/attachments'
import { formatDateTimeBR } from '../utils/date'
import { formatNumeric } from '../utils/format'
import { agruparPorLote, somaColuna } from '../utils/itens'

type Props = {
  modelo: any
  codigo: number
  user: any
  habilitacao?: any
  page1Ref?: React.RefObject<HTMLDivElement>
  page2Ref?: React.RefObject<HTMLDivElement>
  // Quando o componente pai já mantém itens/anexos em estado (ex: a tela de
  // Detalhe, que os atualiza a cada edição), eles são recebidos aqui prontos
  // em vez de serem buscados de novo — assim o PDF/impressão nunca fica
  // desatualizado em relação ao que está na tela, sem precisar dar F5.
  items?: any[]
  attachments?: any[]
}

// Cor dos documentos emitidos: acompanha a logo do CLIENTE, não a paleta do
// sistema — o papel é dele e vai assinado por ele. Por isso não muda quando a
// identidade visual do Licita-VMO muda.
const PRIMARY = '#0F1B3D'
const BOX_BG = '#f6f6fb'
const BOX_BORDER = '#e4e4f0'

const HABILITACAO_ITEMS: { key: string; label: string }[] = [
  { key: 'habilitacaoJuridica', label: 'Habilitação Jurídica' },
  { key: 'habilitacaoFiscal', label: 'Habilitação Fiscal, Social e Trabalhista' },
  { key: 'balanco', label: 'Balanço' },
  { key: 'anvisa', label: 'Anvisa' },
  { key: 'boasPraticas', label: 'Boas Práticas' },
  { key: 'laudo', label: 'Laudo' },
  { key: 'bula', label: 'Bula' },
  { key: 'ggrem', label: 'GGREM' },
  { key: 'cti', label: 'CTI com Transportadora' },
]

const ITEM_COLUMNS: { key: string; label: string; width: string; fallback?: string[]; numeric?: boolean; boolean?: boolean; maxChars?: number }[] = [
  { key: 'item', label: 'Item', width: '4%' },
  { key: 'descricao', label: 'Descrição', width: '16%', fallback: ['description'], maxChars: 110 },
  { key: 'unidade', label: 'Uni', width: '6%' },
  { key: 'quantidade', label: 'Qtd', width: '5%', fallback: ['qty'], numeric: true },
  { key: 'codKralen', label: 'Cód. Kralen', width: '7%' },
  { key: 'marca', label: 'Marca', width: '8%' },
  { key: 'origemCotacao', label: 'Origem Cotação', width: '9%' },
  { key: 'valorCusto', label: 'Valor Custo', width: '7%', numeric: true },
  { key: 'totalCusto', label: 'Total Custo', width: '7%', numeric: true },
  { key: 'valorUnitMinimo', label: 'Valor Mínimo', width: '7%', numeric: true },
  { key: 'valorTotalMinimo', label: 'Total Mínimo', width: '7%', numeric: true },
  { key: 'valorUnitMunicipio', label: 'Valor Município', width: '7%', numeric: true },
  { key: 'valorTotalMunicipio', label: 'Total Município', width: '7%', numeric: true },
  { key: 'vencedor', label: 'Vencedor', width: '5%', boolean: true },
  { key: 'valorGanho', label: 'Valor Ganho', width: '5%' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{value || '-'}</div>
    </div>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <h2 style={{ fontSize: 13, margin: '0 0 8px 0', color: PRIMARY, borderBottom: `1px solid ${BOX_BORDER}`, paddingBottom: 6 }}>{title}</h2>
      {children}
    </section>
  )
}

const TOTAL_CUSTO_INDEX = ITEM_COLUMNS.findIndex(c => c.key === 'totalCusto')
const COLUNAS_TOTAL = ['totalCusto', 'valorTotalMinimo', 'valorTotalMunicipio']

function ItemsTable({ items, subtotalLabel, subtotalStyle }: { items: any[]; subtotalLabel?: string; subtotalStyle?: React.CSSProperties }) {
  return (
    <div style={{ border: `1px solid ${BOX_BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, tableLayout: 'fixed' }}>
        <colgroup>
          {ITEM_COLUMNS.map(c => <col key={c.key} style={{ width: c.width }} />)}
        </colgroup>
        <thead>
          <tr>
            {ITEM_COLUMNS.map(c => (
              <th key={c.key} style={{ textAlign: c.numeric ? 'right' : 'left', background: PRIMARY, color: '#fff', padding: '7px 6px', fontSize: 9, letterSpacing: 0.2, wordBreak: 'break-word' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f7fc' }}>
              {ITEM_COLUMNS.map(c => {
                let value = it[c.key]
                if ((value === undefined || value === '') && c.fallback) {
                  for (const f of c.fallback) { if (it[f] !== undefined && it[f] !== '') { value = it[f]; break } }
                }
                const isText = c.key === 'descricao' || c.key === 'origemCotacao'
                let display: string
                if (c.boolean) {
                  display = value ? 'Vencedor' : '-'
                } else if (c.numeric) {
                  display = formatNumeric(value)
                } else {
                  display = value === undefined || value === null || value === '' ? '-' : String(value)
                  if (c.maxChars && display.length > c.maxChars) display = display.slice(0, c.maxChars).trimEnd() + '…'
                }
                return (
                  <td
                    key={c.key}
                    style={{
                      padding: '6px 6px',
                      borderBottom: '1px solid #eee',
                      verticalAlign: 'top',
                      lineHeight: 1.35,
                      textAlign: c.numeric ? 'right' : 'left',
                      whiteSpace: isText ? 'normal' : 'nowrap',
                      wordBreak: isText ? 'break-word' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {subtotalLabel && (
          <tfoot>
            <tr style={{ background: BOX_BG }}>
              <td colSpan={TOTAL_CUSTO_INDEX} style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, ...subtotalStyle }}>{subtotalLabel}</td>
              {ITEM_COLUMNS.slice(TOTAL_CUSTO_INDEX).map(c => (
                <td key={c.key} style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, ...subtotalStyle }}>
                  {COLUNAS_TOTAL.includes(c.key) ? formatNumeric(somaColuna(items, c.key)) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function PrintableChecklist({ modelo, codigo, user, habilitacao = {}, page1Ref, page2Ref, items: itemsProp, attachments: attachmentsProp }: Props) {
  const [fetchedAttachments, setFetchedAttachments] = useState<any[]>([])
  const [fetchedItems, setFetchedItems] = useState<any[]>([])
  const [empresa, setEmpresa] = useState<any>(null)
  const attachments = attachmentsProp ?? fetchedAttachments
  const items = itemsProp ?? fetchedItems

  useEffect(() => {
    let mounted = true
    getEmpresaInfo().then(emp => { if (mounted) setEmpresa(emp || null) }).catch(() => { /* cabeçalho sai sem os dados da empresa */ })
    if (itemsProp === undefined) {
      listItems(codigo).then(it => { if (mounted) setFetchedItems(it || []) }).catch(() => { /* impressão segue sem a lista */ })
    }
    if (attachmentsProp === undefined) {
      listAttachments(codigo).then(at => { if (mounted) setFetchedAttachments(at || []) }).catch(() => { /* impressão segue sem a lista */ })
    }
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  return (
    <>
      <div id="print-page-1" ref={page1Ref} style={{ width: '794px', padding: 28, paddingTop: 48, background: '#fff', color: '#000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}>
        <header style={{ marginBottom: 14, borderBottom: `2px solid ${PRIMARY}`, paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 20, margin: 0, color: PRIMARY }}>Checklist — Licitação {codigo}{modelo?.ano ? ` / ${modelo.ano}` : ''}</h1>
          <div style={{ fontSize: 10, color: '#666' }}>Gerado por: {user?.name || '-'}</div>
        </header>

        {empresa && (empresa.razaoSocial || empresa.cnpj) && (
          <Box title="Empresa">
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Field label="Razão Social" value={empresa.razaoSocial} />
                <Field label="CNPJ" value={[empresa.cnpj, empresa.inscricaoEstadual ? `IE: ${empresa.inscricaoEstadual}` : ''].filter(Boolean).join('  —  ')} />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Endereço" value={[empresa.endereco, empresa.cidade, empresa.uf].filter(Boolean).join(' — ')} />
                <Field label="Contato" value={[empresa.telefone, empresa.email].filter(Boolean).join('  —  ')} />
              </div>
            </div>
          </Box>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Box title="1. Dados da Licitação">
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Contratante" value={modelo?.contratado} />
                  <Field label="Nº do Pregão" value={modelo?.numeroPregao} />
                  <Field label="Portal" value={modelo?.portal} />
                  <Field label="Tipo Objeto" value={modelo?.tipoObjeto} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Ano / Código" value={`${modelo?.ano || '-'} / ${modelo?.codigo ?? '-'}`} />
                  <Field label="Nº do Processo" value={modelo?.numeroProcesso} />
                  <Field label="Tipo de Disputa" value={modelo?.tipoDisputa} />
                  <Field label="Julgamento" value={modelo?.definJulgamento} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Data de Credenciamento" value={formatDateTimeBR(modelo?.dataCredenciamento, modelo?.horaCredenciamento)} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Data da Licitação" value={formatDateTimeBR(modelo?.dataLicitacao, modelo?.horaLicitacao)} />
                </div>
              </div>
              {modelo?.objetoLicitacao && <Field label="Objeto" value={<span style={{ whiteSpace: 'pre-wrap' }}>{modelo.objetoLicitacao}</span>} />}
            </Box>

            <Box title="3. Proposta">
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Validade da Proposta" value={modelo?.prazoValidade} />
                  <Field label="Prazo de Entrega" value={modelo?.prazoEntrega} />
                  <Field label="Local de Entrega" value={modelo?.localEntrega} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Prazo de Pagamento" value={modelo?.prazoPagamento} />
                  <Field label="Prazo de Garantia" value={modelo?.prazoGarantia || 'Conforme Edital'} />
                  <Field label="Vigência do Contrato" value={modelo?.vigenciaContrato || '12 (doze) meses'} />
                </div>
              </div>
            </Box>
          </div>

          <div style={{ flex: 1 }}>
            <Box title="2. Habilitação">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                {HABILITACAO_ITEMS.map(({ key, label }) => {
                  const checked = !!habilitacao?.[key]
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
                      <span style={{ color: checked ? '#1a8f4c' : '#aaa', fontWeight: 700, width: 10, display: 'inline-block' }}>{checked ? '✓' : '—'}</span>
                      <span style={{ color: checked ? '#000' : '#999' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
              {habilitacao?.outras && habilitacao?.outrasTexto && (
                <div style={{ marginTop: 8 }}><Field label="Outras declarações" value={habilitacao.outrasTexto} /></div>
              )}
              {habilitacao?.observacaoInterna && (
                <div style={{ marginTop: 4 }}><Field label="Observação interna" value={habilitacao.observacaoInterna} /></div>
              )}
            </Box>

            <Box title="Anexos">
              {attachments.length === 0 ? (
                <div style={{ fontSize: 11, color: '#777' }}>Nenhum anexo.</div>
              ) : (
                <div style={{ fontSize: 11 }}>
                  {attachments.map((a, i) => (
                    <div key={i} style={{ marginBottom: 3 }}>
                      {a.name || `anexo-${i + 1}`}
                    </div>
                  ))}
                </div>
              )}
            </Box>
          </div>
        </div>
      </div>

      <div id="print-page-2" ref={page2Ref} style={{ width: '1100px', padding: 24, paddingTop: 48, background: '#fff', color: '#000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ fontSize: 18, marginBottom: 10, color: PRIMARY }}>Itens — Licitação {codigo}</h2>
        {items.length === 0 ? (
          <div style={{ fontSize: 12 }}>Nenhum item importado.</div>
        ) : (
          (() => {
            const grupos = agruparPorLote(items)
            const temLotes = grupos.length > 1 || grupos[0]?.lote !== null
            return (
              <>
                {grupos.map((grupo, gi) => (
                  <div key={grupo.lote ?? '_'} style={{ marginBottom: gi < grupos.length - 1 ? 16 : 0 }}>
                    {grupo.lote !== null && (
                      <h3 style={{ fontSize: 12, margin: '0 0 6px 0', color: PRIMARY, fontWeight: 700 }}>Lote {grupo.lote}</h3>
                    )}
                    <ItemsTable items={grupo.items} subtotalLabel={temLotes ? 'Total do Lote:' : undefined} />
                  </div>
                ))}
                {grupos.length > 1 && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <div style={{ background: PRIMARY, color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 11, fontWeight: 700, display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <span>Valor Global (Mínimo):</span>
                      <span style={{ fontSize: 13 }}>{formatNumeric(somaColuna(items, 'valorTotalMinimo'))}</span>
                    </div>
                    <div style={{ background: BOX_BG, border: `1px solid ${BOX_BORDER}`, borderRadius: 6, padding: '8px 16px', fontSize: 11, fontWeight: 700, display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <span>Custo Global:</span>
                      <span style={{ fontSize: 13 }}>{formatNumeric(somaColuna(items, 'totalCusto'))}</span>
                    </div>
                  </div>
                )}
              </>
            )
          })()
        )}
      </div>
    </>
  )
}
