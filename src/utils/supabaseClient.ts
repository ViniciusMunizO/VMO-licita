import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Falha alto e cedo: sem essas duas variáveis o app não tem pra onde
  // mandar dado nenhum — melhor um erro claro no console do que cada tela
  // quebrando de um jeito diferente mais tarde.
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — veja .env.example')
}

export const supabase = createClient(url, anonKey)
