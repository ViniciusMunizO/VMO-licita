import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serve o projeto num subcaminho (https://usuario.github.io/LicitaVMO/);
// Render e o dev local servem na raiz do domínio. Como os dois ambientes rodam
// o mesmo "vite build", o base não pode depender do comando — só a action do
// GitHub Pages define GITHUB_PAGES=true (ver .github/workflows/deploy-pages.yml).
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/LicitaVMO/' : '/',
  server: {
    port: 5173
  }
})
