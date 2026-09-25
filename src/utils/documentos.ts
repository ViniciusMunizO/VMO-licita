import { supabase } from './supabaseClient'
import { uploadAnexo, removerDoStorage } from './arquivo'

const PREFIXO_STORAGE = 'empresa'

export type DocumentoEmpresa = {
  id: string
  tipo: string
  numero?: string | null
  dataEmissao?: string | null
  dataValidade?: string | null
  reutilizavel: boolean
  observacao?: string | null
  path?: string | null
  filename?: string | null
  mime?: string | null
  size?: number | null
  criadoPor?: string | null
  created_at?: string
}

export async function listDocumentosEmpresa(): Promise<DocumentoEmpresa[]> {
  const { data, error } = await supabase.from('documentos_empresa').select('*').order('tipo', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addDocumentoEmpresa(doc: {
  tipo: string
  numero?: string
  dataEmissao?: string
  dataValidade?: string
  reutilizavel: boolean
  observacao?: string
  file: File
  criadoPor?: string
}): Promise<DocumentoEmpresa[]> {
  const enviado = await uploadAnexo(doc.file, PREFIXO_STORAGE)
  const { error } = await supabase.from('documentos_empresa').insert({
    tipo: doc.tipo,
    numero: doc.numero || null,
    dataEmissao: doc.dataEmissao || null,
    dataValidade: doc.dataValidade || null,
    reutilizavel: doc.reutilizavel,
    observacao: doc.observacao || null,
    path: enviado.path,
    filename: enviado.filename,
    mime: enviado.mime,
    size: enviado.size,
    criadoPor: doc.criadoPor,
  })
  if (error) {
    await removerDoStorage([enviado.path]).catch(() => { /* o erro do insert é o que importa */ })
    throw error
  }
  return listDocumentosEmpresa()
}

export async function updateDocumentoEmpresa(id: string, patch: Partial<DocumentoEmpresa>): Promise<DocumentoEmpresa[]> {
  const { error } = await supabase.from('documentos_empresa').update(patch).eq('id', id)
  if (error) throw error
  return listDocumentosEmpresa()
}

export async function removeDocumentoEmpresa(id: string): Promise<DocumentoEmpresa[]> {
  const { data: row } = await supabase.from('documentos_empresa').select('path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('documentos_empresa').delete().eq('id', id)
  if (error) throw error
  if (row?.path) await removerDoStorage([row.path]).catch(() => { /* documento já saiu da lista */ })
  return listDocumentosEmpresa()
}

// Dias até o vencimento (negativo = já venceu). Null quando o documento não
// tem validade cadastrada.
export function diasParaVencer(dataValidade: string | null | undefined, hoje: string): number | null {
  if (!dataValidade) return null
  const a = new Date(`${dataValidade}T00:00:00`)
  const b = new Date(`${hoje}T00:00:00`)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}
