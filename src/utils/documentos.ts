import { supabase } from './supabaseClient'
import { uploadAnexo, removerDoStorage } from './arquivo'
import { empresaAtual, paraApp, paraBanco, nomesDaEmpresa, MAPA_DOCUMENTO } from './banco'

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

// O cofre da empresa mora na tabela `documentos`.
export async function listDocumentosEmpresa(): Promise<DocumentoEmpresa[]> {
  const { data, error } = await supabase.from('documentos').select('*').eq('empresa_id', empresaAtual()).order('tipo', { ascending: true })
  if (error) throw error
  const nomes = await nomesDaEmpresa()
  return (data || []).map(l => ({ ...paraApp(MAPA_DOCUMENTO, l), criadoPor: nomes[l.criado_por] }))
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
  const { error } = await supabase.from('documentos').insert({
    ...paraBanco(MAPA_DOCUMENTO, {
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
    }),
    empresa_id: empresaAtual(),
  })
  if (error) {
    await removerDoStorage([enviado.path]).catch(() => { /* o erro do insert é o que importa */ })
    throw error
  }
  return listDocumentosEmpresa()
}

export async function updateDocumentoEmpresa(id: string, patch: Partial<DocumentoEmpresa>): Promise<DocumentoEmpresa[]> {
  const { error } = await supabase.from('documentos').update(paraBanco(MAPA_DOCUMENTO, patch)).eq('id', id)
  if (error) throw error
  return listDocumentosEmpresa()
}

export async function removeDocumentoEmpresa(id: string): Promise<DocumentoEmpresa[]> {
  const { data: row } = await supabase.from('documentos').select('caminho').eq('id', id).maybeSingle()
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  if (error) throw error
  if (row?.caminho) await removerDoStorage([row.caminho]).catch(() => { /* documento já saiu da lista */ })
  return listDocumentosEmpresa()
}
