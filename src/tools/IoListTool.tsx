import { HeroArt } from '../HeroArt'
import { useEffect, useMemo, useState } from 'react'
import { matchIoConfig, mergeMatches, parseIoConfigText, type ConfigHit } from '../engine/ioconfig'
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
  | { state: 'reading'; name: string; progress: number }
  | { state: 'done'; name: string; found: number; unmatched: ConfigHit[] }
  | { state: 'error'; name: string }

const PREVIEW_ROWS = 400
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function IoListTool() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [error, setError] = useState<string>()
  const [spares, setSpares] = useState(true)
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  // Modelo exato de cada cartão (da foto ou digitado). Chave: moduleKey(rack, slot).
  const [models, setModels] = useState<Record<string, string>>({})
  const [fromPhoto, setFromPhoto] = useState<Record<string, string>>({})
  const [photo, setPhoto] = useState<PhotoState>({ state: 'idle' })

  // Lista só com o que veio no CSV, para a tabela de modelos mostrar o original.
  const base = useMemo(() => {
    if (!loaded) return undefined
    try {
      return buildIoList(loaded.text)
    } catch {
      return undefined
    }
  }, [loaded])

  const list = useMemo(() => {
    if (!loaded) return undefined
    try {
      return buildIoList(loaded.text, { spares, models })
    } catch {
      return undefined
    }
  }, [loaded, spares, models])

  async function onPhoto(file: Blob | undefined, name = 'imagem colada') {
    if (!file || !base || photo.state === 'reading') return
    setPhoto({ state: 'reading', name, progress: 0 })
    try {
      const { readImageTexts } = await import('./ocr')
      const texts = await readImageTexts(file, (progress) => setPhoto({ state: 'reading', name, progress }))
      const adapters = [...new Set(base.modules.map((m) => m.adapter))]
      const match = mergeMatches(texts.map((t) => matchIoConfig(parseIoConfigText(t, adapters), base.modules)))
      setFromPhoto(match.models)
      setModels((prev) => ({ ...prev, ...match.models }))
      setPhoto({ state: 'done', name, found: Object.keys(match.models).length, unmatched: match.unmatched })
    } catch {
      setPhoto({ state: 'error', name })
    }
  }

  // Ctrl+V com um print da tela também funciona.
  useEffect(() => {
    if (!loaded) return
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
    setModels({})
    setFromPhoto({})
    setPhoto({ state: 'idle' })
    if (!f) return
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

  return (
    <>
      <section className="hero">
        <HeroArt />
        <div className="hero-kicker">Lista de I/O</div>
        <h1>Só as entradas e saídas, numa planilha arrumada</h1>
        <p>
          Envie o CSV de tags exportado do projeto do CLP. O site acha os módulos de I/O, junta cada ponto com o
          comentário e a tag que aponta para ele e monta um Excel pronto para usar.
        </p>
        <details className="howto">
          <summary>Como usar</summary>
          <ol>
            <li>
              Com o projeto aberto no software do CLP, vá em <b>Tools &gt; Export Tags</b> (ou{' '}
              <b>Tools &gt; Import/Export</b>) e exporte as tags do controlador como CSV.
            </li>
            <li>Arraste o CSV aqui. A lista aparece na hora, com filtros por tipo.</li>
            <li>
              Baixe a planilha. Ela vem com a aba <b>Lista de IO</b>, um <b>Resumo</b> por módulo e, se houver, a aba{' '}
              <b>Rede</b> com os pontos de rede comentados.
            </li>
          </ol>
        </details>
      </section>

      {!loaded && (
        <FileDrop
          accept=".csv,.CSV"
          title="Arraste o CSV de tags aqui"
          hint="exportado pelo Export Tags do projeto do CLP"
          onFile={onFile}
        />
      )}

      {error && (
        <div className="alert alert-bad" role="alert">
          <strong>Não foi possível continuar.</strong> {error}
        </div>
      )}

      {loaded && list && (
        <section className="card">
          <div className="file-head">
            <div className="file-icon">CSV</div>
            <div className="file-meta">
              <div className="file-name">{loaded.name}</div>
              <div className="muted">
                {formatSize(loaded.size)}
                {list.software && ` · software ${list.software}`}
              </div>
            </div>
            <button className="btn-ghost" onClick={() => onFile(undefined)}>
              Trocar arquivo
            </button>
          </div>

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
                  cartão tem. Estimei pelos pontos usados (16 ou 32); confira as reservas.
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

          <details className="learn io-config" open={Object.keys(models).length > 0}>
            <summary>
              Tem uma foto do I/O Configuration? Use os modelos exatos dos cartões <span className="muted">(opcional)</span>
            </summary>
            <p className="muted small">
              O CSV às vezes só diz "cartão digital", sem dizer se tem 16 ou 32 pontos. Mande um print ou foto da árvore{' '}
              <b>I/O Configuration</b> do projeto (com os cartões expandidos) e o site lê os modelos, como 1756-IB32. A
              imagem é lida aqui no navegador e não é enviada para lugar nenhum. Confira a tabela: dá para corrigir ou
              digitar qualquer modelo.
            </p>
            <div className="io-photo-row">
              <label className={`btn-ghost io-photo-btn${photo.state === 'reading' ? ' io-disabled' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={photo.state === 'reading'}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void onPhoto(f, f.name)
                  }}
                />
                Enviar foto ou print
              </label>
              <span className="muted small">ou cole um print com Ctrl+V</span>
              {Object.keys(models).length > 0 && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setModels({})
                    setFromPhoto({})
                    setPhoto({ state: 'idle' })
                  }}
                >
                  Limpar modelos
                </button>
              )}
            </div>
            {photo.state === 'reading' && (
              <div className="io-photo-status">
                Lendo {photo.name}… {Math.round(photo.progress * 100)}%
                <div className="io-progress">
                  <span style={{ width: `${Math.round(photo.progress * 100)}%` }} />
                </div>
              </div>
            )}
            {photo.state === 'done' && (
              <div className={`alert ${photo.found > 0 ? 'alert-ok' : 'alert-warn'}`}>
                {photo.found > 0
                  ? `Achei o modelo de ${photo.found} ${photo.found === 1 ? 'cartão' : 'cartões'} na imagem. Confira abaixo.`
                  : 'Não consegui achar nenhum modelo nessa imagem. Tente um print mais nítido, com os cartões expandidos, ou digite os modelos na tabela.'}
                {photo.unmatched.filter((h) => !/-(CNB|EN|DNB|AENT|L\d)/.test(h.model)).length > 0 && (
                  <div className="small">
                    Não soube em que rack colocar:{' '}
                    {photo.unmatched
                      .filter((h) => !/-(CNB|EN|DNB|AENT|L\d)/.test(h.model))
                      .map((h) => `[${h.slot}] ${h.model}`)
                      .join(', ')}
                    . Digite esses na tabela.
                  </div>
                )}
              </div>
            )}
            {photo.state === 'error' && (
              <div className="alert alert-bad">Não consegui ler a imagem. Tente outro arquivo ou digite os modelos.</div>
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
                    const now = list?.modules.find((x) => moduleKey(x.adapter, x.slot) === key)
                    const auto = fromPhoto[key] !== undefined && fromPhoto[key] === models[key]
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
                            onChange={(e) => setModels((prev) => ({ ...prev, [key]: e.target.value }))}
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
          </details>

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
