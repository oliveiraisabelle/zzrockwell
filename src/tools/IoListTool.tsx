import { HeroArt } from '../HeroArt'
import { useMemo, useState } from 'react'
import { buildIoList, decodeCsv, pointDescription, TagCsvError, TYPE_LABEL, type PointType } from '../engine/iolist'
import { FileDrop } from './FileDrop'
import { downloadBytes, formatSize } from './files'

interface Loaded {
  name: string
  size: number
  text: string
}

type Filter = 'todos' | PointType

const PREVIEW_ROWS = 400
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function IoListTool() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [error, setError] = useState<string>()
  const [spares, setSpares] = useState(true)
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    if (!loaded) return undefined
    try {
      return buildIoList(loaded.text, { spares })
    } catch {
      return undefined
    }
  }, [loaded, spares])

  async function onFile(f: File | undefined) {
    setLoaded(undefined)
    setError(undefined)
    setFilter('todos')
    setSearch('')
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
