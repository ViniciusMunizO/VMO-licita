import { useEffect, useState } from 'react'
import { getEmpresaInfo } from './empresa'
import { empresaGuardada } from './banco'
import { itensDaEmpresa } from './habilitacao'

// Configurações que mudam de uma empresa para outra (tabela empresa_dados, migração 0013).
// Antes eram fixas para um cliente só ("Kralen", "Medicamentos/Materiais"). Sem valor salvo,
// valem os padrões abaixo. O admin muda em "Informações da Empresa".

export type ConfigEmpresa = {
  /** Nome do sistema interno (ERP) onde a empresa lança as licitações ganhas. */
  sistema: string
  tiposObjeto: string[]
  /** Itens da checklist de habilitação das licitações (habilitacao.ts). */
  itensHabilitacao: string[]
  /** Logo da empresa no Storage (pasta da empresa), usada nos PDFs. Sem logo, o PDF sai só com o título. */
  logoCaminho: string | null
}

export const SISTEMA_PADRAO = 'ERP'
export const TIPOS_OBJETO_PADRAO = ['Produtos', 'Serviços', 'Misto']

export function configDe(info: Record<string, any> | null | undefined): ConfigEmpresa {
  const sistema = String(info?.nomeSistemaInterno ?? '').trim()
  const tipos = Array.isArray(info?.tiposObjeto)
    ? info!.tiposObjeto.map((t: any) => String(t).trim()).filter(Boolean)
    : []
  return {
    sistema: sistema || SISTEMA_PADRAO,
    tiposObjeto: tipos.length ? tipos : TIPOS_OBJETO_PADRAO,
    itensHabilitacao: itensDaEmpresa(info),
    logoCaminho: String(info?.logoCaminho ?? '').trim() || null,
  }
}

/** "Bling, Omie; Kralen" ou uma por linha viram lista, sem repetidas nem vazias. */
export function listaDeTexto(texto: string): string[] {
  const vistas = new Set<string>()
  return texto.split(/[,;\n]/).map(t => t.trim()).filter(t => {
    const chave = t.toLowerCase()
    if (!t || vistas.has(chave)) return false
    vistas.add(chave)
    return true
  })
}

/** Opções do select de tipo de objeto: as da empresa e, se a licitação já tem outro valor, ele também. */
export function opcoesTipoObjeto(tipos: string[], atual?: string | null): string[] {
  const valor = String(atual ?? '').trim()
  return valor && !tipos.includes(valor) ? [...tipos, valor] : tipos
}

// Uma leitura por empresa aberta; "Salvar" em Informações da Empresa limpa o cache.
let cache: { empresa: string; promessa: Promise<ConfigEmpresa> } | null = null
const ouvintes = new Set<(c: ConfigEmpresa) => void>()

export function carregarConfigEmpresa(): Promise<ConfigEmpresa> {
  const empresa = empresaGuardada()
  if (!empresa) return Promise.resolve(configDe(null))
  if (cache?.empresa !== empresa) {
    cache = { empresa, promessa: getEmpresaInfo().then(configDe).catch(() => configDe(null)) }
  }
  return cache.promessa
}

/** Chamado depois de salvar os dados da empresa: as telas abertas passam a usar o novo valor. */
export function configEmpresaMudou(info: Record<string, any>) {
  const nova = configDe(info)
  const empresa = empresaGuardada()
  cache = empresa ? { empresa, promessa: Promise.resolve(nova) } : null
  ouvintes.forEach(f => f(nova))
}

export function useConfigEmpresa(): ConfigEmpresa {
  const [config, setConfig] = useState<ConfigEmpresa>(() => configDe(null))
  useEffect(() => {
    let vivo = true
    carregarConfigEmpresa().then(c => { if (vivo) setConfig(c) })
    const ouvir = (c: ConfigEmpresa) => setConfig(c)
    ouvintes.add(ouvir)
    return () => { vivo = false; ouvintes.delete(ouvir) }
  }, [])
  return config
}
