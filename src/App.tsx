import { useEffect, useState } from 'react'
import { BatSwarm, Decor } from './art/Decor'
import { L5xTool } from './tools/L5xTool'
import { Se12Tool } from './tools/Se12Tool'
import { SoonTool } from './tools/SoonTool'
import { TOOLS, TOOL_GROUPS, type ToolId } from './tools/catalog'

function currentTool(): ToolId {
  const id = location.hash.replace(/^#\/?/, '')
  return TOOLS.some((t) => t.id === id) ? (id as ToolId) : 'l5x'
}

type Mode = 'escuro' | 'claro'

function readMode(): Mode {
  if (document.documentElement.dataset.theme === 'claro') return 'claro'
  try {
    return localStorage.getItem('modo') === 'claro' ? 'claro' : 'escuro'
  } catch {
    return 'escuro'
  }
}

// O tema "escuro" é o que veio no <html> (Estúdio, ou o de ?tema=).
// Lido na primeira renderização, depois que o main.tsx aplicou o ?tema=.
function readDarkTheme(): string {
  const t = document.documentElement.dataset.theme
  return t && t !== 'claro' ? t : 'estudio'
}

function App() {
  const [tool, setTool] = useState<ToolId>(currentTool)
  const [mode, setMode] = useState<Mode>(readMode)
  const [darkTheme] = useState(readDarkTheme)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onHash = () => {
      setTool(currentTool())
      setMenuOpen(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // O Estúdio tem o próprio modo claro; os outros temas usam o tema "claro" de sempre.
    const root = document.documentElement
    if (darkTheme === 'estudio') {
      root.dataset.theme = 'estudio'
      if (mode === 'claro') root.dataset.modo = 'claro'
      else delete root.dataset.modo
    } else {
      root.dataset.theme = mode === 'claro' ? 'claro' : darkTheme
      delete root.dataset.modo
    }
    try {
      localStorage.setItem('modo', mode)
    } catch {
      // sem armazenamento: vale só nesta visita
    }
  }, [mode, darkTheme])

  const active = TOOLS.find((t) => t.id === tool)!
  useEffect(() => {
    document.title = `${active.name} · Caixa de Ferramentas`
  }, [active])

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="menu-btn"
            aria-label="Abrir menu de ferramentas"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <a className="brand" href="#/l5x" onDoubleClick={() => window.dispatchEvent(new Event('morcegos'))}>
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="2" y="2" width="28" height="28" rx="7" />
              <path d="M9 11h6M9 16h10M9 21h14" />
              <circle cx="22" cy="11" r="2.4" />
            </svg>
            <span>
              Caixa de <strong>Ferramentas</strong>
            </span>
          </a>
          <div className="topbar-right">
            <span className="privacy-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Processado no seu navegador
            </span>
            <button
              className="mode-btn"
              onClick={() => setMode((m) => (m === 'claro' ? 'escuro' : 'claro'))}
              aria-label={mode === 'claro' ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
              title={mode === 'claro' ? 'Modo escuro' : 'Modo claro'}
            >
              {mode === 'claro' ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <BatSwarm />
      <div className="shell">
        <Decor />
        <nav className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Ferramentas">
          {TOOL_GROUPS.map((g) => (
            <div key={g.id} className="nav-group">
              <div className="nav-group-title">{g.label}</div>
              {TOOLS.filter((t) => t.group === g.id).map((t) => (
                <a
                  key={t.id}
                  href={`#/${t.id}`}
                  className={`nav-item${t.id === tool ? ' active' : ''}${t.ready ? '' : ' soon'}`}
                  aria-current={t.id === tool ? 'page' : undefined}
                >
                  <span className="nav-name">{t.name}</span>
                  <span className="nav-tag">{t.ready ? t.tag : 'em breve'}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

        <main>
          {tool === 'l5x' ? <L5xTool /> : tool === 'telas-se12' ? <Se12Tool key={tool} /> : <SoonTool tool={active} />}
        </main>
      </div>

      <footer>
        <div className="footer-inner">
          Revise e teste os arquivos gerados antes de usar em um CLP ou supervisório. Este site não é afiliado à Rockwell
          Automation. Studio 5000, Logix e FactoryTalk são marcas de seus respectivos donos.
        </div>
      </footer>
    </>
  )
}

export default App
