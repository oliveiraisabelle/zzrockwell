import { useMemo, useState, type DragEvent } from 'react'
import { HeroArt } from '../HeroArt'
import { CONTROLLER_GROUPS } from '../engine/controllers'
import { diffLines } from '../engine/diff'
import {
  analyze,
  availableTargets,
  convert,
  isControllerChange,
  parseL5x,
  L5xError,
  type ConversionResult,
  type L5xInfo,
} from '../engine/l5x'
import { forgetSignature, learnSignature, loadSignatures, type Signatures } from '../engine/signature'
import { ROUTINE_TYPES, xray, type XRay } from '../engine/xray'

interface Loaded {
  name: string
  size: number
  xml: string
  doc: Document
  info: L5xInfo
  xray: XRay
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

const num = (n: number) => n.toLocaleString('pt-BR')

export function L5xTool() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [cpu, setCpu] = useState('')
  const [target, setTarget] = useState<number>()
  const [result, setResult] = useState<ConversionResult>()
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [signatures, setSignatures] = useState<Signatures>(loadSignatures)

  const targets = useMemo(() => (loaded ? availableTargets(loaded.info, cpu || undefined) : []), [loaded, cpu])
  const changingCpu = !!loaded && isControllerChange(loaded.info, cpu || undefined)
  const diff = useMemo(() => (loaded && result?.output ? diffLines(loaded.xml, result.output) : []), [loaded, result])

  async function onFile(file: File | undefined) {
    setLoaded(undefined)
    setResult(undefined)
    setError(undefined)
    setCpu('')
    if (!file) return
    try {
      const xml = await file.text()
      const doc = parseL5x(xml)
      const info = analyze(doc)
      setLoaded({ name: file.name, size: file.size, xml, doc, info, xray: xray(doc) })
      const t = availableTargets(info)
      setTarget(t[t.length - 1])
    } catch (e) {
      setError(e instanceof L5xError ? e.message : 'Não consegui ler o arquivo.')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    onFile(e.dataTransfer.files[0])
  }

  function onCpu(value: string) {
    setCpu(value)
    setResult(undefined)
    if (!loaded) return
    const t = availableTargets(loaded.info, value || undefined)
    if (target === undefined || !t.includes(target)) setTarget(t[t.length - 1])
  }

  function onConvert() {
    if (!loaded || target === undefined) return
    try {
      setResult(convert(loaded.xml, target, { processorType: cpu || undefined, learned: signatures[target] }))
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
    const base = (loaded?.name ?? 'arquivo').replace(/\.(L5X|xml)$/i, '')
    const cpuPart = changingCpu ? `_${cpu}` : ''
    return `${base}_v${target}${cpuPart}.L5X`
  }

  function reset() {
    setLoaded(undefined)
    setResult(undefined)
    setError(undefined)
    setCpu('')
  }

  const step = result ? 3 : loaded ? 2 : 1
  const blocks = result?.findings.filter((f) => f.severity === 'block') ?? []
  const reviews = result?.findings.filter((f) => f.severity === 'review') ?? []
  const learnedVersions = Object.keys(signatures)
    .map(Number)
    .sort((a, b) => b - a)
  const x = loaded?.xray

  return (
    <>
      <section className="hero">
        <HeroArt />
        <h1>Rebaixe projetos L5X para versões anteriores do Logix Designer</h1>
        <p>
          Envie uma exportação L5X, escolha a versão e, se quiser, o novo modelo de CLP. Você recebe o arquivo convertido,
          um raio-X do projeto e a comparação do que mudou. Nada sai do seu computador.
        </p>
        <details className="howto">
          <summary>Como usar</summary>
          <ol>
            <li>No Studio 5000, exporte o projeto (ou rotina, AOI, UDT) como .L5X.</li>
            <li>Arraste o arquivo aqui. O raio-X mostra o que tem dentro.</li>
            <li>Escolha a versão de destino. Em projeto completo, dá para trocar o modelo do CLP também.</li>
            <li>Clique em Converter, confira os pontos de atenção e a comparação, e baixe o arquivo.</li>
            <li>
              Opcional: em <b>Aprender versão</b>, envie uma exportação real de cada versão. Na próxima conversão para
              ela, o site avisa o que o seu arquivo usa e nunca apareceu naquela versão.
            </li>
          </ol>
        </details>
      </section>

      <ol className="stepper" aria-label="Etapas">
        {['Arquivo', 'Destino', 'Relatório'].map((label, i) => (
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
          <strong>Não foi possível continuar.</strong> {error}
        </div>
      )}

      {loaded && x && (
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

          <details className="xray" open>
            <summary>Raio-X do arquivo</summary>
            <div className="xray-grid">
              <XStat n={x.programs} label="programas" />
              <XStat n={Object.values(x.routines).reduce((a, b) => a + b, 0)} label="rotinas" />
              <XStat n={x.rungs} label="rungs" />
              <XStat n={x.controllerTags + x.programTags} label="tags" />
              <XStat n={x.dataTypes} label="UDTs" />
              <XStat n={x.addOns} label="AOIs" />
              <XStat n={x.tasks} label="tarefas" />
              <XStat n={x.modules.length} label="módulos" />
            </div>
            {Object.keys(x.routines).length > 0 && (
              <p className="muted small">
                Rotinas:{' '}
                {Object.entries(x.routines)
                  .map(([t, n]) => `${num(n)} em ${ROUTINE_TYPES[t] ?? t}`)
                  .join(' · ')}
                {x.controllerTags + x.programTags > 0 &&
                  ` · Tags: ${num(x.controllerTags)} do controlador e ${num(x.programTags)} de programa`}
              </p>
            )}
            {x.modules.length > 0 && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th>Catálogo</th>
                      <th>Revisão</th>
                      <th>Ligado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.modules.map((m) => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td className="mono">{m.catalog || '—'}</td>
                        <td className="mono">{m.revision || '—'}</td>
                        <td>{m.parent && m.parent !== m.name ? m.parent : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <div className="divider" />

          {loaded.info.targetType === 'Controller' && loaded.info.processorType && (
            <>
              <h2 className="card-title">Controlador</h2>
              <p className="muted small">Troque o modelo do CLP junto com a versão, ou mantenha o atual.</p>
              <select className="select mono" value={cpu} onChange={(e) => onCpu(e.target.value)} aria-label="Novo controlador">
                <option value="">Manter {loaded.info.processorType}</option>
                {CONTROLLER_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.models.map((m) => (
                      <option key={m.catalog} value={m.catalog} disabled={m.catalog === loaded.info.processorType}>
                        {m.catalog}
                        {m.safety ? ' (segurança)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="spacer" />
            </>
          )}

          <h2 className="card-title">Versão de destino</h2>
          {targets.length === 0 ? (
            <div className="alert alert-bad">Não há versão disponível para este arquivo e controlador.</div>
          ) : (
            <>
              <p className="muted small">
                {changingCpu
                  ? `Versões que o ${cpu} suporta, até a v${loaded.info.majorVersion} do arquivo.`
                  : `Só aparecem versões anteriores à v${loaded.info.majorVersion}${
                      loaded.info.family ? ` que a família ${loaded.info.family.name} suporta` : ''
                    }.`}
              </p>
              <div className="versions" role="radiogroup" aria-label="Versão de destino">
                {targets.map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={v === target}
                    className={`version${v === target ? ' selected' : ''}`}
                    onClick={() => {
                      setTarget(v)
                      setResult(undefined)
                    }}
                    title={signatures[v] ? 'Você ensinou esta versão' : undefined}
                  >
                    v{v}
                    {v === loaded.info.majorVersion && <span className="version-note"> (atual)</span>}
                    {signatures[v] && <span className="version-dot" aria-label="ensinada" />}
                  </button>
                ))}
              </div>
              <div className="convert-row">
                <span className="path mono">
                  v{loaded.info.majorVersion} <span className="arrow">→</span> v{target}
                  {changingCpu && (
                    <span className="path-cpu">
                      {loaded.info.processorType} <span className="arrow">→</span> {cpu}
                    </span>
                  )}
                </span>
                <button className="btn-primary" onClick={onConvert} disabled={target === undefined}>
                  Converter
                </button>
              </div>
            </>
          )}

          <details className="learn">
            <summary>
              Aprender versão
              {learnedVersions.length > 0 && <span className="count">{learnedVersions.length} ensinada(s)</span>}
            </summary>
            <p className="muted small">
              Use quando este arquivo é uma exportação real e confiável da v{loaded.info.majorVersion}. O site guarda, só
              neste navegador, quais elementos e atributos essa versão usa. Depois, ao converter para ela, avisa o que não
              apareceu aqui.
            </p>
            <button className="btn-ghost" onClick={() => setSignatures(learnSignature(loaded.info.majorVersion, loaded.doc))}>
              Ensinar a v{loaded.info.majorVersion} com este arquivo
            </button>
            {learnedVersions.length > 0 && (
              <ul className="chips">
                {learnedVersions.map((v) => (
                  <li key={v} className="chip">
                    <span className="mono">v{v}</span> · {num(signatures[v].length)} itens
                    <button aria-label={`Esquecer v${v}`} onClick={() => setSignatures(forgetSignature(v))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
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
                  : `O arquivo usa algo que não existe no destino escolhido. Resolva os itens abaixo ou escolha outra opção.`}
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
                    <span className="finding-msg">
                      {f.message}
                      {f.details && (
                        <span className="finding-details mono">
                          {f.details.join(', ')}
                          {f.count !== undefined && f.count > f.details.length && ', …'}
                        </span>
                      )}
                    </span>
                    {f.count !== undefined && (
                      <span className="count">
                        {num(f.count)} ocorrência{f.count === 1 ? '' : 's'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {diff.length > 0 && (
            <>
              <h3>Comparação lado a lado</h3>
              <div className="diff" role="table" aria-label="Antes e depois">
                <div className="diff-head" role="row">
                  <span role="columnheader">Linha</span>
                  <span role="columnheader">Original</span>
                  <span role="columnheader">Convertido</span>
                </div>
                {diff.map((d, i) => (
                  <div className="diff-row mono" role="row" key={i}>
                    <span className="diff-line" role="cell">
                      {d.line}
                    </span>
                    <span className="diff-old" role="cell">
                      {d.old.before}
                      <del>{d.old.changed}</del>
                      {d.old.after}
                    </span>
                    <span className="diff-new" role="cell">
                      {d.new.before}
                      <ins>{d.new.changed}</ins>
                      {d.new.after}
                    </span>
                  </div>
                ))}
              </div>
              <p className="muted small">Todo o resto do arquivo é idêntico ao original, byte a byte.</p>
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
          <p>Só os atributos de versão e de controlador são reescritos. Lógica, tags e comentários ficam intactos.</p>
        </div>
        <div>
          <h4>Relatório de compatibilidade</h4>
          <p>Recursos e controladores que não existem no destino são sinalizados antes do download.</p>
        </div>
      </section>
    </>
  )
}

function XStat({ n, label }: { n: number; label: string }) {
  return (
    <div className={`xstat${n === 0 ? ' xstat-zero' : ''}`}>
      <span className="xstat-num">{num(n)}</span>
      <span className="xstat-label">{label}</span>
    </div>
  )
}
