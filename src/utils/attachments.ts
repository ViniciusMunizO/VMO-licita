import { supabase } from './supabaseClient'
import { uploadAnexo, removerDoStorage } from './arquivo'

// Nunca traz a coluna `data` (base64 dos anexos antigos, anteriores ao
// Storage): listar anexo é listar nome e tamanho, e arrastar o conteúdo de
// cada arquivo junto fazia a tela de detalhe baixar megabytes à toa. Quando um
// anexo antigo precisa ser aberto, o conteúdo vem sob demanda em
// `getAttachmentData`.
const COLUNAS = 'id,licitacaoCodigo,name,filename,path,mime,size,date'

export async function listAttachments(licitacaoCodigo: number | string): Promise<any[]> {
  const { data, error } = await supabase.from('attachments').select(COLUNAS).eq('licitacaoCodigo', licitacaoCodigo).order('date', { ascending: true })
  if (error) throw error
  return data || []
}

// Só pros anexos gravados antes da migração pro Storage (`path` nulo).
export async function getAttachmentData(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('attachments').select('data').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.data ?? null
}

export async function addAttachment(licitacaoCodigo: number | string, att: { name: string; file: File }): Promise<any[]> {
  const enviado = await uploadAnexo(att.file, `licitacoes/${licitacaoCodigo}`)
  const { error } = await supabase.from('attachments').insert({
    licitacaoCodigo,
    name: att.name,
    filename: enviado.filename,
    path: enviado.path,
    mime: enviado.mime,
    size: enviado.size,
  })
  if (error) {
    // O arquivo já subiu; sem a linha ele viraria lixo invisível no bucket,
    // sem nenhuma tela por onde alguém pudesse achá-lo depois.
    await removerDoStorage([enviado.path]).catch(() => { /* o erro do insert é o que importa */ })
    throw error
  }
  return listAttachments(licitacaoCodigo)
}

export async function removeAttachment(id: string, licitacaoCodigo: number | string): Promise<any[]> {
  const { data: row } = await supabase.from('attachments').select('path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('attachments').delete().eq('id', id)
  if (error) throw error
  // A linha sai primeiro de propósito: objeto órfão no bucket é desperdício,
  // mas linha apontando pra objeto que não existe mais é anexo quebrado na
  // tela do usuário.
  if (row?.path) await removerDoStorage([row.path]).catch(() => { /* anexo já saiu da lista */ })
  return listAttachments(licitacaoCodigo)
}
