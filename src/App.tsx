import { useState, type DragEvent } from 'react'
import { HeroArt } from './HeroArt'
import { analyze, availableTargets, convert, parseL5x, L5xError, type ConversionResult, type L5xInfo } from './engine/l5x'

interface Loaded {
  name: string
  size: number
  xml: string
  info: L5xInfo
  targets: number[]
}

const TARGET_TYPES: Record<string, string> = {
  Controller: 'Projeto completo',
  Program: 'Programa',
  Routine: 'Rotina',
  Rung: 'Rung',
  AddOnInstructionDefinition: 'Add-On Instruction',
  DataType: 'Tipo de dado (UDT)',
  Module: 'Módulo',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function App() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [target, setTarget] = useState<number>()
  const [result, setResult] = useState<ConversionResult>()
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)

  async function onFile(file: File | undefined) {
    setLoaded(undefined)
    setResult(undefined)
    setError(undefined)
    if (!file) return
    try {
      const xml = await file.text()
      const info = analyze(parseL5x(xml))
      const targets = availableTargets(info)
      setLoaded({ name: file.name, size: file.size, xml, info, targets })
      setTarget(targets[targets.length - 1])
    } catch (e) {
      setError(e instanceof L5xError ? e.message : 'Não consegui ler o arquivo.')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    onFile(e.dataTransfer.files[0])
  }

  function onConvert() {
    if (!loaded || target === undefined) return
    try {
      setResult(convert(loaded.xml, target))
    } catch (e) {
      setError(e instanceof L5xError ? e.message : 'Erro inesperado na conversão.')
    }
  }

  function onDownload() {
    if (!loaded || !result?.output) return
    const blob = new Blob([result.output], { type: 'application/xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = outputName()
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function outputName() {
    return (loaded?.name ?? 'arquivo').replace(/\.(L5X|xml)$/i, '') + `_v${target}.L5X`
  }

  function reset() {
    setLoaded(undefined)
    setResult(undefined)
    setError(undefined)
  }

  const step = result ? 3 : loaded ? 2 : 1
  const blocks = result?.findings.filter((f) => f.severity === 'block') ?? []
  const reviews = result?.findings.filter((f) => f.severity === 'review') ?? []

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="2" y="2" width="28" height="28" rx="7" />
              <path d="M9 11h6M9 16h10M9 21h14" />
              <circle cx="22" cy="11" r="2.4" />
            </svg>
            <span>
              Conversor <strong>L5X</strong>
            </span>
          </div>
          <span className="privacy-pill">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Processado no seu navegador
          </span>
        </div>
      </header>

      <main>
        <section className="hero">
          <HeroArt />
          <h1>Rebaixe projetos L5X para versões anteriores do Logix Designer</h1>
          <p>
            Envie uma exportação L5X, escolha a versão de destino e receba o arquivo convertido com um relatório do que
            mudou e do que precisa de revisão. Nada sai do seu computador.
          </p>
        </section>

        <ol className="stepper" aria-label="Etapas">
          {['Arquivo', 'Versão de destino', 'Relatório'].map((label, i) => (
            <li key={label} className={step > i + 1 ? 'done' : step === i + 1 ? 'current' : ''}>
              <span className="dot">{step > i + 1 ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {!loaded && (
          <label
            className={`drop${dragging ? ' dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input type="file" accept=".l5x,.L5X,.xml" onChange={(e) => onFile(e.target.files?.[0])} />
            <svg className="drop-icon" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 6H13a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V16z" />
              <path d="M28 6v10h10" />
              <path d="M24 34V22M19 27l5-5 5 5" />
            </svg>
            <span className="drop-title">Arraste o arquivo .L5X aqui</span>
            <span className="drop-sub">
              ou <u>clique para escolher</u> · projeto completo, programa, rotina, AOI ou UDT
            </span>
          </label>
        )}

        {error && (
          <div className="alert alert-bad" role="alert">
            <strong>Não foi possível ler o arquivo.</strong> {error}
          </div>
        )}

        {loaded && (
          <section className="card">
            <div className="file-head">
              <div className="file-icon">L5X</div>
              <div className="file-meta">
                <div className="file-name">{loaded.name}</div>
                <div className="muted">{formatSize(loaded.size)}</div>
              </div>
              <button className="btn-ghost" onClick={reset}>
                Trocar arquivo
              </button>
            </div>

            <dl className="facts">
              <div>
                <dt>Versão atual</dt>
                <dd className="mono">v{loaded.info.softwareRevision}</dd>
              </div>
              <div>
                <dt>Conteúdo</dt>
                <dd>{TARGET_TYPES[loaded.info.targetType] ?? loaded.info.targetType}</dd>
              </div>
              <div>
                <dt>Controlador</dt>
                <dd className="mono">{loaded.info.processorType ?? '—'}</dd>
              </div>
              <div>
                <dt>Família</dt>
                <dd>{loaded.info.family?.name ?? (loaded.info.processorType ? 'Não reconhecida' : '—')}</dd>
              </div>
            </dl>

            <div className="divider" />

            <h2 className="card-title">Versão de destino</h2>
            {loaded.targets.length === 0 ? (
              <div className="alert alert-bad">Não há versão mais antiga disponível para este arquivo e controlador.</div>
            ) : (
              <>
                <p className="muted small">
                  Só aparecem versões anteriores à v{loaded.info.majorVersion}
                  {loaded.info.family && ` que a família ${loaded.info.family.name} suporta`}.
                </p>
                <div className="versions" role="radiogroup" aria-label="Versão de destino">
                  {loaded.targets.map((v) => (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={v === target}
                      className={`version${v === target ? ' selected' : ''}`}
                      onClick={() => {
                        setTarget(v)
                        setResult(undefined)
                      }}
                    >
                      v{v}
                    </button>
                  ))}
                </div>
                <div className="convert-row">
                  <span className="path mono">
                    v{loaded.info.majorVersion} <span className="arrow">→</span> v{target}
                  </span>
                  <button className="btn-primary" onClick={onConvert}>
                    Converter
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {result && (
          <section className="card report">
            <div className={`banner ${result.ok ? 'banner-ok' : 'banner-bad'}`}>
              <span className="banner-icon">{result.ok ? '✓' : '!'}</span>
              <div>
                <div className="banner-title">{result.ok ? 'Conversão concluída' : 'Conversão bloqueada'}</div>
                <div className="small">
                  {result.ok
                    ? `Arquivo pronto para a v${target}. Revise os pontos abaixo antes de importar.`
                    : `O arquivo usa recursos que não existem na v${target}. Resolva os itens abaixo ou escolha outra versão.`}
                </div>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-num">{result.changes.length}</span>
                <span className="stat-label">alterações</span>
              </div>
              <div className="stat stat-warn">
                <span className="stat-num">{reviews.length}</span>
                <span className="stat-label">para revisar</span>
              </div>
              <div className="stat stat-bad">
                <span className="stat-num">{blocks.length}</span>
                <span className="stat-label">impedimentos</span>
              </div>
            </div>

            {result.findings.length > 0 && (
              <>
                <h3>Pontos de atenção</h3>
                <ul className="findings">
                  {[...blocks, ...reviews].map((f) => (
                    <li key={f.message} className={`finding finding-${f.severity}`}>
                      <span className={`badge badge-${f.severity}`}>{f.severity === 'block' ? 'Impede' : 'Revisar'}</span>
                      <span className="finding-msg">{f.message}</span>
                      {f.count !== undefined && (
                        <span className="count">
                          {f.count} ocorrência{f.count === 1 ? '' : 's'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result.changes.length > 0 && (
              <>
                <h3>Alterações no arquivo</h3>
                <ul className="changes mono">
                  {result.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p className="muted small">O restante do arquivo foi mantido byte a byte.</p>
              </>
            )}

            {result.ok && (
              <div className="download-row">
                <button className="btn-primary btn-lg" onClick={onDownload}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                  </svg>
                  Baixar {outputName()}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="info-grid">
          <div>
            <h4>Privado por padrão</h4>
            <p>A conversão roda inteira no navegador. O código do CLP não é enviado para nenhum servidor.</p>
          </div>
          <div>
            <h4>Mudança mínima</h4>
            <p>Só os atributos de versão são reescritos. Lógica, tags e comentários ficam intactos.</p>
          </div>
          <div>
            <h4>Relatório de compatibilidade</h4>
            <p>Recursos e controladores que não existem na versão de destino são sinalizados antes do download.</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          Revise e teste o programa convertido antes de carregá-lo em um CLP. Este site não é afiliado à Rockwell
          Automation. Studio 5000 e Logix são marcas de seus respectivos donos.
        </div>
      </footer>
    </>
  )
}

export default App
