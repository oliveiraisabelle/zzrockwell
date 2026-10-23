import { useState } from 'react'
import { analyze, availableTargets, convert, parseL5x, L5xError, type ConversionResult, type L5xInfo } from './engine/l5x'

interface Loaded {
  name: string
  xml: string
  info: L5xInfo
  targets: number[]
}

function App() {
  const [loaded, setLoaded] = useState<Loaded>()
  const [target, setTarget] = useState<number>()
  const [result, setResult] = useState<ConversionResult>()
  const [error, setError] = useState<string>()

  async function onFile(file: File | undefined) {
    setLoaded(undefined)
    setResult(undefined)
    setError(undefined)
    if (!file) return
    try {
      const xml = await file.text()
      const info = analyze(parseL5x(xml))
      const targets = availableTargets(info)
      setLoaded({ name: file.name, xml, info, targets })
      setTarget(targets[targets.length - 1])
    } catch (e) {
      setError(e instanceof L5xError ? e.message : 'Não consegui ler o arquivo.')
    }
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
    a.download = loaded.name.replace(/\.L5X$/i, '') + `_v${target}.L5X`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main>
      <h1>Conversor de versão L5X</h1>
      <p className="lead">
        Converte exportações L5X para uma versão mais antiga do Logix Designer. O arquivo é processado no seu
        navegador e não é enviado para nenhum servidor.
      </p>

      <label className="drop">
        <input type="file" accept=".l5x,.L5X,.xml" onChange={(e) => onFile(e.target.files?.[0])} />
        <span>{loaded ? loaded.name : 'Escolha um arquivo .L5X'}</span>
      </label>

      {error && <p className="error">{error}</p>}

      {loaded && (
        <section>
          <dl>
            <dt>Versão atual</dt>
            <dd>v{loaded.info.softwareRevision}</dd>
            <dt>Tipo</dt>
            <dd>{loaded.info.targetType}</dd>
            {loaded.info.processorType && (
              <>
                <dt>CLP</dt>
                <dd>
                  {loaded.info.processorType}
                  {loaded.info.family && ` (${loaded.info.family.name})`}
                </dd>
              </>
            )}
          </dl>

          {loaded.targets.length === 0 ? (
            <p className="error">Não há versão mais antiga disponível para este arquivo.</p>
          ) : (
            <div className="row">
              <label>
                Converter para{' '}
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(Number(e.target.value))
                    setResult(undefined)
                  }}
                >
                  {loaded.targets.map((v) => (
                    <option key={v} value={v}>
                      v{v}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={onConvert}>Converter</button>
            </div>
          )}
        </section>
      )}

      {result && (
        <section>
          <h2>{result.ok ? 'Conversão pronta' : 'Não foi possível converter'}</h2>
          {result.changes.length > 0 && (
            <>
              <h3>Alterações</h3>
              <ul>
                {result.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {result.findings.length > 0 && (
            <>
              <h3>Pontos de atenção</h3>
              <ul>
                {result.findings.map((f) => (
                  <li key={f.message} className={f.severity}>
                    <strong>{f.severity === 'block' ? 'Impede' : 'Revisar'}:</strong> {f.message}
                    {f.count !== undefined && ` (${f.count} ocorrência${f.count === 1 ? '' : 's'})`}
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.ok && <button onClick={onDownload}>Baixar L5X convertido</button>}
        </section>
      )}

      <footer>
        Revise e teste o programa convertido antes de carregá-lo em um CLP. Este site não é afiliado à Rockwell
        Automation. Studio 5000 e Logix são marcas de seus respectivos donos.
      </footer>
    </main>
  )
}

export default App
