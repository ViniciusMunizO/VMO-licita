import { supabase } from './supabaseClient'

// Anexos (de licitação e de ata/contrato) ficam no bucket "anexos" do Supabase
// Storage; no banco fica só o caminho do objeto. Antes o arquivo inteiro ia em
// base64 dentro da própria linha — inflava ~33% e fazia qualquer listagem
// baixar todos os anexos junto.
//
// O bucket é privado, então não existe URL fixa: cada abertura/download gera
// uma URL assinada de curta duração, que só o Storage emite pra quem está
// logado e ativo (política no schema.sql).
export const BUCKET_ANEXOS = 'anexos'

// Mesmo limite declarado no bucket (file_size_limit). Checar no cliente é só
// pra dar mensagem decente antes de subir 50 MB à toa — quem manda é o bucket.
export const MAX_ANEXO_BYTES = 50 * 1024 * 1024

// Uma hora: o suficiente pra abrir o arquivo e continuar com o modal aberto,
// curto o bastante pra um link vazado não virar acesso permanente.
const URL_VALIDADE_SEGUNDOS = 3600

export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return 'tamanho desconhecido'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.round(bytes / 1024)} KB`
}

// O nome vira parte da chave do objeto: acento, espaço e sinal solto atrapalham
// tanto a chave quanto o link assinado. O nome original continua na coluna
// `filename`, que é o que aparece na tela e no download.
export function sanitizarNome(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80) || 'arquivo'
}

export type AnexoEnviado = { path: string; filename: string; mime: string; size: number }

export async function uploadAnexo(f: File, prefixo: string): Promise<AnexoEnviado> {
  if (f.size > MAX_ANEXO_BYTES) {
    throw new Error(`O arquivo tem ${formatarTamanho(f.size)} e o limite é ${formatarTamanho(MAX_ANEXO_BYTES)}. Anexe uma versão menor (ou compactada).`)
  }
  const path = `${prefixo}/${crypto.randomUUID()}-${sanitizarNome(f.name)}`
  const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(path, f, {
    contentType: f.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(`Não consegui enviar o arquivo: ${error.message}`)
  return { path, filename: f.name, mime: f.type || 'application/octet-stream', size: f.size }
}

// Copia um objeto já existente no bucket pra um novo caminho, com nome novo
// (uuid) — usado por "Anexar da empresa": cada licitação precisa da sua
// própria cópia porque remover um anexo apaga o objeto do Storage
// (`removerDoStorage`), e isso não pode levar junto o documento original
// da empresa nem os anexos de outras licitações que usaram o mesmo documento.
export async function copiarNoStorage(pathOrigem: string, prefixoDestino: string, nomeOriginal: string, mime: string, size: number): Promise<AnexoEnviado> {
  const path = `${prefixoDestino}/${crypto.randomUUID()}-${sanitizarNome(nomeOriginal)}`
  const { error } = await supabase.storage.from(BUCKET_ANEXOS).copy(pathOrigem, path)
  if (error) throw new Error(`Não consegui copiar o arquivo: ${error.message}`)
  return { path, filename: nomeOriginal, mime, size }
}

export async function urlAssinada(path: string, baixarComo?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS)
    .createSignedUrl(path, URL_VALIDADE_SEGUNDOS, baixarComo ? { download: baixarComo } : undefined)
  if (error || !data?.signedUrl) throw new Error(`Não consegui gerar o link do arquivo: ${error?.message || 'link vazio'}`)
  return data.signedUrl
}

// Uma chamada só pra lista inteira — usado ao abrir o modal de anexos, pra não
// disparar uma requisição por linha. Caminho que falhar fica de fora do mapa.
export async function urlsAssinadas(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrls(paths, URL_VALIDADE_SEGUNDOS)
  if (error) throw new Error(`Não consegui gerar os links dos anexos: ${error.message}`)
  const mapa: Record<string, string> = {}
  for (const item of data || []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl
  }
  return mapa
}

export async function removerDoStorage(paths: string[]): Promise<void> {
  const validos = paths.filter(Boolean)
  if (validos.length === 0) return
  const { error } = await supabase.storage.from(BUCKET_ANEXOS).remove(validos)
  if (error) throw new Error(`Não consegui apagar o arquivo do armazenamento: ${error.message}`)
}

// ------------------------------------------------------------------
// Compatibilidade com os anexos gravados antes da migração pro Storage:
// eles têm `data` (data URI base64) e `path` nulo. Enquanto
// `scripts/migrar-anexos-storage.js` não tiver rodado em todos os ambientes,
// as duas formas convivem, e é aqui que a diferença fica isolada.
// ------------------------------------------------------------------

export type RefAnexo = { path?: string | null; data?: string | null; filename?: string | null; name?: string | null }

// Um data URI só é utilizável se tiver as duas partes ("data:mime;base64," e o
// conteúdo). A coluna aceita null, e linha antiga/truncada existe — sem essa
// checagem, um split solto derrubava a renderização do modal inteiro.
function lerDataURI(data: any): { mime: string; base64: string; size: number } | null {
  if (typeof data !== 'string' || !data.startsWith('data:')) return null
  const virgula = data.indexOf(',')
  if (virgula < 0) return null
  const base64 = data.slice(virgula + 1)
  if (!base64) return null
  return {
    mime: data.slice(5, virgula).split(';')[0] || 'application/octet-stream',
    base64,
    size: Math.round((base64.length * 3) / 4),
  }
}

export async function baixarAnexo(ref: RefAnexo): Promise<void> {
  const nome = ref.filename || ref.name || 'anexo'
  if (ref.path) {
    // O parâmetro `download` da URL assinada faz o próprio Storage mandar o
    // Content-Disposition, então o navegador salva em vez de exibir.
    window.location.href = await urlAssinada(ref.path, nome)
    return
  }
  const info = lerDataURI(ref.data)
  if (!info) throw new Error('O conteúdo deste anexo não está disponível.')
  const bstr = atob(info.base64)
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  const url = URL.createObjectURL(new Blob([u8arr], { type: info.mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
