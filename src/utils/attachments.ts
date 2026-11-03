import { supabase } from './supabaseClient'
import { uploadAnexo, removerDoStorage, copiarNoStorage } from './arquivo'
import { paraApp, idDoProcesso, MAPA_ANEXO } from './banco'

const anexoParaTela = (linha: any, licitacaoCodigo: number | string) => ({ ...paraApp(MAPA_ANEXO, linha), licitacaoCodigo })

export async function listAttachments(licitacaoCodigo: number | string): Promise<any[]> {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { data, error } = await supabase.from('anexos').select('*').eq('processo_id', processoId).order('criado_em', { ascending: true })
  if (error) throw error
  return (data || []).map(l => anexoParaTela(l, licitacaoCodigo))
}

// Os anexos antigos em base64 (anteriores ao Storage) não existem no banco
// multiempresa, que começou do zero: todo anexo tem `path`.
export async function getAttachmentData(_id: string): Promise<string | null> {
  return null
}

async function gravarAnexo(licitacaoCodigo: number | string, nome: string, enviado: { path: string; filename: string; mime: string; size: number }) {
  const processoId = await idDoProcesso(licitacaoCodigo)
  const { error } = await supabase.from('anexos').insert({
    processo_id: processoId,
    nome,
    arquivo: enviado.filename,
    caminho: enviado.path,
    mime: enviado.mime,
    tamanho: enviado.size,
  })
  if (error) {
    // O arquivo já subiu; sem a linha ele viraria lixo invisível no bucket,
    // sem nenhuma tela por onde alguém pudesse achá-lo depois.
    await removerDoStorage([enviado.path]).catch(() => { /* o erro do insert é o que importa */ })
    throw error
  }
}

export async function addAttachment(licitacaoCodigo: number | string, att: { name: string; file: File }): Promise<any[]> {
  const enviado = await uploadAnexo(att.file, `licitacoes/${licitacaoCodigo}`)
  await gravarAnexo(licitacaoCodigo, att.name, enviado)
  return listAttachments(licitacaoCodigo)
}

// Reaproveita um documento do cofre da empresa (`documentos`) como anexo
// desta licitação. Copia o arquivo pra um caminho novo em vez de apontar pro
// mesmo objeto — sem isso, remover este anexo depois apagaria o documento
// original do Storage (`removeAttachment` chama `removerDoStorage`).
export async function addAttachmentFromDocumento(
  licitacaoCodigo: number | string,
  documento: { path: string; filename: string; mime: string; size: number; name?: string }
): Promise<any[]> {
  const copiado = await copiarNoStorage(documento.path, `licitacoes/${licitacaoCodigo}`, documento.filename, documento.mime, documento.size)
  await gravarAnexo(licitacaoCodigo, documento.name || documento.filename, copiado)
  return listAttachments(licitacaoCodigo)
}

export async function removeAttachment(id: string, licitacaoCodigo: number | string): Promise<any[]> {
  const { data: row } = await supabase.from('anexos').select('caminho').eq('id', id).maybeSingle()
  const { error } = await supabase.from('anexos').delete().eq('id', id)
  if (error) throw error
  // A linha sai primeiro de propósito: objeto órfão no bucket é desperdício,
  // mas linha apontando pra objeto que não existe mais é anexo quebrado na
  // tela do usuário.
  if (row?.caminho) await removerDoStorage([row.caminho]).catch(() => { /* anexo já saiu da lista */ })
  return listAttachments(licitacaoCodigo)
}
