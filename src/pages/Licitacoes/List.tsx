import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dbGet, migrateFromLocalStorage } from '../../utils/db'
import { formatDateTimeBR } from '../../utils/date'

export default function ListLicitacoes() {
  const [list, setList] = useState<any[]>([])
  const [hasAtaByCodigo, setHasAtaByCodigo] = useState<Record<string, boolean>>({})
  const [itemsTextByCodigo, setItemsTextByCodigo] = useState<Record<string, string>>({})
  const [listOptions, setListOptions] = useState<any>({ page: 1, pageSize: 10, sortBy: 'codigo', sortDir: 'desc' })
  const [filters, setFilters] = useState<any>({ codigo: '', contratante: '', numeroPregao: '', numeroProcesso: '', tipoObjeto: '', tipoDisputa: '', hasAta: 'any', q: '' })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let mounted = true
    migrateFromLocalStorage().then(async () => {
      const raw = await dbGet('licitacoes')
      if (!mounted) return
      const items: any[] = raw || []
      setList(items)
      const entries = await Promise.all(items.map(async (l) => {
        const atas = await dbGet(`atas_${l.codigo}`)
        return [String(l.codigo), Array.isArray(atas) && atas.length > 0] as const
      }))
      if (!mounted) return
      setHasAtaByCodigo(Object.fromEntries(entries))

      const itemsEntries = await Promise.all(items.map(async (l) => {
        const its = await dbGet(`items_${l.codigo}`)
        const text = Array.isArray(its) ? its.map((it: any) => JSON.stringify(it)).join(' ') : ''
        return [String(l.codigo), text] as const
      }))
      if (!mounted) return
      setItemsTextByCodigo(Object.fromEntries(itemsEntries))
    })
    return () => { mounted = false }
  }, [])

  // debounce searchTerm -> filters.q
  useEffect(() => {
    const t = setTimeout(() => setFilters((f: any) => ({ ...f, q: searchTerm })), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const clearFilters = () => {
    setFilters({ codigo: '', contratante: '', numeroPregao: '', numeroProcesso: '', tipoObjeto: '', tipoDisputa: '', hasAta: 'any', q: '' })
    setSearchTerm('')
    setListOptions((o: any) => ({ ...o, page: 1 }))
  }

  const filtered = list.filter(l => {
    if (!l) return false
    if (filters.codigo && String(l.codigo) !== String(filters.codigo)) return false
    if (filters.contratante) {
      const q = String(filters.contratante).toLowerCase()
      const cNome = String(l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || '').toLowerCase()
      const cCodigo = String(l.contratante?.codigo || '')
      if (!(cNome.includes(q) || cCodigo === q)) return false
    }
    if (filters.numeroPregao && !(String(l.numeroPregao || '').toLowerCase().includes(String(filters.numeroPregao).toLowerCase()))) return false
    if (filters.numeroProcesso && !(String(l.numeroProcesso || '').toLowerCase().includes(String(filters.numeroProcesso).toLowerCase()))) return false
    if (filters.tipoObjeto && filters.tipoObjeto !== '' && (l.tipoObjeto || '') !== filters.tipoObjeto) return false
    if (filters.tipoDisputa && filters.tipoDisputa !== '' && (l.tipoDisputa || '') !== filters.tipoDisputa) return false
    if (filters.hasAta !== 'any') {
      const has = !!hasAtaByCodigo[String(l.codigo)]
      if (filters.hasAta === 'yes' && !has) return false
      if (filters.hasAta === 'no' && has) return false
    }
    if (filters.q) {
      const hay = (JSON.stringify(l) + ' ' + (itemsTextByCodigo[String(l.codigo)] || '')).toLowerCase()
      if (!hay.includes(String(filters.q).toLowerCase())) return false
    }
    return true
  })

  const sorted = useMemo(() => {
    const arr = filtered.slice()
    const { sortBy, sortDir } = listOptions
    arr.sort((a: any, b: any) => {
      const va = (a[sortBy] || '')
      const vb = (b[sortBy] || '')
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, listOptions])

  const total = sorted.length
  const start = (listOptions.page - 1) * listOptions.pageSize
  const paginated = sorted.slice(start, start + listOptions.pageSize)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold">Licitações</h3>
        <Link to="/licitacoes/novo" className="btn btn-primary">Nova Licitação</Link>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h4 className="font-semibold mb-2">Filtros</h4>
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="Código" value={filters.codigo} onChange={e => setFilters({ ...filters, codigo: e.target.value })} className="p-2 rounded" />
          <input placeholder="Contratante" value={filters.contratante} onChange={e => setFilters({ ...filters, contratante: e.target.value })} className="p-2 rounded" />
          <input placeholder="Número do Pregão" value={filters.numeroPregao} onChange={e => setFilters({ ...filters, numeroPregao: e.target.value })} className="p-2 rounded" />
          <input placeholder="Número do Processo" value={filters.numeroProcesso} onChange={e => setFilters({ ...filters, numeroProcesso: e.target.value })} className="p-2 rounded" />
          <select value={filters.tipoObjeto} onChange={e => setFilters({ ...filters, tipoObjeto: e.target.value })} className="p-2 rounded">
            <option value="">Tipo Objeto (qualquer)</option>
            <option>Medicamentos</option>
            <option>Materiais</option>
            <option>Misto</option>
          </select>
          <select value={filters.tipoDisputa} onChange={e => setFilters({ ...filters, tipoDisputa: e.target.value })} className="p-2 rounded">
            <option value="">Tipo de disputa (qualquer)</option>
            <option>Aberto</option>
            <option>Fechado</option>
            <option>Aberto-Fechado</option>
            <option>Fechado-Aberto</option>
          </select>
          <select value={filters.hasAta} onChange={e => setFilters({ ...filters, hasAta: e.target.value })} className="p-2 rounded">
            <option value="any">Tem ata?</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
          <input placeholder="Busca geral (itens/observações)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 rounded col-span-2" />
          <div className="flex gap-2">
            <button type="button" onClick={clearFilters} className="btn btn-ghost">Limpar</button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <label>Ordenar por:</label>
            <select value={listOptions.sortBy} onChange={e => setListOptions({ ...listOptions, sortBy: e.target.value })} className="p-1 rounded">
              <option value="codigo">Código</option>
              <option value="ano">Ano</option>
              <option value="dataLicitacao">Data</option>
            </select>
            <select value={listOptions.sortDir} onChange={e => setListOptions({ ...listOptions, sortDir: e.target.value })} className="p-1 rounded">
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
          <div className="text-sm">Resultados: {total}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <div className="mt-4">
          <table className="w-full table-auto">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="p-2">Código</th>
                <th className="p-2">Ano</th>
                <th className="p-2">Contratante</th>
                <th className="p-2">Data</th>
                <th className="p-2">Situação</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{l.codigo}</td>
                  <td className="p-2">{l.ano}</td>
                  <td className="p-2">{l.contratante?.nome || l.contratado || l.empresa?.razaoSocial || '-'}</td>
                  <td className="p-2">{formatDateTimeBR(l.dataLicitacao, l.horaLicitacao)}</td>
                  <td className="p-2">
                    <span className={
                      l.status === 'Ganhou' ? 'text-green-600 font-medium'
                        : l.status === 'Perdeu' ? 'font-medium' : 'text-gray-500'
                    } style={l.status === 'Perdeu' ? { color: 'var(--color-error)' } : undefined}>
                      {l.status || 'Sem status'}
                    </span>
                  </td>
                  <td className="p-2">
                      <Link to={`/licitacoes/${l.codigo}`} className="btn btn-primary text-xs px-3 py-1">Ver Licitação</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm">Página {listOptions.page} de {Math.max(1, Math.ceil(total / listOptions.pageSize))}</div>
            <div className="flex items-center gap-2">
              <button disabled={listOptions.page <= 1} onClick={() => setListOptions((o: any) => ({ ...o, page: o.page - 1 }))} className="px-3 py-1 bg-gray-100 rounded">Anterior</button>
              <button disabled={start + listOptions.pageSize >= total} onClick={() => setListOptions((o: any) => ({ ...o, page: o.page + 1 }))} className="px-3 py-1 bg-gray-100 rounded">Próxima</button>
              <select value={listOptions.pageSize} onChange={e => setListOptions((o: any) => ({ ...o, pageSize: Number(e.target.value), page: 1 }))} className="border p-1 rounded">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
