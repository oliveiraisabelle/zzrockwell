import { HeroArt } from '../HeroArt'
import { useEffect, useMemo, useState } from 'react'
import { matchIoConfig, mergeMatches, parseIoConfigText } from '../engine/ioconfig'
import {
  buildIoList,
  decodeCsv,
  moduleKey,
  MODULE_LABEL,
  pointDescription,
  TagCsvError,
  TYPE_LABEL,
  type PointType,
} from '../engine/iolist'
import { FileDrop } from './FileDrop'
import { downloadBytes, formatSize } from './files'

interface Loaded {
  name: string
  size: number
  text: string
}

type Filter = 'todos' | PointType

type PhotoState =
  | { state: 'idle' }
  | { state: 'reading'; name: string; url: string; progress: number }
  | { state: 'done'; name: string; url: string; texts: string[] }
  | { state: 'error'; name: string; url: string }

const PREVIEW_ROWS = 400
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const IGNORE_UNMATCHED = /-(CNB|EN|DNB|AENT|L\d)/

export function IoListTool() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [error, setError] = useState<string>()
  const [spares, setSpares] = useState(true)
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<PhotoState>({ state: 'idle' })
  // Modelos digitados/corrigidos na tabela. Chave: moduleKey(rack, slot).
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [manual, setManual] = useState(false)

  // Lista só com o que veio no CSV, para a tabela de modelos mostrar o original.
  const base = useMemo(() => {
    if (!loaded) return undefined
    try {
      return buildIoList(loaded.text)
    } catch {
      return undefined
    }
  }, [loaded])

  // A foto pode vir antes ou depois do CSV: o texto lido fica guardado e é
  // ligado aos cartões quando os dois estão aqui.
  const photoMatch = useMemo(() => {
    if (!base || photo.state !== 'done') return undefined
    const adapters = [...new Set(base.modules.map((m) => m.adapter))]
    return mergeMatches(photo.texts.map((t) => matchIoConfig(parseIoConfigText(t, adapters), base.modules)))
  }, [base, photo])

  const models = useMemo(() => ({ ...(photoMatch?.models ?? {}), ...edits }), [photoMatch, edits])

  const list = useMemo(() => {
    if (!loaded) return undefined
    try {
      return buildIoList(loaded.text, { spares, models })
    } catch {
      return undefined
    }
  }, [loaded, spares, models])

  async function onPhoto(file: Blob | undefined, name = 'print colado') {
    if (!file || photo.state === 'reading') return
    if (!file.type.startsWith('image/')) {
      setError('A foto precisa ser uma imagem (PNG, JPG...). O CSV vai no quadro 1.')
      return
    }
    setError(undefined)
    if (photo.state !== 'idle') URL.revokeObjectURL(photo.url)
    const url = URL.createObjectURL(file)
    setEdits({})
    setPhoto({ state: 'reading', name, url, progress: 0 })
    try {
      const { readImageTexts } = await import('./ocr')
      const texts = await readImageTexts(file, (progress) => setPhoto({ state: 'reading', name, url, progress }))
      setPhoto({ state: 'done', name, url, texts })
    } catch {
      setPhoto({ state: 'error', name, url })
    }
  }

  function removePhoto() {
    if (photo.state !== 'idle') URL.revokeObjectURL(photo.url)
    setPhoto({ state: 'idle' })
    setEdits({})
  }

  // Ctrl+V com um print da tela vai direto para o quadro da foto.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const blob = item?.getAsFile()
      if (blob) {
        e.preventDefault()
        void onPhoto(blob)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  async function onFile(f: File | undefined) {
    setLoaded(undefined)
    setError(undefined)
    setFilter('todos')
    setSearch('')
    setEdits({})
    if (!f) return
    if (f.type.startsWith('image/')) {
      // Imagem solta no quadro do CSV: leva para o da foto.
      void onPhoto(f, f.name)
      return
    }
    try {
      const text = decodeCsv(await f.arrayBuffer())
      const test = buildIoList(text)
      if (test.modules.length === 0 && test.points.length === 0) {
        setError('Li o CSV, mas não achei nenhum módulo de I/O nele. Confira se exportou as tags do controlador inteiro.')
        return
      }
      setLoaded({ name: f.name, size: f.size, text })
    } catch (e) {
      setError(e instanceof TagCsvError ? e.message : 'Não consegui ler o arquivo.')
    }
  }

  function outputName() {
    return 'Lista_IO_' + (loaded?.name ?? 'tags').replace(/\.csv$/i, '').replace(/-?Tags$/i, '') + '.xlsx'
  }

  async function onDownload() {
    if (!loaded || !list) return
    setBusy(true)
    try {
      const { buildIoListXlsx } = await import('../engine/iolistXlsx')
      const bytes = await buildIoListXlsx(list, { fileName: loaded.name })
      downloadBytes(bytes, outputName(), XLSX_TYPE)
    } catch {
      setError('Não consegui gerar a planilha. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const shown = useMemo(() => {
    if (!list) return []
    const q = search.trim().toLowerCase()
    return list.points.filter((p) => {
      if (filter !== 'todos' && p.type !== filter) return false
      if (!q) return true
      return (
        p.address.toLowerCase().includes(q) ||
        pointDescription(p).toLowerCase().includes(q) ||
        p.aliases.some((a) => a.name.toLowerCase().includes(q))
      )
    })
  }, [list, filter, search])

  const types: PointType[] = ['DI', 'DO', 'AI', 'AO', 'REDE']
  const ioModules = list?.modules.filter((m) => m.kind !== 'REDE' && m.kind !== 'OUTRO') ?? []
  const guessed = ioModules.filter((m) => m.sizeGuessed)
  const shared = list?.points.filter((p) => p.aliases.length > 1).length ?? 0
  const unmatchedHits = photoMatch?.unmatched.filter((h) => !IGNORE_UNMATCHED.test(h.model)) ?? []

  return (
    <>
      <section className="hero">
        <HeroArt />
        <div className="hero-kicker">Lista de I/O</div>
        <h1>Só as entradas e saídas, numa planilha arrumada</h1>
        <p>
          Envie o CSV de tags exportado do projeto do CLP. O site acha os módulos de I/O, junta cada ponto com o
          comentário e a tag que aponta para ele e monta um Excel pronto para usar. Se quiser, mande também um print da
          árvore I/O Configuration para a planilha usar o modelo exato de cada cartão.
        </p>
        <details className="howto">
          <summary>Como usar</summary>
          <ol>
            <li>
              Com o projeto aberto no software do CLP, vá em <b>Tools &gt; Export Tags</b> (ou{' '}
              <b>Tools &gt; Import/Export</b>) e exporte as tags do controlador como CSV.
            </li>
            <li>Arraste o CSV no quadro 1. A lista aparece na hora, com filtros por tipo.</li>
            <li>
              Opcional: expanda todos os racks na árvore <b>I/O Configuration</b>, tire um print (tecla Print Screen ou
              Win+Shift+S) e cole aqui com Ctrl+V, ou arraste a imagem no quadro 2.
            </li>
            <li>
              Baixe a planilha. Ela vem com a aba <b>Lista de IO</b>, um <b>Resumo</b> por módulo e, se houver, a aba{' '}
              <b>Rede</b> com os pontos de rede comentados.
            </li>
          </ol>
        </details>
      </section>

      <section className="io-uploads">
        <div className={`io-upload${loaded ? ' io-upload-done' : ''}`}>
          <div className="io-upload-head">
            <span className="io-step">1</span>
            <span className="io-upload-title">CSV de tags</span>
            <span className="io-req io-req-on">Obrigatório</span>
          </div>
          {loaded && list ? (
            <div className="io-picked">
              <div className="file-icon">CSV</div>
              <div className="file-meta">
                <div className="file-name">{loaded.name}</div>
                <div className="muted small">
                  {formatSize(loaded.size)}
                  {list.software && ` · software ${list.software}`}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => onFile(undefined)}>
                Trocar
              </button>
            </div>
          ) : (
            <FileDrop
              compact
              accept=".csv,.CSV"
              title="Arraste o CSV aqui"
              hint="do Export Tags"
              onFile={onFile}
            />
          )}
        </div>

        <div className={`io-upload${photo.state === 'done' ? ' io-upload-done' : ''}`}>
          <div className="io-upload-head">
            <span className="io-step">2</span>
            <span className="io-upload-title">Print do I/O Configuration</span>
            <span className="io-req">Opcional</span>
          </div>
          {photo.state === 'idle' ? (
            <FileDrop
              compact
              icon="image"
              accept="image/*"
              title="Arraste a imagem ou cole com Ctrl+V"
              hint="deixa os modelos dos cartões exatos"
              onFile={(f) => void onPhoto(f, f?.name)}
            />
          ) : (
            <div className="io-picked">
              <img className="io-thumb" src={photo.url} alt="Print do I/O Configuration enviado" />
              <div className="file-meta">
                <div className="file-name">{photo.name}</div>
                {photo.state === 'reading' && (
                  <div className="io-photo-status">
                    Lendo os modelos… {Math.round(photo.progress * 100)}%
                    <div className="io-progress">
                      <span style={{ width: `${Math.round(photo.progress * 100)}%` }} />
                    </div>
                  </div>
                )}
                {photo.state === 'done' && !photoMatch && (
                  <div className="muted small">Lida. Agora envie o CSV no quadro 1.</div>
                )}
                {photo.state === 'done' && photoMatch && (
                  <div className={`small ${Object.keys(photoMatch.models).length ? 'ok-text' : 'warn-text'}`}>
                    {Object.keys(photoMatch.models).length
                      ? `Achei o modelo de ${Object.keys(photoMatch.models).length} ${Object.keys(photoMatch.models).length === 1 ? 'cartão' : 'cartões'}`
                      : 'Não achei modelos nesta imagem'}
                  </div>
                )}
                {photo.state === 'error' && <div className="small bad-text">Não consegui ler a imagem.</div>}
              </div>
              <button className="btn-ghost" onClick={removePhoto} disabled={photo.state === 'reading'}>
                Remover
              </button>
            </div>
          )}
          <p className="io-upload-note muted small">
            A imagem é lida no seu navegador e não é enviada para lugar nenhum.
          </p>
        </div>
      </section>

      {error && (
        <div className="alert alert-bad" role="alert">
          <strong>Não foi possível continuar.</strong> {error}
        </div>
      )}

      {loaded && list && (
        <section className="card">
          <dl className="facts">
            <div>
              <dt>Módulos de I/O</dt>
              <dd className="mono">{ioModules.length}</dd>
            </div>
            <div>
              <dt>Pontos com tag ou comentário</dt>
              <dd className="mono">{list.used.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt>Reservas</dt>
              <dd className="mono">{list.spares.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt>Pontos de rede comentados</dt>
              <dd className="mono">{list.network.length.toLocaleString('pt-BR')}</dd>
            </div>
          </dl>

          <div className="io-counts">
            {types
              .filter((t) => list.counts[t] > 0)
              .map((t) => (
                <div key={t} className={`io-count io-${t.toLowerCase()}`}>
                  <span className="io-count-num">{list.counts[t]}</span>
                  <span className="io-count-label">{TYPE_LABEL[t]}</span>
                </div>
              ))}
          </div>

          {(guessed.length > 0 || shared > 0) && (
            <div className="alert alert-warn">
              {guessed.length > 0 && (
                <div>
                  Em {guessed.length} {guessed.length === 1 ? 'módulo' : 'módulos'} o CSV não diz quantos pontos o
                  cartão tem. Estimei pelos pontos usados (16 ou 32). O print do I/O Configuration resolve isso.
                </div>
              )}
              {shared > 0 && (
                <div>
                  {shared} {shared === 1 ? 'ponto tem' : 'pontos têm'} mais de uma tag apontando para o mesmo endereço.
                  Estão marcados na coluna Observação.
                </div>
              )}
            </div>
          )}

          {photo.state !== 'idle' || manual || Object.keys(edits).length > 0 ? (
            <div className="io-models-box">
              <div className="io-models-head">
                <h3>Modelos dos cartões</h3>
                <span className="muted small">
                  {photoMatch
                    ? 'Preenchidos pela imagem. Confira e corrija o que precisar.'
                    : 'Digite o modelo de cada cartão, ex.: 1756-IB32.'}
                </span>
              </div>
              {photo.state === 'done' && photoMatch && Object.keys(photoMatch.models).length === 0 && (
                <div className="alert alert-warn">
                  Não consegui ler nenhum modelo nesse print. Tente um print mais nítido, com os racks expandidos, ou
                  digite os modelos abaixo.
                </div>
              )}
              {unmatchedHits.length > 0 && (
                <div className="alert alert-warn">
                  Não soube em que rack colocar: {unmatchedHits.map((h) => `[${h.slot}] ${h.model}`).join(', ')}. Digite
                  esses na tabela.
                </div>
              )}
              <div className="table-wrap io-models">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rack</th>
                      <th>Slot</th>
                      <th>No CSV</th>
                      <th>Modelo exato</th>
                      <th>Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {base?.modules.map((m) => {
                      const key = moduleKey(m.adapter, m.slot)
                      const now = list.modules.find((x) => moduleKey(x.adapter, x.slot) === key)
                      const auto = photoMatch?.models[key] !== undefined && edits[key] === undefined
                      return (
                        <tr key={key}>
                          <td className="mono">{m.adapter}</td>
                          <td className="mono">{m.slot}</td>
                          <td>
                            <span className="mono">{m.catalog}</span>{' '}
                            <span className="muted small">{MODULE_LABEL[m.kind]}</span>
                          </td>
                          <td>
                            <input
                              className="input mono io-model-input"
                              value={models[key] ?? ''}
                              placeholder={m.catalog}
                              aria-label={`Modelo exato do slot ${m.slot} de ${m.adapter}`}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                            />
                            {auto && <span className="badge io-badge-photo">da foto</span>}
                          </td>
                          <td className="mono">
                            {now?.kind === 'REDE' || now?.kind === 'OUTRO' ? '—' : (now?.size ?? '?')}
                            {now?.sizeGuessed && <span className="muted small"> estimado</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            guessed.length > 0 && (
              <div className="io-hint">
                <span>
                  Para os pontos ficarem exatos, mande o <b>print do I/O Configuration</b> no quadro 2 lá em cima, ou
                </span>
                <button className="btn-ghost" onClick={() => setManual(true)}>
                  digite os modelos à mão
                </button>
              </div>
            )
          )}

          <div className="divider" />

          <label className="toggle">
            <input type="checkbox" checked={spares} onChange={(e) => setSpares(e.target.checked)} />
            <span>
              <b>Incluir pontos livres como Reserva</b>
              <span className="muted small">Mostra todos os pontos de cada cartão, mesmo os que não têm tag.</span>
            </span>
          </label>

          <div className="io-filters">
            <div className="io-tabs" role="tablist">
              {(['todos', ...types.filter((t) => list.counts[t] > 0)] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  className={`io-tab${filter === f ? ' io-tab-on' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'todos' ? 'Todos' : f}
                </button>
              ))}
            </div>
            <input
              className="input io-search"
              placeholder="Buscar tag, endereço ou descrição"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="table-wrap io-table-wrap">
            <table className="table io-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Endereço</th>
                  <th>Tag</th>
                  <th>Descrição</th>
                  <th>Módulo</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, PREVIEW_ROWS).map((p) => (
                  <tr key={p.address} className={p.spare ? 'io-spare' : undefined}>
                    <td>
                      <span className={`io-pill io-${p.type.toLowerCase()}`}>{p.type}</span>
                    </td>
                    <td className="mono">{p.address}</td>
                    <td className="mono">{p.aliases.map((a) => a.name).join(', ') || (p.spare ? 'Reserva' : '')}</td>
                    <td className="io-desc">{pointDescription(p)}</td>
                    <td className="muted">{p.module?.catalog}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Nada encontrado com esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shown.length > PREVIEW_ROWS && (
            <p className="muted small">
              Mostrando {PREVIEW_ROWS} de {shown.length.toLocaleString('pt-BR')} linhas. A planilha tem todas.
            </p>
          )}

          <div className="download-row">
            <button className="btn-primary btn-lg" onClick={onDownload} disabled={busy}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              {busy ? 'Gerando planilha…' : `Baixar ${outputName()}`}
            </button>
          </div>
        </section>
      )}

      <section className="info-grid">
        <div>
          <h4>Privado por padrão</h4>
          <p>O CSV é lido inteiro no navegador. Nenhuma tag nem comentário sai do seu computador.</p>
        </div>
        <div>
          <h4>Um ponto por linha</h4>
          <p>Cada bit digital ou canal analógico vira uma linha, com endereço, tag alias, descrição e módulo.</p>
        </div>
        <div>
          <h4>Pronto para filtrar</h4>
          <p>A planilha já vem com filtros, cabeçalho fixo, cores por tipo e um resumo dos cartões.</p>
        </div>
      </section>
    </>
  )
}
