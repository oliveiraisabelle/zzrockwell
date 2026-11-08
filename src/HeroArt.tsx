import { DoceArt } from './art/DoceArt'
import { EstudioArt } from './art/EstudioArt'
import { QuartoArt } from './art/QuartoArt'
import { useTheme } from './art/useTheme'

/** Ilustração do topo de cada ferramenta, de acordo com o tema. */
export function HeroArt() {
  const theme = useTheme()
  if (theme === 'quarto') return <QuartoArt />
  if (theme === 'doce') return <DoceArt />
  if (theme === 'estudio') return <EstudioArt />
  return <BaixoArt />
}

/** Ilustração original: baixo vermelho sob a lua, com um morcego. */
function BaixoArt() {
  return (
    <svg className="hero-art hero-art-baixo" viewBox="0 0 260 300" aria-hidden="true">
      <defs>
        <radialGradient id="moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d8d2d6" />
          <stop offset="70%" stopColor="#a8a0a6" />
          <stop offset="100%" stopColor="#7d757b" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b3263a" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#b3263a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d1263f" />
          <stop offset="55%" stopColor="#9c1427" />
          <stop offset="100%" stopColor="#5e0a17" />
        </linearGradient>
      </defs>

      <circle cx="170" cy="96" r="88" fill="url(#glow)" />
      <circle cx="170" cy="96" r="58" fill="url(#moon)" opacity="0.9" />
      <circle cx="152" cy="80" r="9" fill="#8d858b" opacity="0.5" />
      <circle cx="186" cy="114" r="6" fill="#8d858b" opacity="0.45" />
      <circle cx="190" cy="74" r="4" fill="#8d858b" opacity="0.4" />

      {/* morcego */}
      <path
        d="M58 58c6-2 10 1 12 5 2-3 5-4 7-3l1-4 2 4c2-1 5 0 7 3 2-4 6-7 12-5-5 2-7 6-7 10-4-2-8-1-10 2-2-2-4-2-4-2s-2 0-4 2c-2-3-6-4-10-2 0-4-2-8-6-10z"
        fill="#0b0a0c"
        stroke="#3a2a2e"
        strokeWidth="1"
      />

      <g transform="rotate(32 130 170)">
        {/* mão */}
        <path d="M117 6h26l-3 52h-20z" fill="#1a1416" stroke="#4a1a22" strokeWidth="1.5" />
        {[14, 26, 38, 50].map((y, i) => (
          <g key={y}>
            <circle cx={i % 2 ? 147 : 113} cy={y} r="3.6" fill="#c9c2c6" />
          </g>
        ))}
        {/* braço */}
        <rect x="121" y="56" width="18" height="150" rx="2" fill="#241a1c" stroke="#3b2328" strokeWidth="1" />
        {[70, 86, 101, 115, 128, 140, 151, 161, 170, 178, 186, 193].map((y) => (
          <line key={y} x1="121" x2="139" y1={y} y2={y} stroke="#8a7f84" strokeWidth="0.8" />
        ))}
        {[108, 134, 157, 180].map((y) => (
          <circle key={y} cx="130" cy={y} r="1.6" fill="#d8d2d6" />
        ))}
        {/* corpo */}
        <path
          d="M118 196c-10-8-30-12-40-2-11 11-4 27-12 40-8 14-6 34 10 46 20 15 56 15 78 2 17-10 21-30 12-46-7-13 2-30-10-42-11-11-28-6-38 2z"
          fill="url(#body)"
          stroke="#2a080e"
          strokeWidth="2"
        />
        <path
          d="M110 204c-10-4-22-3-27 5-5 9 1 18-5 28-5 8-3 18 3 22l39-6z"
          fill="#0f0b0c"
          opacity="0.85"
        />
        {/* captador e ponte */}
        <rect x="116" y="228" width="28" height="11" rx="2" fill="#0b0a0c" />
        <rect x="117" y="262" width="26" height="9" rx="1.5" fill="#bdb5ba" />
        {/* cordas */}
        {[125, 128.5, 131.5, 135].map((x) => (
          <line className="string" key={x} x1={x} x2={x} y1="56" y2="266" stroke="#e6e0e3" strokeWidth="0.7" opacity="0.85" />
        ))}
        {/* botões */}
        <circle cx="158" cy="262" r="4.5" fill="#0b0a0c" stroke="#bdb5ba" strokeWidth="1" />
        <circle cx="150" cy="278" r="4.5" fill="#0b0a0c" stroke="#bdb5ba" strokeWidth="1" />
      </g>
    </svg>
  )
}
