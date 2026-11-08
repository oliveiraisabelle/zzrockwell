// Converte o XML de uma tela exportada das versões 13 a 16 do supervisório
// para importar na versão 12 (SE). Trabalha direto no texto para manter o
// resto do arquivo igual, byte a byte; só os trechos incompatíveis mudam.

export class DisplayError extends Error {}

export interface DisplayFix {
  id: string
  label: string
  /** O que a correção significa para quem vai importar. */
  note: string
  /** `review` quando algum comportamento da tela se perde. */
  severity: 'info' | 'review'
  count: number
  /** Nomes dos objetos afetados (quando têm nome). */
  objects: string[]
}

export interface DisplayResult {
  output: string
  fixes: DisplayFix[]
  total: number
}

export interface DisplayInfo {
  /** Versão do schema citada no arquivo (Gfx-SE16.xsd → 16). */
  version?: number
  objectCount: number
  name?: string
}

const SCHEMA = /Gfx-SE(\d+)\.xsd/g
const START_TAG = /<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*\/?)>/g

export function inspectDisplay(text: string): DisplayInfo {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) throw new DisplayError('O arquivo não é um XML válido.')
  const root = doc.documentElement
  const schema = /Gfx-SE(\d+)\.xsd/.exec(text)
  if (!schema && root.nodeName.toLowerCase() !== 'gfx') {
    throw new DisplayError('Não parece ser o XML de uma tela exportada (falta o elemento gfx ou o schema Gfx-SE).')
  }
  const display = root.getElementsByTagName('displaySettings')[0] ?? root
  return {
    version: schema ? Number(schema[1]) : undefined,
    objectCount: root.querySelectorAll('[exposeToVba]').length || root.querySelectorAll('[name]').length,
    name: display.getAttribute('name') ?? undefined,
  }
}

function attr(attrs: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs)?.[1]
}

class Fixer {
  fixes: DisplayFix[] = []
  constructor(public text: string) {}

  private add(id: string, label: string, note: string, severity: DisplayFix['severity']): DisplayFix {
    const fix = { id, label, note, severity, count: 0, objects: [] }
    this.fixes.push(fix)
    return fix
  }

  private touch(fix: DisplayFix, name: string | undefined, n = 1) {
    fix.count += n
    if (name && !fix.objects.includes(name)) fix.objects.push(name)
  }

  /** Reescreve os atributos de cada tag de abertura; `edit` devolve os atributos novos. */
  startTags(edit: (tag: string, attrs: string) => string) {
    this.text = this.text.replace(START_TAG, (whole, tag: string, attrs: string, end: string) => {
      const next = edit(tag, attrs)
      return next === attrs ? whole : `<${tag}${next}${end}>`
    })
  }

  /** Remove blocos inteiros, levando junto a quebra de linha e o recuo antes deles. */
  blocks(re: RegExp, fix: DisplayFix, nameOf?: (block: string) => string | undefined) {
    this.text = this.text.replace(re, (block: string) => {
      this.touch(fix, nameOf?.(block))
      return ''
    })
  }

  schema() {
    const fix = this.add('schema', 'Schema da tela trocado para a versão 12', 'O cabeçalho passa a apontar para Gfx-SE12.xsd.', 'info')
    this.text = this.text.replace(SCHEMA, (m, v: string) => {
      if (Number(v) <= 12) return m
      fix.count++
      return 'Gfx-SE12.xsd'
    })
  }

  globalObjects() {
    const fix = this.add(
      'global-objects',
      'Vínculos com Global Objects desfeitos',
      'Os objetos continuam na tela, mas viram cópias comuns: mudanças no Global Object original não chegam mais neles.',
      'review',
    )
    this.startTags((_tag, attrs) => {
      if (!/\sisReferenceObject\s*=\s*"true"/i.test(attrs)) return attrs
      this.touch(fix, attr(attrs, 'name'))
      return attrs.replace(/(\sisReferenceObject\s*=\s*")true(")/i, '$1false$2')
    })
    // Parâmetros de Global Object: o bloco pertence ao objeto de referência anterior.
    this.blocks(/(?:\r?\n[ \t]*)?(?:<parameters\b[^>]*\/>|<parameters\b[^>]*>[\s\S]*?<\/parameters>)/g, fix)
  }

  activeX() {
    const fix = this.add(
      'activex',
      'Controles ActiveX com eventos removidos',
      'Esses controles somem da tela. Recrie-os na versão 12 se forem necessários.',
      'review',
    )
    this.blocks(
      /(?:\r?\n[ \t]*)?<activeX\b[^>]*>(?:(?!<\/activeX>)[\s\S])*?<ActiveXEvents[\s\S]*?<\/activeX>/g,
      fix,
      (block) => attr(block.slice(0, block.indexOf('>')), 'name'),
    )
  }

  visual() {
    const fix = this.add(
      'visual',
      'Cantos arredondados e cor de borda removidos',
      'Os objetos ficam com cantos retos e a borda padrão.',
      'info',
    )
    this.startTags((_tag, attrs) => {
      const n = countAttrs(attrs, ['cornerRadius', 'borderColor'])
      if (n === 0) return attrs
      this.touch(fix, attr(attrs, 'name'), n)
      return attrs.replace(/\s+(?:cornerRadius|borderColor)\s*=\s*"[^"]*"/g, '')
    })
  }

  buttonStyle() {
    const fix = this.add('button-style', 'Botões com estilo "line" trocados por "noborder"', 'O visual do botão muda um pouco.', 'info')
    this.startTags((tag, attrs) => {
      if (tag !== 'button' || !/\sstyle\s*=\s*"line"/.test(attrs)) return attrs
      this.touch(fix, attr(attrs, 'name'))
      return attrs.replace(/(\sstyle\s*=\s*")line(")/, '$1noborder$2')
    })
  }

  audit() {
    const fix = this.add(
      'audit',
      'Comentários, auditoria, assinatura e confirmação removidos',
      'Botões e campos perdem a confirmação, o pedido de comentário e a assinatura eletrônica. Confira se a operação precisa disso.',
      'review',
    )
    // Primeiro os blocos inteiros (eles já levam os atributos de dentro), depois os atributos soltos.
    for (const tag of ['useVariable', 'eSignature', 'confirm']) {
      this.blocks(new RegExp(`(?:\\r?\\n[ \\t]*)?(?:<${tag}\\b[^>]*\\/>|<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>)`, 'g'), fix)
    }
    const names = ['remarkInfo', 'remarkCheck', 'displayOnScreenKeypad', 'keypadCustomCaption', 'ConfirmationMessage', 'ShowConfirmationMessage']
    const re = new RegExp(`\\s+(?:${names.join('|')})\\s*=\\s*"[^"]*"`, 'gi')
    this.startTags((_tag, attrs) => {
      const n = (attrs.match(re) ?? []).length
      if (n === 0) return attrs
      this.touch(fix, attr(attrs, 'name'), n)
      return attrs.replace(re, '')
    })
  }

  prefix(prefix: string) {
    const fix = this.add(
      'prefix',
      `Prefixo "${prefix}" nos nomes dos objetos`,
      'Evita conflito com objetos de mesmo nome na tela de destino. Comandos que citam objetos pelo nome precisam ser ajustados.',
      'review',
    )
    this.startTags((_tag, attrs) => {
      // Só objetos gráficos (todos têm exposeToVba). Assim ficam de fora o nome
      // da tela e as conexões (name="Value"), que quebrariam se renomeadas.
      if (!/\sexposeToVba\s*=/.test(attrs)) return attrs
      const name = attr(attrs, 'name')
      if (name === undefined || name === '' || name.startsWith(prefix)) return attrs
      this.touch(fix, undefined)
      return attrs.replace(/(\sname\s*=\s*")([^"]*")/, `$1${escapeReplacement(prefix)}$2`)
    })
  }
}

function countAttrs(attrs: string, names: string[]): number {
  return (attrs.match(new RegExp(`\\s(?:${names.join('|')})\\s*=`, 'g')) ?? []).length
}

function escapeReplacement(s: string): string {
  return s.replace(/\$/g, '$$$$')
}

/** Só letras, números e sublinhado, como os nomes de objeto aceitos na tela. */
export function isValidPrefix(prefix: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)
}

export function convertToSe12(text: string, opts: { prefix?: string } = {}): DisplayResult {
  inspectDisplay(text)
  if (opts.prefix && !isValidPrefix(opts.prefix)) {
    throw new DisplayError('O prefixo só pode ter letras, números e sublinhado, e não pode começar com número.')
  }
  const f = new Fixer(text)
  f.schema()
  f.globalObjects()
  f.activeX()
  f.visual()
  f.buttonStyle()
  f.audit()
  if (opts.prefix) f.prefix(opts.prefix)
  return { output: f.text, fixes: f.fixes, total: f.fixes.reduce((a, x) => a + x.count, 0) }
}
