import { HeroArt } from '../HeroArt'
import { useMemo, useState } from 'react'
import { convertToSe12, DisplayError, inspectDisplay, isValidPrefix, type DisplayInfo } from '../engine/se12'
import { decodeText, encodeText, ENCODING_LABEL, type TextFile } from '../engine/textfile'
import { FileDrop } from './FileDrop'
import { downloadBytes, formatSize } from './files'

interface Loaded {
  name: string
  size: number
  file: TextFile
  info: DisplayInfo
}

const MAX_OBJECTS = 8

export function Se12Tool() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [error, setError] = useState<string>()
  const [usePrefix, setUsePrefix] = useState(false)
  const [prefix, setPrefix] = useState('IMP_')

  const prefixOk = !usePrefix || isValidPrefix(prefix)
  const result = useMemo(() => {
    if (!loaded || !prefixOk) return undefined
    try {
      return convertToSe12(loaded.file.text, { prefix: usePrefix ? prefix : undefined })
    } catch {
      return undefined
    }
  }, [loaded, usePrefix, prefix, prefixOk])

  async function onFile(f: File | undefined) {
    setLoaded(undefined)
    setError(undefined)
    if (!f) return
    try {
      const file = decodeText(await f.arrayBuffer())
      setLoaded({ name: f.name, size: f.size, file, info: inspectDisplay(file.text) })
    } catch (e) {
      setError(e instanceof DisplayError ? e.message : 'Não consegui ler o arquivo.')
    }
  }

  function outputName() {
    return (loaded?.name ?? 'tela').replace(/\.xml$/i, '') + '_SE12.xml'
  }

  function onDownload() {
    if (!loaded || !result) return
    downloadBytes(encodeText({ ...loaded.file, text: result.output }), outputName())
  }

  const applied = result?.fixes.filter((f) => f.count > 0) ?? []
  const reviews = applied.filter((f) => f.severity === 'review')
  const alreadyOld = loaded?.info.version !== undefined && loaded.info.version <= 12

  return (
    <>
      <section className="hero">
        <HeroArt />
        <h1>Leve telas das versões 13 a 16 para a versão 12</h1>
        <p>
          Envie o XML de uma tela exportada de uma versão mais nova do supervisório. O site tira o que a versão 12 não
          aceita e devolve um XML pronto para importar, na mesma codificação do original.
        </p>
        <details className="howto">
          <summary>Como usar</summary>
          <ol>
            <li>Na versão nova, abra o Graphics Import Export Wizard e exporte a tela como XML.</li>
            <li>Arraste o XML aqui. As correções aparecem na hora.</li>
            <li>
              Se a tela de destino já tem objetos com os mesmos nomes, ligue o <b>prefixo nos nomes</b>.
            </li>
            <li>Baixe o arquivo e importe na versão 12 pelo mesmo assistente.</li>
          </ol>
        </details>
      </section>

      {!loaded && (
        <FileDrop
          accept=".xml,.XML"
          title="Arraste o XML da tela aqui"
          hint="exportado pelo assistente de importação e exportação de telas"
          onFile={onFile}
        />
      )}

      {error && (
        <div className="alert alert-bad" role="alert">
          <strong>Não foi possível continuar.</strong> {error}
        </div>
      )}

      {loaded && (
        <section className="card">
          <div className="file-head">
            <div className="file-icon">XML</div>
            <div className="file-meta">
              <div className="file-name">{loaded.name}</div>
              <div className="muted">{formatSize(loaded.size)}</div>
            </div>
            <button className="btn-ghost" onClick={() => onFile(undefined)}>
              Trocar arquivo
            </button>
          </div>

          <dl className="facts">
            <div>
              <dt>Tela</dt>
              <dd>{loaded.info.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Versão do arquivo</dt>
              <dd className="mono">{loaded.info.version ? `v${loaded.info.version}` : '—'}</dd>
            </div>
            <div>
              <dt>Objetos com nome</dt>
              <dd className="mono">{loaded.info.objectCount.toLocaleString('pt-BR')}</dd>
            </div>
            <div>
              <dt>Codificação</dt>
              <dd className="mono">{ENCODING_LABEL[loaded.file.encoding]}</dd>
            </div>
          </dl>

          {alreadyOld && (
            <div className="alert alert-warn">
              Esta tela já é da v{loaded.info.version}. Ela deve importar na versão 12 sem conversão, mas as correções
              abaixo ainda podem ser aplicadas.
            </div>
          )}

          <div className="divider" />

          <h2 className="card-title">Opções</h2>
          <label className="toggle">
            <input type="checkbox" checked={usePrefix} onChange={(e) => setUsePrefix(e.target.checked)} />
            <span>
              <b>Prefixo nos nomes dos objetos</b>
              <span className="muted small">
                Use quando a tela de destino já tem objetos com os mesmos nomes. Ex.: Divisor4 vira {prefix || 'IMP_'}
                Divisor4.
              </span>
            </span>
          </label>
          {usePrefix && (
            <div className="prefix-row">
              <label htmlFor="prefix">Prefixo</label>
              <input
                id="prefix"
                className={`input mono${prefixOk ? '' : ' input-bad'}`}
                value={prefix}
                maxLength={20}
                onChange={(e) => setPrefix(e.target.value)}
              />
              {!prefixOk && <span className="small bad-text">Só letras, números e _, sem começar com número.</span>}
            </div>
          )}
        </section>
      )}

      {loaded && result && (
        <section className="card report">
          <div className="banner banner-ok">
            <span className="banner-icon">✓</span>
            <div>
              <div className="banner-title">
                {result.total > 0 ? `${result.total.toLocaleString('pt-BR')} correções aplicadas` : 'Nada para corrigir'}
              </div>
              <div className="small">
                {result.total > 0
                  ? reviews.length > 0
                    ? 'Arquivo pronto para a versão 12. Confira os itens marcados como Revisar antes de importar.'
                    : 'Arquivo pronto para importar na versão 12.'
                  : 'Não achei nada incompatível com a versão 12 nesta tela.'}
              </div>
            </div>
          </div>

          <h3>Correções</h3>
          <ul className="fixlist">
            {result.fixes.map((f) => (
              <li key={f.id} className={`fix${f.count === 0 ? ' fix-none' : ''}`}>
                <span className="fix-mark" aria-hidden="true">
                  {f.count > 0 ? '✓' : '–'}
                </span>
                <div className="fix-body">
                  <div className="fix-title">
                    {f.label}
                    {f.count > 0 && f.severity === 'review' && <span className="badge badge-review">Revisar</span>}
                  </div>
                  {f.count > 0 && <div className="muted small">{f.note}</div>}
                  {f.objects.length > 0 && (
                    <div className="fix-objects mono">
                      {f.objects.slice(0, MAX_OBJECTS).join(', ')}
                      {f.objects.length > MAX_OBJECTS && ` e mais ${f.objects.length - MAX_OBJECTS}`}
                    </div>
                  )}
                </div>
                <span className="count">{f.count}×</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            O resto do arquivo não muda. O download sai em {ENCODING_LABEL[loaded.file.encoding]}, igual ao original.
          </p>

          <div className="download-row">
            <button className="btn-primary btn-lg" onClick={onDownload}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              Baixar {outputName()}
            </button>
          </div>
        </section>
      )}

      <section className="info-grid">
        <div>
          <h4>Privado por padrão</h4>
          <p>A tela é tratada inteira no navegador. Nenhum arquivo é enviado para servidor.</p>
        </div>
        <div>
          <h4>Mudança mínima</h4>
          <p>Só os trechos que a versão 12 não aceita mudam. Animações, tags e expressões ficam iguais.</p>
        </div>
        <div>
          <h4>Codificação preservada</h4>
          <p>Telas em UTF-16 voltam em UTF-16, com o mesmo cabeçalho, para a importação não falhar.</p>
        </div>
      </section>
    </>
  )
}
