// Minimal IndexedDB key-value helper with migration from localStorage
const DB_NAME = 'licitavmo_db'
const STORE = 'kv'

// A single shared connection promise, reused for the lifetime of the page.
// Opening a fresh connection per call is not just wasteful: when the database
// doesn't exist yet, two concurrent indexedDB.open() calls (e.g. from React
// StrictMode invoking an effect twice) can race during creation and one of
// them can hang indefinitely. Caching the open promise means every caller
// awaits the same single open() attempt.
let dbPromise: Promise<IDBDatabase> | null = null

// Kicks off the (memoized) connection immediately, so the very first open()
// call happens exactly once, from a single call site, instead of being left
// to whichever component mounts first — which, under React StrictMode's
// double-invoked effects, could otherwise be two concurrent callers racing
// to create the database at once.
export function primeDB() {
  getDB().catch(() => { /* ignored here; real callers will surface the error */ })
}

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { dbPromise = null; reject(req.error) }
    })
  }
  return dbPromise
}

async function withStore(mode: IDBTransactionMode, cb: (store: IDBObjectStore) => void) {
  const db = await getDB()
  const tx = db.transaction(STORE, mode)
  const store = tx.objectStore(STORE)
  cb(store)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbSet(key: string, value: any) {
  try {
    await withStore('readwrite', store => { store.put(value, key) })
  } catch (e) {
    // fallback to localStorage
    localStorage.setItem(key, JSON.stringify(value))
  }
}

export async function dbGet(key: string) {
  try {
    const db = await getDB()
    return await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }
}

// Lê e grava um valor numa ÚNICA transação IndexedDB, em vez de um dbGet
// seguido de um dbSet separados. Isso importa porque duas abas/usuários
// mexendo na MESMA chave ao mesmo tempo (ex: a lista de licitações) com
// dbGet+dbSet correm risco clássico de "last write wins": as duas leem a
// lista antes de qualquer uma escrever, e a segunda a gravar apaga o que a
// primeira acabou de salvar. Transações "readwrite" no mesmo object store
// são serializadas pelo IndexedDB — a segunda chamada só começa a ler depois
// que a primeira transação (leitura+escrita) já terminou — então o updateFn
// sempre enxerga o valor mais recente, sem essa janela de corrida.
export async function dbUpdate<T = any>(key: string, updateFn: (current: T | undefined) => T): Promise<T> {
  const db = await getDB()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(key)
    getReq.onerror = () => reject(getReq.error)
    getReq.onsuccess = () => {
      let next: T
      try {
        next = updateFn(getReq.result)
      } catch (err) {
        tx.abort()
        reject(err)
        return
      }
      store.put(next, key)
      tx.oncomplete = () => resolve(next)
      tx.onerror = () => reject(tx.error)
    }
  })
}

export async function dbDelete(key: string) {
  try {
    await withStore('readwrite', store => { store.delete(key) })
  } catch (e) {
    localStorage.removeItem(key)
  }
}

// Migration helper: copy known keys from localStorage to IDB once
export async function migrateFromLocalStorage() {
  try {
    const done = localStorage.getItem('migrated_to_idb')
    if (done) return
    const keys = ['licitacoes', 'licitacao_next', 'empresas', 'empresa_next', 'users', 'users_next', 'contratantes', 'contratante_next']
    for (const k of keys) {
      const raw = localStorage.getItem(k)
      if (raw) await dbSet(k, JSON.parse(raw))
    }
    // migrate attachments and items keys (pattern)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key.startsWith('attachments_') || key.startsWith('items_')) {
        const raw = localStorage.getItem(key)
        if (raw) await dbSet(key, JSON.parse(raw))
      }
    }
    localStorage.setItem('migrated_to_idb', '1')
  } catch (e) {
    // ignore
  }
}
