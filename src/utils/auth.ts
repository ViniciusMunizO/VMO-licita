import { dbGet, dbSet, dbUpdate, migrateFromLocalStorage } from './db'

export type StoredUser = {
  id: number
  name: string
  login: string
  password: string
  role: 'admin' | 'moderador' | 'user'
}

const USERS_KEY = 'users'

// Usuário criado automaticamente se nenhum outro existir, para o primeiro
// acesso ao sistema não ficar travado (a página de Usuários exige estar
// logado como admin, então alguém precisa conseguir entrar antes de existir
// qualquer usuário cadastrado).
const DEFAULT_ADMIN: StoredUser = { id: 1, name: 'Administrador', login: 'admin', password: 'admin', role: 'admin' }

export async function getUsers(): Promise<StoredUser[]> {
  await migrateFromLocalStorage()
  return (await dbGet(USERS_KEY)) || []
}

export async function saveUsers(users: StoredUser[]) {
  await dbSet(USERS_KEY, users)
}

export async function ensureDefaultAdmin() {
  const users = await getUsers()
  if (users.length === 0) {
    await saveUsers([DEFAULT_ADMIN])
  }
}

export async function findUserByCredentials(login: string, password: string): Promise<StoredUser | null> {
  const users = await getUsers()
  return users.find(u => u.login === login && u.password === password) || null
}

// Checa duplicidade de login e grava o novo usuário numa única transação
// atômica (ver dbUpdate) — sem isso, duas pessoas criando um usuário com o
// mesmo login ao mesmo tempo poderiam passar pela checagem antes de
// qualquer uma salvar, e a segunda gravação apagaria a primeira.
export async function addUser(input: { name: string; login: string; password: string; role: StoredUser['role'] }): Promise<
  { ok: true; user: StoredUser; users: StoredUser[] } | { ok: false; reason: 'duplicate' }
> {
  const loginTrimmed = input.login.trim()
  let duplicate = false
  let created: StoredUser | null = null
  const users = await dbUpdate<StoredUser[]>(USERS_KEY, (current) => {
    const atual = current || []
    if (atual.some(u => u.login.toLowerCase() === loginTrimmed.toLowerCase())) {
      duplicate = true
      return atual
    }
    const nextId = atual.reduce((max, u) => Math.max(max, u.id), 0) + 1
    const novo: StoredUser = { id: nextId, name: input.name.trim(), login: loginTrimmed, password: input.password, role: input.role }
    created = novo
    return [...atual, novo]
  })
  if (duplicate || !created) return { ok: false, reason: 'duplicate' }
  return { ok: true, user: created, users }
}
