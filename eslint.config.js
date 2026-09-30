import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'scripts/_shots', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Muita coisa no projeto usa `any` de propósito nas bordas com o
      // Supabase (dado vindo do banco não é tipado) — travar isso geraria
      // ruído sem achar bug de verdade. As regras de tipo continuam ativas
      // pro resto.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // `const { codigo, ...rest } = dados` pra tirar um campo antes de
        // gravar é um padrão comum no projeto (ver utils/licitacoes.ts,
        // utils/atas.ts) — `codigo` "não usado" ali é intencional.
        ignoreRestSiblings: true,
      }],
      // Regex/string com espaço não-separável de propósito (copiar/colar de
      // portal de licitação) — ver o comentário em utils/items.ts.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipRegExps: true, skipComments: true }],
      // `interface ImportMetaEnv {}` vazia é o padrão do Vite pra declaration
      // merging de env vars — não é o "objeto vazio perigoso" que a regra
      // normalmente pega.
      '@typescript-eslint/no-empty-object-type': 'off',
      // As duas regras abaixo são do conjunto novo (v7) voltado pro futuro
      // React Compiler — o projeto não usa o Compiler, então travar nelas
      // como erro pediria reescrever padrões comuns e hoje seguros (sincronizar
      // estado interno a partir de uma prop externa num useEffect, `Date.now()`
      // no corpo do componente) sem ganho de verdade agora. Mantidas como aviso.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      sourceType: 'commonjs',
    },
  }
)
