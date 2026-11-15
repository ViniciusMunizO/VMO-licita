module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta do sistema (15/11/2026). As telas usam as variáveis --color-* de
        // src/styles/index.css; estas classes ficam iguais para não haver duas paletas.
        primary: '#0B3D3B',
        secondary: '#99F6E4',
        accent: '#14B8A6',
        error: '#EF4136',
        // O fundo das páginas usa `bg-gray-50` em várias telas: aqui ele vira o
        // Background da paleta (#F8FFFE, quase branco com um toque de menta).
        gray: { 50: '#F8FFFE' }
      }
    }
  },
  plugins: []
}
