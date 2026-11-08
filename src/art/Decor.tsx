import { useEffect, useState } from 'react'
import { useTheme } from './useTheme'

/** Enfeites de fundo de cada tema (cabos, calda escorrendo, notas musicais). */
export function Decor() {
  const theme = useTheme()
  if (theme === 'estudio') {
    return (
      <>
        <svg className="decor decor-gotico" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
          <path d="M-40 520V200C-40 110 20 50 60 20C100 50 160 110 160 200V520" /><path d="M200 520V200C200 110 260 50 300 20C340 50 400 110 400 200V520" /><path d="M440 520V200C440 110 500 50 540 20C580 50 640 110 640 200V520" /><path d="M680 520V200C680 110 740 50 780 20C820 50 880 110 880 200V520" /><path d="M920 520V200C920 110 980 50 1020 20C1060 50 1120 110 1120 200V520" /><path d="M1160 520V200C1160 110 1220 50 1260 20C1300 50 1360 110 1360 200V520" />
          <path d="M-10 520V215C-10 140 30 90 60 66C90 90 130 140 130 215V520" /><path d="M230 520V215C230 140 270 90 300 66C330 90 370 140 370 215V520" /><path d="M470 520V215C470 140 510 90 540 66C570 90 610 140 610 215V520" /><path d="M710 520V215C710 140 750 90 780 66C810 90 850 140 850 215V520" /><path d="M950 520V215C950 140 990 90 1020 66C1050 90 1090 140 1090 215V520" /><path d="M1190 520V215C1190 140 1230 90 1260 66C1290 90 1330 140 1330 215V520" />
        </svg>
        <svg className="decor decor-espinhos" viewBox="0 0 360 260" aria-hidden="true">
          <path d="M360 40C300 70 250 120 210 180S120 250 40 260" />
          <path d="M300 74l-10-22M262 104l18-14M236 136l-16-12M214 168l20-6M182 206l-8-20M150 228l14 12M110 246l-6-18M70 256l10 14" />
          <path d="M260 110C230 120 200 150 190 190" />
          <path d="M228 128l-6-14M206 156l14-2" />
        </svg>
      </>
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
