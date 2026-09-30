import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy real é só Render, servindo na raiz do domínio (ver render.yaml,
// que já faz rewrite de rota pro index.html). O suporte a GitHub Pages num
// subcaminho foi removido junto com public/404.html — nunca chegou a ter
// um workflow publicando de lá.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
