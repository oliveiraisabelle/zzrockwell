// Ilustração original: quarto de músico visto de cima, traço grosso e cores chapadas.
const INK = '#3a1a26'

export function QuartoArt() {
  return (
    <svg className="hero-art hero-art-quarto" viewBox="0 0 340 280" aria-hidden="true">
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {/* tapete */}
        <path d="M150 40h170v200H150z" fill="#e8607a" />
        <path d="M150 40h170v200H150z" fill="none" strokeDasharray="1 11" strokeWidth="5" stroke="#ffd1d8" />
        <path d="M170 60h130v160H170z" fill="#f28aa0" />
        <path d="M205 120q30-34 60 0q-30 34-60 0z" fill="#ffd36b" />

        {/* pufe */}
        <path d="M40 120c0-40 40-62 80-56s64 40 56 80-50 66-92 58S40 160 40 120z" fill="#f08a3c" />
        <path d="M70 110c10-14 30-20 46-14" fill="none" stroke="#c4621f" />
        <path d="M66 150l6 4M120 176l5-6M150 120l6 2" stroke="#7a3a12" strokeWidth="2.5" />

        {/* baixo em forma de machado */}
        <g className="quarto-bass">
          <path d="M62 222l40-34 18 6 8 18-34 40-20-6z" fill="#c4182f" />
          <path d="M70 226l30-24" stroke="#7e0d1e" strokeWidth="2" />
          <path d="M112 196l118-118" strokeWidth="10" stroke={INK} />
          <path d="M112 196l118-118" strokeWidth="5" stroke="#6b3a24" />
          <path d="M226 70l18-18 10 4-2 12-16 14z" fill="#2a1a20" />
          <g className="string" stroke="#fff3e8" strokeWidth="1">
            <path d="M86 214l146-146" />
            <path d="M90 218l146-146" />
          </g>
          <circle cx="98" cy="232" r="3.5" fill={INK} />
        </g>

        {/* toca-discos */}
        <rect x="236" y="164" width="88" height="70" rx="6" fill="#6a4bc4" />
        <circle cx="272" cy="199" r="27" fill="#1d1418" />
        <circle cx="272" cy="199" r="16" fill="none" stroke="#3a2c33" strokeWidth="2" className="vinyl-groove" />
        <circle cx="272" cy="199" r="7" fill="#ffd36b" />
        <path d="M312 176l-10 30" strokeWidth="3.5" />

        {/* planta */}
        <circle cx="300" cy="44" r="16" fill="#9c5a3a" />
        <path d="M300 44c-30-22-36 2-30 10 8 8 22 0 30-10zM300 44c26-28 40-6 34 4-6 8-22 4-34-4zM300 44c-6-34 18-38 20-26 2 10-8 20-20 26z" fill="#2fb59a" />

        {/* xícara e biscoitos */}
        <circle cx="34" cy="40" r="15" fill="#9fe0e6" />
        <circle cx="34" cy="40" r="9" fill="#6b3a24" />
        <path d="M49 40h8" strokeWidth="4" />
        <g fill="#c98a4a">
          <circle cx="92" cy="28" r="12" />
          <circle cx="114" cy="38" r="10" />
        </g>
        <g fill={INK} stroke="none">
          <circle cx="88" cy="25" r="2" />
          <circle cx="96" cy="31" r="2" />
          <circle cx="112" cy="35" r="2" />
        </g>
        <path className="steam" d="M28 18c-4-6 4-8 0-14M40 18c-4-6 4-8 0-14" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.8" />

        {/* fitas cassete */}
        <g transform="rotate(-14 22 230)">
          <rect x="4" y="214" width="44" height="28" rx="3" fill="#ffd36b" />
          <rect x="12" y="222" width="28" height="10" rx="2" fill="#fff" />
          <circle cx="19" cy="227" r="2.5" fill={INK} />
          <circle cx="33" cy="227" r="2.5" fill={INK} />
        </g>
        <g transform="rotate(10 30 262)">
          <rect x="8" y="250" width="44" height="26" rx="3" fill="#2fb59a" />
          <rect x="16" y="257" width="28" height="9" rx="2" fill="#fff" />
        </g>
      </g>
    </svg>
  )
}
