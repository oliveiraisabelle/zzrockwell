import baixista from './baixista.webp'

// Fan art da baixista vampira (imagem fornecida pela Isabelle), com moldura de
// pôster pregado e cabos pendurados.
export function EstudioArt() {
  return (
    <div className="hero-art hero-art-estudio" aria-hidden="true">
      <div className="estudio-poster">
        <img src={baixista} alt="" width={720} height={960} />
        <span className="tape tape-1" />
        <span className="tape tape-2" />
      </div>
    </div>
  )
}
