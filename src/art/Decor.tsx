import { useEffect, useState } from 'react'
import { useTheme } from './useTheme'

/** Enfeites de fundo de cada tema (cabos, calda escorrendo, notas musicais). */
export function Decor() {
  const theme = useTheme()
  if (theme === 'estudio') {
    return (
      <svg className="decor decor-cabos" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-20 2C200 40 380 38 520 6" />
        <path d="M300 0C420 34 640 36 760 4" className="cabo-vermelho" />
        <path d="M640 2C820 42 1000 32 1220 4" />
        <path d="M900 0C980 24 1100 26 1220 12" className="cabo-vermelho" />
      </svg>
    )
  }
  if (theme === 'doce') {
    return (
      <svg className="decor decor-calda" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h1200v14c-20 0-24 30-40 30s-14-22-34-22-18 40-38 40-16-30-36-30-20 18-40 18-16-26-36-26-18 36-40 36-14-24-34-24-20 14-40 14-18-30-38-30-20 44-40 44-18-34-38-34-18 20-40 20-16-28-36-28-20 38-40 38-14-20-34-20-20 26-40 26-18-30-38-30-18 18-40 18-16-24-36-24-20 34-40 34-16-22-36-22-18 16-40 16-18-28-38-28-20 40-40 40-16-30-36-30-20 20-40 20-14-18-34-18-20 30-40 30-18-26-38-26-18 22-40 22-16-30-36-30-20 18-40 18-18-24-38-24-20 36-40 36-14-28-34-28-20 20-40 20-16-16-36-16-20 30-40 30-16-24-36-24V0z" />
      </svg>
    )
  }
  if (theme === 'quarto') {
    return (
      <div className="decor decor-notas" aria-hidden="true">
        {['♪', '♫', '★', '♪', '✦', '♫', '♪', '★'].map((c, i) => (
          <span key={i} className={`nota nota-${i}`}>
            {c}
          </span>
        ))}
      </div>
    )
  }
  return null
}

const SECRETS = ['rock', 'baixo', 'vampira']

/** Segredo: digite "rock" (ou "baixo") em qualquer lugar e uma revoada de morcegos atravessa a tela. */
export function BatSwarm() {
  const [run, setRun] = useState(0)

  useEffect(() => {
    let buffer = ''
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key.length !== 1) return
      buffer = (buffer + e.key.toLowerCase()).slice(-12)
      if (SECRETS.some((s) => buffer.endsWith(s))) {
        buffer = ''
        setRun((n) => n + 1)
      }
    }
    const onSummon = () => setRun((n) => n + 1)
    window.addEventListener('keydown', onKey)
    window.addEventListener('morcegos', onSummon)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('morcegos', onSummon)
    }
  }, [])

  useEffect(() => {
    if (!run) return
    document.body.classList.add('tremor')
    const t1 = setTimeout(() => document.body.classList.remove('tremor'), 500)
    const t2 = setTimeout(() => setRun(0), 3600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [run])

  if (!run) return null
  return (
    <div className="bats" key={run} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <svg
          key={i}
          className="bat"
          viewBox="0 0 60 24"
          style={{ top: `${8 + ((i * 37) % 80)}%`, animationDelay: `${(i * 0.13) % 1.2}s`, ['--s' as string]: 0.6 + ((i * 7) % 5) / 6 }}
        >
          <path d="M0 6c8-4 14 0 16 6 2-4 6-6 9-4l2-5 2 5c3-2 7 0 9 4 2-6 8-10 16-6-7 3-9 8-9 13-6-3-11-1-14 3-2-3-5-3-5-3s-3 0-5 3c-3-4-8-6-14-3 0-5-2-10-9-13z" />
        </svg>
      ))}
    </div>
  )
}
