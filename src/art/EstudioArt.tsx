import baixista from './baixista.webp'

// Imagem da baixista (enviada pela Isabelle) sobre um painel vermelho,
// com as bordas esfumadas no fundo escuro.
export function EstudioArt() {
  return (
    <div className="hero-art hero-art-estudio" aria-hidden="true">
      <div className="estudio-figura">
        <span className="estudio-painel" />
        <img src={baixista} alt="" width={720} height={960} />
      </div>
    </div>
  )
}
