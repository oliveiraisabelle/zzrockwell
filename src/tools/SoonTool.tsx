import { HeroArt } from '../HeroArt'
import type { ToolInfo } from './catalog'

export function SoonTool({ tool }: { tool: ToolInfo }) {
  return (
    <section className="hero soon-page">
      <HeroArt />
      <span className="soon-badge">Em construção</span>
      <h1>{tool.name}</h1>
      <p>{tool.summary}</p>
      <div className="card">
        <h2 className="card-title">O que ela vai fazer</h2>
        <ul className="soon-list">
          {tool.plans.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="muted small">Como as outras, vai rodar só no seu navegador.</p>
      </div>
      <a className="btn-ghost back-link" href="#/l5x">
        ← Voltar ao Conversor L5X
      </a>
    </section>
  )
}
