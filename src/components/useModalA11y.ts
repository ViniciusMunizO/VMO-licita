import { useEffect, useRef } from 'react'

const FOCAVEIS = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modais são um overlay por cima da tela inteira — sem isto, Tab continuava
// navegando o conteúdo por trás (o usuário "sai" do modal sem perceber), Esc
// não fechava nada, e ao fechar o foco nunca voltava pra quem abriu o modal
// (quem usa só teclado perdia o lugar e tinha que renavegar do topo da página).
export function useModalA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  // Atualiza a cada render (sem lista de dependências), não direto no corpo
  // da função — mexer em ref.current durante o render é o que o eslint
  // (react-hooks/refs) pega; dentro de um efeito sem deps é o jeito correto
  // de manter a versão mais recente do callback sem precisar re-registrar o
  // listener de teclado toda vez que o `onClose` do componente pai muda.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    gatilhoRef.current = document.activeElement as HTMLElement | null

    const focaveis = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCAVEIS) || []).filter(el => el.offsetParent !== null)
    focaveis()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const els = focaveis()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      gatilhoRef.current?.focus?.()
    }
  }, [open])

  return ref
}
