// Lê o texto (OCR) de uma foto ou print da árvore "I/O Configuration" do
// projeto do CLP e acha os pares slot + modelo, ex.: "[4] 1756-IB32/B DCIN".
// O OCR erra letras parecidas (O/0, I/1, S/5), então o texto é corrigido
// antes, e o resultado sempre passa por uma tabela que a pessoa confere.
import { describeModule, moduleKey, type IoModule } from './iolist'

export interface ConfigHit {
  /** Rack/adaptador em que a linha estava, quando deu para saber. */
  adapter?: string
  slot: number
  /** Outro slot possível, quando o OCR pode ter lido o "[" como "1" (ex.: "17]" = "[7]"). */
  altSlot?: number
  model: string
  line: string
}

const FAMILIES = ['1756', '1769', '1794', '1734', '1738', '1746', '1747', '1771', '5069', '5094', '1719']

const DIGIT_LIKE: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', '|': '1', '!': '1', S: '5', B: '8', Z: '2', G: '6', T: '7' }
const LETTER_LIKE: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' }
/** Letras que o OCR confunde com número: no meio do modelo, valem como número. */
const AMBIGUOUS = new Set(['I', 'O', 'S', 'B', 'Z', 'G', 'L', '|', '!'])

function fixDigits(s: string): string {
  return [...s.toUpperCase()].map((c) => DIGIT_LIKE[c] ?? c).join('')
}

function fixLetters(s: string): string {
  return [...s.toUpperCase()].map((c) => LETTER_LIKE[c] ?? c).join('')
}

/** Começos válidos de cartões de I/O (entrada I?, saída O?). */
const IO_CODES = new Set(
  'IA IB IC IE IF IG IH IJ IK IM IN IQ IR IT IV IW IY OA OB OC OE OF OG OH OK OM ON OV OW OX'.split(' '),
)
/** Sufixos comuns depois da quantidade: E, I, H, D, K, C, CI, IS, IH... */
const SUFFIX_RE = /^(E|I|H|D|K|C|S|V|F|R|T|CI|IS|IH|EK|IK|DK|HK|XT|SC|IE|CIS)$/
const VALID_SIZES = new Set([2, 4, 6, 8, 10, 12, 16, 24, 32, 64])
const COMM_MODELS = /^(CNBR?|CN2RR?|DNB|ENBT|ENET|EWEB|DHRIO|SDN|ADN|ACNR?|AENTR?|EN[234]TR?)$/

/**
 * Corrige o modelo lido pelo OCR: "1832" vira IB32, "OBI6E" vira OB16E,
 * "OW161" vira OW16I, "0832" vira OB32, "DN8" vira DNB.
 */
export function fixModel(raw: string): string | undefined {
  const s = raw.toUpperCase().replace(/[^A-Z0-9|!]/g, '')
  if (s.length < 2) return undefined
  if (/^L\d/.test(s)) return s // CPU
  const comm = fixLetters(s).replace(/Z/g, '2')
  if (COMM_MODELS.test(comm)) return comm
  if (COMM_MODELS.test(s)) return s
  // Cartão de I/O: duas ou três letras, a quantidade de pontos e um sufixo.
  const first = fixLetters(s[0])
  if (first !== 'I' && first !== 'O') return undefined
  let letters = first + fixLetters(s[1])
  let i = 2
  if (i < s.length && /[A-Z]/.test(s[i]) && !AMBIGUOUS.has(s[i])) letters += s[i++]
  if (!/^[A-Z]+$/.test(letters) || !IO_CODES.has(letters.slice(0, 2))) return undefined
  const rest = s.slice(i)
  const asDigits = fixDigits(rest)
  let n = ''
  if (/^\d\d/.test(asDigits) && VALID_SIZES.has(Number(asDigits.slice(0, 2)))) n = asDigits.slice(0, 2)
  else if (/^\d/.test(asDigits) && VALID_SIZES.has(Number(asDigits[0]))) n = asDigits[0]
  if (!n) return undefined
  const suffix = fixLetters(rest.slice(n.length))
  if (!/^[A-Z]{0,3}$/.test(suffix) || (suffix && !SUFFIX_RE.test(suffix))) return undefined
  return letters + n + suffix
}

/** Compara nomes ignorando _ e espaços e as trocas comuns do OCR (8/B, 0/O, 1/l/I). */
function canon(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, '')
    .replace(/8/g, 'b')
    .replace(/0/g, 'o')
    .replace(/[1il|]/g, 'i')
    .replace(/5/g, 's')
}

const FAMILY_RE = /([0-9OoIlSsBZ|]{4})\s*[-–—~]\s*/g

export function parseIoConfigText(text: string, adapters: string[] = []): ConfigHit[] {
  const hits: ConfigHit[] = []
  const known = adapters.map((a) => ({ name: a, key: canon(a) })).filter((a) => a.key.length >= 3)
  // Nomes maiores primeiro, para "Rack_10" não casar com "Rack_1".
  known.sort((a, b) => b.key.length - a.key.length)
  let current: string | undefined
  const local = adapters.find((a) => a.toLowerCase() === 'local')

  for (const line of text.split(/\r?\n/)) {
    const flat = line.trim()
    if (!flat) continue

    // Linha de módulo: [slot] família-modelo/revisão nome
    let hit: ConfigHit | undefined
    FAMILY_RE.lastIndex = 0
    let fm: RegExpExecArray | null
    while ((fm = FAMILY_RE.exec(flat))) {
      const family = fixDigits(fm[1])
      if (!FAMILIES.includes(family)) continue
      const after = flat.slice(fm.index + fm[0].length)
      let piece = after.split('/')[0]
      if (piece.replace(/\s/g, '').length > 8 || !after.includes('/')) piece = after.split(/\s/)[0]
      const model = fixModel(piece.replace(/\s/g, ''))
      const before = flat.slice(0, fm.index)
      const brackets = [...before.matchAll(/[[({]\s*([0-9OoIlSs]{1,3})\s*([\])}]?)/g)]
      // Sem o "[" (o OCR às vezes perde): aceita "7] 1756-..." no fim do trecho.
      const closeOnly = /(?:^|[^0-9A-Za-z])([0-9OoIlSs]{1,2})\s*([\])}])\s*$/.exec(before)
      const last = brackets[brackets.length - 1] ?? closeOnly
      if (!model || !last) break
      let digits = fixDigits(last[1])
      if (!last[2] && digits.length >= 2 && digits.endsWith('1')) digits = digits.slice(0, -1)
      if (/^\d+$/.test(digits)) {
        hit = { slot: Number(digits), model: `${family}-${model}`, line: flat }
        if (last === closeOnly && digits.length === 2 && digits[0] === '1') hit.altSlot = Number(digits[1])
      }
      break
    }

    // A linha cita o nome de um rack? Então os módulos seguintes são dele.
    const k = canon(flat)
    const named = known.find((a) => k.includes(a.key))
    if (hit) {
      const kind = describeModule(hit.model.replace('-', '_')).kind
      if (named && kind === 'REDE') {
        // Adaptador do rack remoto, "[1] 1756-CNB/D Rack_A": o número é o nó da
        // rede, não um slot. Só marca que os cartões seguintes são desse rack.
        current = named.name
        continue
      }
      if (/-L\d/.test(hit.model)) {
        // CPU: está no rack local.
        if (local) current = local
        continue
      }
      hit.adapter = current
      hits.push(hit)
    } else if (named) {
      current = named.name
    } else if (local && /backplane|local|chassi/i.test(flat)) {
      current = local
    }
  }
  return hits
}

export interface ConfigMatch {
  /** moduleKey -> modelo */
  models: Record<string, string>
  /** Linhas da foto que não casaram com nenhum cartão do CSV. */
  unmatched: ConfigHit[]
}

/** Liga cada linha da foto a um cartão do CSV (mesmo rack e slot). */
export function matchIoConfig(hits: ConfigHit[], modules: IoModule[]): ConfigMatch {
  const models: Record<string, string> = {}
  const unmatched: ConfigHit[] = []
  const free = new Set(modules.map((m) => moduleKey(m.adapter, m.slot)))
  const kindOf = (model: string) => describeModule(model.replace('-', '_')).kind
  for (const h0 of hits) {
    const exists = (slot: number) => modules.some((m) => m.slot === slot && (!h0.adapter || m.adapter === h0.adapter))
    const h = h0.altSlot !== undefined && !exists(h0.slot) && exists(h0.altSlot) ? { ...h0, slot: h0.altSlot } : h0
    let target: IoModule | undefined
    if (h.adapter) target = modules.find((m) => m.adapter === h.adapter && m.slot === h.slot)
    if (!target) {
      // Sem rack conhecido: só aceita se houver um único cartão livre com esse slot e tipo compatível.
      const kind = kindOf(h.model)
      const options = modules.filter(
        (m) => m.slot === h.slot && free.has(moduleKey(m.adapter, m.slot)) && (m.kind === kind || kind === 'OUTRO'),
      )
      if (options.length === 1) target = options[0]
    }
    if (!target) {
      unmatched.push(h)
      continue
    }
    const key = moduleKey(target.adapter, target.slot)
    if (!free.has(key)) continue
    free.delete(key)
    models[key] = h.model
  }
  return { models, unmatched }
}

/**
 * Junta várias leituras da mesma imagem (escalas diferentes). Fica com a que
 * achou mais cartões e completa com as outras, sem trocar o que já achou.
 */
export function mergeMatches(results: ConfigMatch[]): ConfigMatch {
  // Cada cartão fica com o modelo que mais leituras deram; no empate, vale a
  // leitura que achou mais cartões.
  const sorted = [...results].sort((a, b) => Object.keys(b.models).length - Object.keys(a.models).length)
  const votes = new Map<string, Map<string, number>>()
  for (const r of sorted) {
    for (const [k, v] of Object.entries(r.models)) {
      const m = votes.get(k) ?? new Map<string, number>()
      m.set(v, (m.get(v) ?? 0) + 1)
      votes.set(k, m)
    }
  }
  const models: Record<string, string> = {}
  for (const [k, m] of votes) {
    let best = ''
    let n = 0
    for (const [v, c] of m) if (c > n) [best, n] = [v, c]
    models[k] = best
  }
  return { models, unmatched: sorted[0]?.unmatched ?? [] }
}
