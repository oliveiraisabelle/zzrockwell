// Lista de I/O a partir do CSV de tags exportado do CLP (Tools > Export Tags).
// O CSV tem linhas TAG, ALIAS, COMMENT e RCOMMENT. Daqui sai:
//  - os módulos (tags de módulo do tipo "Rack:Slot:I/O/C"),
//  - um ponto por bit (digital) ou canal (analógico), com o comentário do
//    endereço e as tags alias que apontam para ele,
//  - os comentários das palavras de rede (DeviceNet etc.), numa lista à parte.

export class TagCsvError extends Error {}

export type ModuleKind = 'DI' | 'DO' | 'AI' | 'AO' | 'REDE' | 'OUTRO'
export type PointType = 'DI' | 'DO' | 'AI' | 'AO' | 'REDE'

export interface IoModule {
  adapter: string
  slot: number
  /** Catálogo legível, ex.: 1756-IF16. */
  catalog: string
  /** Tipo de dado como veio no CSV, ex.: AB:1756_IF16_Float_No_Alm:I:0. */
  datatype: string
  kind: ModuleKind
  /** Quantidade de pontos/canais. */
  size?: number
  /** true quando a quantidade foi deduzida pelos pontos usados. */
  sizeGuessed: boolean
}

export interface AliasRef {
  name: string
  scope: string
  description: string
}

export interface IoPoint {
  type: PointType
  direction: 'Entrada' | 'Saída'
  adapter: string
  slot: number
  /** Bit ou canal. */
  point: number
  /** Palavra, quando o endereço é Data[n].b (módulos de rede). */
  word?: number
  address: string
  comment: string
  aliases: AliasRef[]
  module?: IoModule
  spare: boolean
}

export interface NetworkComment {
  direction: 'Entrada' | 'Saída' | ''
  tag: string
  tagDescription: string
  address: string
  comment: string
}

export interface IoList {
  software?: string
  exportedAt?: string
  modules: IoModule[]
  points: IoPoint[]
  network: NetworkComment[]
  counts: Record<PointType, number>
  /** Pontos com tag ou comentário (sem contar reservas). */
  used: number
  spares: number
  tagCount: number
}

// ---------------------------------------------------------------------------
// Leitura do arquivo

/** O CSV costuma vir em ANSI (Windows-1252). Se não for UTF-8 válido, lê assim. */
export function decodeCsv(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Separa uma linha de CSV com campos entre aspas ("" vira "). */
export function splitCsvLine(line: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else quoted = false
      } else cur += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

/** Linhas lógicas: um campo entre aspas pode ter quebra de linha dentro. */
/**
 * O separador depende da configuração regional do Windows: em português o
 * Excel e o software do CLP costumam usar ponto e vírgula. Decide pela linha
 * de cabeçalho (TYPE;SCOPE;NAME...) ou, sem ela, pela primeira linha.
 */
export function detectSeparator(text: string): ',' | ';' | '\t' {
  const head = /^TYPE\s*([,;\t])\s*SCOPE/im.exec(text) ?? /^remark\s*([,;\t])/im.exec(text)
  if (head) return head[1] as ',' | ';' | '\t'
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (c: string) => first.split(c).length - 1
  if (count(';') > count(',')) return ';'
  if (count('\t') > count(',')) return '\t'
  return ','
}

function csvRows(text: string): string[][] {
  const sep = detectSeparator(text)
  const rows: string[][] = []
  let buf = ''
  for (const raw of text.split(/\r?\n/)) {
    buf = buf ? buf + '\n' + raw : raw
    const quotes = (buf.match(/"/g) ?? []).length
    if (quotes % 2 === 1) continue
    if (buf.trim()) rows.push(splitCsvLine(buf, sep))
    buf = ''
  }
  if (buf.trim()) rows.push(splitCsvLine(buf, sep))
  return rows
}

/** Textos do CLP usam $N para quebra de linha, $Q para aspas etc. */
export function unescapeLogix(s: string): string {
  return s.replace(/\$([NnLlRrTtPpQq$'])/g, (_, c: string) => {
    switch (c.toUpperCase()) {
      case 'N':
      case 'L':
        return '\n'
      case 'R':
      case 'P':
        return ''
      case 'T':
        return '\t'
      case 'Q':
        return '"'
      default:
        return c
    }
  })
}

/** Descrição numa linha só, para caber bem na planilha. */
export function oneLine(s: string): string {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' / ')
}

// ---------------------------------------------------------------------------
// Endereços de I/O

export interface IoAddress {
  adapter: string
  slot?: number
  kind: 'I' | 'O' | 'C' | 'S'
  /** Ch3Data, Pt00, Data... */
  member?: string
  point?: number
  word?: number
}

/**
 * Entende os formatos comuns:
 *   Rack:4:I.Data.19      Rack:I.Slot[4].Data.19   Rack:2:I.Ch7Data
 *   Local:1:I.Pt00.Data   Local:2:I.Ch00.Data      Rack:1:I.Data[5].3
 */
export function parseIoAddress(addr: string): IoAddress | undefined {
  const m = /^([A-Za-z_][\w]*):(?:(\d+):)?([ICOS])(?:\.SLOT\[(\d+)\])?(?:\.(.*))?$/i.exec(addr.trim())
  if (!m) return undefined
  const [, adapter, slotA, kindRaw, slotB, rest] = m
  const slotStr = slotA ?? slotB
  const out: IoAddress = {
    adapter,
    slot: slotStr !== undefined ? Number(slotStr) : undefined,
    kind: kindRaw.toUpperCase() as IoAddress['kind'],
  }
  if (!rest) return out
  let r: RegExpExecArray | null
  if ((r = /^DATA\[(\d+)\](?:\.(\d+))?$/i.exec(rest))) {
    out.member = 'Data'
    out.word = Number(r[1])
    if (r[2] !== undefined) out.point = Number(r[2])
  } else if ((r = /^DATA\.(\d+)$/i.exec(rest))) {
    out.member = 'Data'
    out.point = Number(r[1])
  } else if ((r = /^(Ch|Pt)(\d+)(Data|\.Data)?$/i.exec(rest))) {
    out.member = r[1].toLowerCase() === 'ch' ? 'Ch' : 'Pt'
    out.point = Number(r[2])
  } else {
    out.member = rest
  }
  return out
}

function displayAddress(a: IoAddress, style: 'Data' | 'Ch' | 'Pt'): string {
  const base = `${a.adapter}:${a.slot ?? ''}${a.slot !== undefined ? ':' : ''}${a.kind}`
  if (a.word !== undefined) return `${base}.Data[${a.word}]${a.point !== undefined ? '.' + a.point : ''}`
  if (style === 'Ch') return `${base}.Ch${a.point}Data`
  if (style === 'Pt') return `${base}.Pt${String(a.point).padStart(2, '0')}.Data`
  return `${base}.Data.${a.point}`
}

function pointKey(adapter: string, slot: number, kind: string, word: number | undefined, point: number): string {
  return `${adapter.toLowerCase()}|${slot}|${kind}|${word ?? ''}|${point}`
}

// ---------------------------------------------------------------------------
// Módulos

const COMM = /^(DNB|CNB|CNBR|CN2|CN2R|CN2RR|ENBT|EN2T|EN2TR|EN2F|EN3TR|EN4TR|ENET|AENT|AENTR|ADN|SDN|ACN|ACNR|DHRIO|SCANNER|ETHERNET|DNET|PB|ARM)/i

/** Tira "AB:" e o sufixo ":I:0" e devolve o catálogo e o tipo do módulo. */
export function describeModule(datatype: string): { catalog: string; kind: ModuleKind; size?: number } {
  const core = datatype.replace(/^[A-Z]+:/i, '').replace(/:[ICOS]:\d+$/i, '')
  const parts = core.split('_')
  const family = parts[0]
  const model = parts[1] ?? ''
  const catalog = model && /^\d{4}$/.test(family) ? `${family}-${model}` : core
  const sizeMatch = /(\d+)/.exec(model)
  const size = sizeMatch ? Number(sizeMatch[1]) : undefined
  let kind: ModuleKind = 'OUTRO'
  if (COMM.test(model) || COMM.test(family)) kind = 'REDE'
  else if (/^(IF|IR|IT|IY|IE|IRT|IJ)/i.test(model)) kind = 'AI'
  else if (/^(OF|OE)/i.test(model)) kind = 'AO'
  else if (/^HSC|^CFM|^PLS|^M\d/i.test(model)) kind = 'OUTRO'
  else if (/^(DI|I[A-Z]?\d|I[A-Z]{1,2}\d)/i.test(model)) kind = 'DI'
  else if (/^(DO|O[A-Z]?\d|O[A-Z]{1,2}\d)/i.test(model)) kind = 'DO'
  return { catalog, kind, size: kind === 'REDE' || kind === 'OUTRO' ? undefined : size }
}

// ---------------------------------------------------------------------------
// Montagem da lista

interface RawAlias {
  name: string
  scope: string
  description: string
  target: string
}

const NETWORK_OWNER = /dnet|devicenet|dnb|d_net/i

function guessDirection(name: string): 'Entrada' | 'Saída' | '' {
  if (/(^|_)(I|IN|INP|INPUT|ENT|LEIT|READ)(_|$|\d)/i.test(name)) return 'Entrada'
  if (/(^|_)(O|OUT|OUTPUT|SAI|SAIDA|ESC|WRITE)(_|$|\d)/i.test(name)) return 'Saída'
  return ''
}

function rawTarget(alias: string, aliases: Map<string, RawAlias>, depth = 0): string {
  if (depth > 8) return alias
  const m = /^([^.[]+)(.*)$/.exec(alias)
  if (!m) return alias
  const hit = aliases.get(m[1].toLowerCase())
  if (!hit || hit.target === alias) return alias
  return rawTarget(hit.target + m[2], aliases, depth + 1)
}

export interface BuildOptions {
  /** Inclui os pontos livres de cada módulo como "Reserva". */
  spares?: boolean
}

export function buildIoList(text: string, opts: BuildOptions = {}): IoList {
  const rows = csvRows(text)
  const headerOk = rows.some((r) => r[0]?.trim().toUpperCase() === 'TYPE' && r[2]?.trim().toUpperCase() === 'NAME')
  if (!headerOk) {
    throw new TagCsvError(
      'Este arquivo não parece ser o CSV de tags exportado do CLP. Ele precisa ter as colunas TYPE, SCOPE, NAME, DESCRIPTION, DATATYPE.',
    )
  }

  let software: string | undefined
  let exportedAt: string | undefined
  const tags: { scope: string; name: string; description: string; datatype: string }[] = []
  const aliases: RawAlias[] = []
  const comments: { owner: string; text: string; address: string }[] = []

  for (const r of rows) {
    const type = r[0]?.toUpperCase()
    if (type === 'REMARK') {
      const v = r[1] ?? ''
      const ver = /^Version\s*=\s*.*?(v[\d.]+)\s*$/i.exec(v)
      if (ver) software = ver[1]
      const dt = /^Date\s*=\s*(.+)$/i.exec(v)
      if (dt) exportedAt = dt[1].trim()
    } else if (type === 'TAG') {
      tags.push({ scope: r[1] ?? '', name: r[2] ?? '', description: unescapeLogix(r[3] ?? ''), datatype: r[4] ?? '' })
    } else if (type === 'ALIAS') {
      aliases.push({ scope: r[1] ?? '', name: r[2] ?? '', description: unescapeLogix(r[3] ?? ''), target: r[5] ?? '' })
    } else if (type === 'COMMENT') {
      comments.push({ owner: r[2] ?? '', text: unescapeLogix(r[3] ?? ''), address: r[5] ?? '' })
    }
  }

  // Módulos: tags de módulo (Rack:Slot:I/O/C) e aliases de slot do rack.
  const modules = new Map<string, IoModule>()
  const modKey = (adapter: string, slot: number) => `${adapter.toLowerCase()}|${slot}`
  for (const t of tags) {
    const a = parseIoAddress(t.name)
    if (!a || a.slot === undefined || a.member) continue
    const key = modKey(a.adapter, a.slot)
    const info = describeModule(t.datatype)
    const prev = modules.get(key)
    // A tag :C ou :I costuma ter o nome mais completo do módulo; mantém o primeiro.
    if (!prev) {
      modules.set(key, {
        adapter: a.adapter,
        slot: a.slot,
        catalog: info.catalog,
        datatype: t.datatype,
        kind: info.kind,
        size: info.size,
        sizeGuessed: false,
      })
    }
  }

  // Aliases por nome, para resolver alias de alias.
  const aliasByName = new Map<string, RawAlias>()
  for (const al of aliases) if (!aliasByName.has(al.name.toLowerCase())) aliasByName.set(al.name.toLowerCase(), al)

  const points = new Map<string, IoPoint>()
  const styles = new Map<string, 'Data' | 'Ch' | 'Pt'>()

  function pointFor(addr: string): IoPoint | undefined {
    const a = parseIoAddress(addr) ?? parseIoAddress(rawTarget(addr, aliasByName))
    if (!a || a.slot === undefined || a.point === undefined) return undefined
    if (a.kind !== 'I' && a.kind !== 'O') return undefined
    const mod = modules.get(modKey(a.adapter, a.slot))
    const isAnalog = mod?.kind === 'AI' || mod?.kind === 'AO' || a.member === 'Ch'
    // Módulo analógico de saída tem uma tag :I de eco; não é ponto de campo.
    if (mod?.kind === 'AO' && a.kind === 'I') return undefined
    if (mod?.kind === 'AI' && a.kind === 'O') return undefined
    let type: PointType
    if (mod?.kind === 'REDE' || a.word !== undefined) type = 'REDE'
    else if (isAnalog) type = a.kind === 'I' ? 'AI' : 'AO'
    else type = a.kind === 'I' ? 'DI' : 'DO'
    const key = pointKey(a.adapter, a.slot, a.kind, a.word, a.point)
    let p = points.get(key)
    if (!p) {
      const style: 'Data' | 'Ch' | 'Pt' = a.member === 'Ch' ? 'Ch' : a.member === 'Pt' ? 'Pt' : 'Data'
      styles.set(modKey(a.adapter, a.slot), style)
      p = {
        type,
        direction: a.kind === 'I' ? 'Entrada' : 'Saída',
        adapter: mod?.adapter ?? a.adapter,
        slot: a.slot,
        point: a.point,
        word: a.word,
        address: displayAddress({ ...a, adapter: mod?.adapter ?? a.adapter }, style),
        comment: '',
        aliases: [],
        module: mod,
        spare: false,
      }
      points.set(key, p)
    }
    return p
  }

  const network: NetworkComment[] = []
  const tagDesc = new Map(tags.map((t) => [t.name.toLowerCase(), t.description]))

  for (const c of comments) {
    const p = pointFor(c.address)
    if (p) {
      if (!p.comment) p.comment = oneLine(c.text)
      continue
    }
    if (NETWORK_OWNER.test(c.owner)) {
      network.push({
        direction: guessDirection(c.owner),
        tag: c.owner,
        tagDescription: oneLine(tagDesc.get(c.owner.toLowerCase()) ?? ''),
        address: c.address,
        comment: oneLine(c.text),
      })
    }
  }

  for (const al of aliases) {
    // Alias de slot inteiro (Rack:4:I -> Rack:I.Slot[4]) não é ponto.
    const p = pointFor(al.target)
    if (!p) continue
    p.aliases.push({ name: al.name, scope: al.scope, description: oneLine(al.description) })
  }

  // Tamanho dos módulos e pontos de reserva.
  const used = new Map<string, number>()
  for (const p of points.values()) {
    if (p.word !== undefined) continue
    const k = modKey(p.adapter, p.slot) + '|' + p.direction
    used.set(k, Math.max(used.get(k) ?? -1, p.point))
  }
  for (const m of modules.values()) {
    if (m.kind === 'REDE' || m.kind === 'OUTRO') continue
    const dir = m.kind === 'DI' || m.kind === 'AI' ? 'Entrada' : 'Saída'
    const max = used.get(modKey(m.adapter, m.slot) + '|' + dir) ?? -1
    if (m.size === undefined || m.size <= max) {
      m.sizeGuessed = true
      m.size = m.kind === 'DI' || m.kind === 'DO' ? (max >= 16 ? 32 : max >= 8 ? 16 : max >= 0 ? 16 : undefined) : max + 1 || undefined
    }
    if (!opts.spares || !m.size) continue
    const kind = dir === 'Entrada' ? 'I' : 'O'
    const style = styles.get(modKey(m.adapter, m.slot)) ?? (m.kind === 'AI' || m.kind === 'AO' ? 'Ch' : 'Data')
    for (let i = 0; i < m.size; i++) {
      const key = pointKey(m.adapter, m.slot, kind, undefined, i)
      if (points.has(key)) continue
      points.set(key, {
        type: m.kind as PointType,
        direction: dir,
        adapter: m.adapter,
        slot: m.slot,
        point: i,
        address: displayAddress({ adapter: m.adapter, slot: m.slot, kind, point: i }, style),
        comment: '',
        aliases: [],
        module: m,
        spare: true,
      })
    }
  }

  const list = [...points.values()]
  list.sort(
    (a, b) =>
      a.adapter.localeCompare(b.adapter, 'pt-BR', { numeric: true }) ||
      a.slot - b.slot ||
      a.direction.localeCompare(b.direction) ||
      (a.word ?? -1) - (b.word ?? -1) ||
      a.point - b.point,
  )

  const counts: Record<PointType, number> = { DI: 0, DO: 0, AI: 0, AO: 0, REDE: 0 }
  for (const p of list) if (!p.spare) counts[p.type]++

  return {
    software,
    exportedAt,
    modules: [...modules.values()].sort(
      (a, b) => a.adapter.localeCompare(b.adapter, 'pt-BR', { numeric: true }) || a.slot - b.slot,
    ),
    points: list,
    network,
    counts,
    used: list.filter((p) => !p.spare).length,
    spares: list.filter((p) => p.spare).length,
    tagCount: tags.length + aliases.length,
  }
}

/** Descrição principal do ponto: comentário do endereço, senão a do alias. */
export function pointDescription(p: IoPoint): string {
  if (p.comment) return p.comment
  return p.aliases.find((a) => a.description)?.description ?? ''
}

export const TYPE_LABEL: Record<PointType, string> = {
  DI: 'Entrada digital',
  DO: 'Saída digital',
  AI: 'Entrada analógica',
  AO: 'Saída analógica',
  REDE: 'Rede',
}

export const MODULE_LABEL: Record<ModuleKind, string> = {
  DI: 'Entrada digital',
  DO: 'Saída digital',
  AI: 'Entrada analógica',
  AO: 'Saída analógica',
  REDE: 'Comunicação / rede',
  OUTRO: 'Outro',
}
