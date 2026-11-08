// Ilustração original: doces "derrotados" afundando numa poça de calda, estilo adesivo.
const INK = '#120c10'

function Eyes({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeWidth="3" strokeLinecap="round">
      <path d={`M${x - 14} ${y - 4}l8 8M${x - 6} ${y - 4}l-8 8M${x + 6} ${y - 4}l8 8M${x + 14} ${y - 4}l-8 8`} />
    </g>
  )
}

export function DoceArt() {
  return (
    <svg className="hero-art hero-art-doce" viewBox="0 0 320 300" aria-hidden="true">
      <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {/* poça de calda com borda escorrendo */}
        <path
          d="M30 150h260v110c-10 0-10 22-20 22s-10-14-20-14-12 26-24 26-10-20-22-20-12 14-24 14-10-24-22-24-12 18-24 18-10-12-22-12-12 22-24 22-12-18-22-18-12 10-24 10-12-20-22-20z"
          fill="#ff4f8b"
        />
        <path d="M60 180c20-6 40 6 60 0M180 230c20-6 40 6 60 0M90 250c14-4 26 4 40 0" fill="none" stroke="#ffb3cd" strokeWidth="4" />

        {/* maçã do amor afundando */}
        <path d="M96 40l18 92" strokeWidth="8" stroke={INK} />
        <path d="M96 40l18 92" strokeWidth="4" stroke="#b9895a" />
        <g className="doce-bob">
          <circle cx="112" cy="120" r="44" fill="#d61f3b" />
          <path d="M70 108c10-26 50-40 80-14 4 10-6 12-12 6-6 10-16 4-18-2-8 10-20 6-22-2-8 10-22 8-28 12z" fill="#7a3d1c" />
          <g stroke="none">
            <circle cx="96" cy="96" r="3" fill="#5ee0d0" />
            <circle cx="118" cy="90" r="3" fill="#ffe14d" />
            <circle cx="132" cy="100" r="3" fill="#5ee0d0" />
          </g>
          <Eyes x={112} y={124} />
          <path d="M104 146c4-6 12-6 16 0" fill="#7a1022" />
          <path d="M114 146c0 8 6 10 8 4" fill="#ff8fb3" strokeWidth="3" />
        </g>

        {/* ursinho de goma de cabeça para baixo */}
        <g transform="rotate(170 222 150)">
        <g className="doce-bob doce-bob-2">
          <circle cx="206" cy="96" r="12" fill="#ffd23f" />
          <circle cx="238" cy="96" r="12" fill="#ffd23f" />
          <circle cx="222" cy="120" r="30" fill="#ffd23f" />
          <path d="M196 150c0-20 52-20 52 0v28c0 10-52 10-52 0z" fill="#ffd23f" />
          <Eyes x={222} y={118} />
          <path d="M214 136h16" strokeWidth="3" />
        </g>
        </g>

        {/* serpente de alcaçuz espiando */}
        <path d="M262 218c18-30 46-22 44 2-2 18-24 20-34 10" fill="#4fc3ff" />
        <circle cx="290" cy="208" r="4" fill="#fff" />
        <circle cx="291" cy="208" r="1.8" fill={INK} stroke="none" />
        <path d="M300 224l12 6-10 4" fill="#ff8fb3" strokeWidth="3" />

        {/* bolhas */}
        <circle cx="54" cy="196" r="7" fill="#ffb3cd" className="bubble" />
        <circle cx="160" cy="212" r="5" fill="#ffb3cd" className="bubble bubble-2" />
        <circle cx="250" cy="172" r="6" fill="#ffb3cd" className="bubble bubble-3" />
      </g>
    </svg>
  )
}
