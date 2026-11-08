import baixista from './baixista.webp'

// Imagem da baixista (enviada pela Isabelle), com as bordas esfumadas no fundo.
export function EstudioArt() {
  return (
    <div className="hero-art hero-art-estudio" aria-hidden="true">
      <div className="estudio-figura">
        <img src={baixista} alt="" width={720} height={960} />
      </div>
    </div>
  )
}
