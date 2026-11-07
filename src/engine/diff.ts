// Comparação linha a linha entre o original e o convertido.
// A conversão só troca valores de atributos, então as linhas continuam
// alinhadas; basta achar as que mudaram e recortar o trecho alterado.

export interface Snippet {
  before: string
  changed: string
  after: string
}

export interface LineChange {
  line: number
  old: Snippet
  new: Snippet
}

const CONTEXT = 48

function clip(text: string, start: number, end: number): Snippet {
  const from = Math.max(0, start - CONTEXT)
  const to = Math.min(text.length, end + CONTEXT)
  return {
    before: (from > 0 ? '…' : '') + text.slice(from, start),
    changed: text.slice(start, end),
    after: text.slice(end, to) + (to < text.length ? '…' : ''),
  }
}

export function diffLines(original: string, converted: string): LineChange[] {
  const a = original.split('\n')
  const b = converted.split('\n')
  const out: LineChange[] = []
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? ''
    const y = b[i] ?? ''
    if (x === y) continue
    // Recorta cada diferença dentro da linha (pode haver mais de uma).
    for (const [sx, ex, sy, ey] of segments(x, y)) {
      out.push({ line: i + 1, old: clip(x, sx, ex), new: clip(y, sy, ey) })
    }
  }
  return out
}

/**
 * Divide a diferença de uma linha em trechos. Quebra a linha em pedaços nos
 * espaços; se os dois lados têm o mesmo número de pedaços, cada pedaço
 * diferente vira um trecho. Senão, usa o maior trecho entre prefixo e sufixo iguais.
 */
function segments(x: string, y: string): Range[] {
  const tx = x.split(/(?=\s)/)
  const ty = y.split(/(?=\s)/)
  if (tx.length !== ty.length) return [prefixSuffix(x, y)]
  const out: Range[] = []
  let px = 0
  let py = 0
  for (let k = 0; k < tx.length; k++) {
    if (tx[k] !== ty[k]) {
      const [sx, ex, sy, ey] = tokenRange(tx[k], ty[k])
      const last = out[out.length - 1]
      // Junta com o trecho anterior quando estão quase colados.
      if (last && px + sx - last[1] <= 2) {
        last[1] = px + ex
        last[3] = py + ey
      } else out.push([px + sx, px + ex, py + sy, py + ey])
    }
    px += tx[k].length
    py += ty[k].length
  }
  return out
}

/** [início em x, fim em x, início em y, fim em y] */
type Range = [number, number, number, number]

/** Num atributo `Nome="valor"`, destaca o valor inteiro; senão, o pedaço que mudou. */
function tokenRange(x: string, y: string): Range {
  const mx = /^(\s*[\w:.-]+=")([^"]*)"/.exec(x)
  const my = /^(\s*[\w:.-]+=")([^"]*)"/.exec(y)
  if (mx && my && mx[1] === my[1]) {
    const s = mx[1].length
    return [s, s + mx[2].length, s, s + my[2].length]
  }
  return prefixSuffix(x, y)
}

function prefixSuffix(x: string, y: string): Range {
  let p = 0
  while (p < x.length && p < y.length && x[p] === y[p]) p++
  let sx = x.length
  let sy = y.length
  while (sx > p && sy > p && x[sx - 1] === y[sy - 1]) {
    sx--
    sy--
  }
  return [p, sx, p, sy]
}
