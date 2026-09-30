import React, { useEffect, useState } from 'react'
import { listAuditLogs, purgeAuditLogsOlderThan, RETENCAO_MINIMA_DIAS } from '../utils/audit'
import { formatEpochBR, combineDateTime } from '../utils/date'
import { DateInputBR } from '../components/DateTimeBR'
import { exportRowsToExcel } from '../utils/excel'
import { confirmarRemocao } from '../utils/confirmar'

const PAGINA = 200

export default function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [limite, setLimite] = useState(PAGINA)
  // Se a última busca trouxe menos que o limite pedido, não tem mais o que
  // carregar — sem essa marca o botão "Carregar mais" ficaria clicável pra
  // sempre, mesmo depois de esgotar a trilha inteira.
  const [temMais, setTemMais] = useState(true)
  const [erro, setErro] = useState('')
  const [dataCorte, setDataCorte] = useState('')
  const [apagando, setApagando] = useState(false)
  const [erroApagar, setErroApagar] = useState('')
  const [ultimoResultado, setUltimoResultado] = useState('')
  // Incrementado pra forçar um novo carregamento mesmo quando `limite` já
  // está em PAGINA (senão, apagar logo após abrir a tela não atualizaria a
  // lista visível, porque mudar pro mesmo valor não dispara o efeito de novo).
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    let mounted = true
    setErro('')
    setLoading(limite === PAGINA)
    setCarregandoMais(limite > PAGINA)
    listAuditLogs(limite).then(raw => {
      if (!mounted) return
      setLogs(raw)
      setTemMais(raw.length >= limite)
      setLoading(false)
      setCarregandoMais(false)
    }).catch(err => {
      if (!mounted) return
      setErro(err?.message || 'Não foi possível carregar o registro de auditoria.')
      setLoading(false)
      setCarregandoMais(false)
    })
    return () => { mounted = false }
  }, [limite, recarregar])

  const exportarEApagar = async () => {
    const corte = combineDateTime(dataCorte)?.getTime()
    if (!corte) return
    const limiarMinimo = Date.now() - RETENCAO_MINIMA_DIAS * 24 * 60 * 60 * 1000
    if (corte > limiarMinimo) {
      setErroApagar(`Só dá pra apagar log com mais de ${RETENCAO_MINIMA_DIAS} dias (mesmo por um admin) — escolha uma data mais antiga.`)
      return
    }
    if (!confirmarRemocao(
      `os logs de auditoria anteriores a ${dataCorte.split('-').reverse().join('/')}`,
      'Eles são exportados pra uma planilha Excel antes de apagar — guarde o arquivo baixado se precisar consultar depois.'
    )) return
    setApagando(true)
    setErroApagar('')
    setUltimoResultado('')
    try {
      const apagados = await purgeAuditLogsOlderThan(corte)
      if (apagados.length === 0) {
        setUltimoResultado('Nenhum log anterior a essa data — nada foi apagado.')
      } else {
        exportRowsToExcel(
          apagados.map(l => ({ Data: formatEpochBR(l.at), Ação: l.action, Usuário: l.user || 'desconhecido', Payload: JSON.stringify(l.payload) })),
          `audit_logs_ate_${dataCorte}.xlsx`,
          'Logs apagados'
        )
        setUltimoResultado(`${apagados.length} log(s) exportado(s) e apagado(s).`)
        setLimite(PAGINA)
        setRecarregar(r => r + 1)
      }
    } catch (err: any) {
      setErroApagar(err?.message || 'Não foi possível apagar os logs antigos.')
    } finally {
      setApagando(false)
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded shadow max-w-5xl">
      <h3 className="text-xl font-semibold mb-1">Registro de Auditoria</h3>
      <p className="text-sm text-gray-500 mb-4">Mostra as ações mais recentes primeiro.</p>
      {erro && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--color-error-text)' }}>{erro}</p>}
      <div className="max-h-96 overflow-auto border rounded p-2">
        {loading ? (
          <div className="text-sm text-gray-500 p-2">Carregando...</div>
        ) : erro ? null : logs.length === 0 ? (
          <div className="text-sm text-gray-500 p-2">Nenhum log de auditoria.</div>
        ) : (
          logs.map((l: any) => (
            <div key={l.id} className="p-2 border-b">
              <div className="text-sm text-gray-700">{formatEpochBR(l.at)} — <strong>{l.action}</strong> — {l.user || 'desconhecido'}</div>
              <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(l.payload, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
      {!loading && temMais && (
        <button
          type="button"
          onClick={() => setLimite(l => l + PAGINA)}
          disabled={carregandoMais}
          className="btn btn-ghost text-sm mt-3 disabled:opacity-50"
        >
          {carregandoMais ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}

      <div className="mt-6 pt-4 border-t">
        <h4 className="font-semibold mb-1">Retenção de logs</h4>
        <p className="text-sm text-gray-500 mb-3">Exporta pra Excel e apaga os logs anteriores à data escolhida — a trilha não deve crescer pra sempre.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="audit-data-corte" className="block text-sm text-gray-600">Apagar logs anteriores a</label>
            <DateInputBR id="audit-data-corte" value={dataCorte} onChange={setDataCorte} className="p-2 rounded w-36" />
          </div>
          <button
            type="button"
            onClick={exportarEApagar}
            disabled={!dataCorte || apagando}
            className="btn btn-ghost text-sm disabled:opacity-50"
          >
            {apagando ? 'Apagando...' : 'Exportar e apagar'}
          </button>
        </div>
        {erroApagar && <p role="alert" className="text-sm mt-2" style={{ color: 'var(--color-error-text)' }}>{erroApagar}</p>}
        {ultimoResultado && !erroApagar && <p className="text-sm mt-2 text-green-600">{ultimoResultado}</p>}
      </div>
    </div>
  )
}
