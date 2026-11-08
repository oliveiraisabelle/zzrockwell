import { useEffect, useState } from 'react'

/** Tema atual (atributo data-theme do <html>), atualizado quando muda. */
export function useTheme(): string {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? '')
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme ?? ''))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}
