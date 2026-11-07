import { isSafetyCatalog } from './controllers'
import { unknownIn } from './signature'
import { CONTROLLER_FAMILIES, FEATURE_RULES, VERSIONS, type ControllerFamily, type Severity } from './rules'

export interface L5xInfo {
  softwareRevision: string
  majorVersion: number
  /** `Controller` (projeto inteiro), `Routine`, `Rung`, `AddOnInstructionDefinition`, `DataType`... */
  targetType: string
  processorType?: string
  family?: ControllerFamily
  moduleCount: number
}

export interface Finding {
  severity: Severity
  message: string
  /** Quantas ocorrências no arquivo, quando faz sentido contar. */
  count?: number
  /** Lista curta de exemplos (nomes de elementos, atributos...). */
  details?: string[]
}

export interface ConvertOptions {
  /** Novo modelo de CLP; ausente ou igual ao atual mantém o controlador. */
  processorType?: string
  /** Assinatura aprendida de um arquivo real da versão alvo. */
  learned?: string[]
}

export interface ConversionResult {
  ok: boolean
  /** O L5X convertido; ausente quando algum achado bloqueia a conversão. */
  output?: string
  changes: string[]
  findings: Finding[]
}

export class L5xError extends Error {}

const ROOT_TAG = /<RSLogix5000Content\b[^>]*>/
const CONTROLLER_TAG = /<Controller\b[^>]*>/
const LOCAL_MODULE_TAG = /<Module\b[^>]*\sName="Local"[^>]*>/

export function parseL5x(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new L5xError('O arquivo não é um XML válido.')
  }
  if (doc.documentElement.nodeName !== 'RSLogix5000Content') {
    throw new L5xError('O arquivo não parece ser um L5X (falta o elemento RSLogix5000Content).')
  }
  return doc
}

export function analyze(doc: Document): L5xInfo {
  const root = doc.documentElement
  const softwareRevision = root.getAttribute('SoftwareRevision') ?? ''
  const majorVersion = Number.parseInt(softwareRevision, 10)
  if (!Number.isFinite(majorVersion)) {
    throw new L5xError('Não encontrei a versão (SoftwareRevision) no arquivo.')
  }
  const processorType = doc.querySelector('Controller')?.getAttribute('ProcessorType') ?? undefined
  return {
    softwareRevision,
    majorVersion,
    targetType: root.getAttribute('TargetType') ?? 'Desconhecido',
    processorType,
    family: processorType ? findFamily(processorType) : undefined,
    moduleCount: doc.querySelectorAll('Modules > Module').length,
  }
}

export function findFamily(processorType: string): ControllerFamily | undefined {
  return CONTROLLER_FAMILIES.find((f) => f.pattern.test(processorType))
}

/**
 * Versões para as quais o arquivo pode ir, respeitando o CLP quando conhecido.
 * Com troca de controlador, a versão atual também vale (só troca o CLP).
 */
export function availableTargets(info: L5xInfo, processorType?: string): number[] {
  const changing = isControllerChange(info, processorType)
  const family = changing ? findFamily(processorType!) : info.family
  const list = VERSIONS.filter((v) => {
    if (v >= info.majorVersion) return false
    if (family && v < family.minVersion) return false
    return true
  }) as number[]
  if (changing && (!family || info.majorVersion >= family.minVersion)) list.push(info.majorVersion)
  return list
}

export function isControllerChange(info: L5xInfo, processorType: string | undefined): boolean {
  return !!processorType && !!info.processorType && processorType !== info.processorType
}

export function checkCompatibility(doc: Document, original: L5xInfo, target: number, opts: ConvertOptions = {}): Finding[] {
  const findings: Finding[] = []
  const changing = isControllerChange(original, opts.processorType)
  const info: L5xInfo = changing
    ? { ...original, processorType: opts.processorType, family: findFamily(opts.processorType!) }
    : original

  if (changing && isSafetyCatalog(original.processorType!) !== isSafetyCatalog(opts.processorType!)) {
    findings.push({
      severity: 'block',
      message: 'Não dá para trocar entre CLP de segurança e CLP comum: a tarefa de segurança e as tags de segurança não têm equivalente.',
    })
  }
  if (changing) {
    findings.push({
      severity: 'review',
      message: 'Na troca de CLP, o código de produto (ProductCode) do módulo local foi mantido. Se o Studio 5000 reclamar na importação, troque o controlador por lá.',
    })
  }

  if (doc.querySelector('EncodedData')) {
    findings.push({
      severity: 'block',
      message: 'O arquivo tem conteúdo protegido (EncodedData). Conteúdo protegido não pode ser convertido.',
    })
  }

  if (info.family && target < info.family.minVersion) {
    findings.push({
      severity: 'block',
      message: `O CLP ${info.processorType} (${info.family.name}) só é suportado a partir da v${info.family.minVersion}.`,
    })
  } else if (info.processorType && !info.family) {
    findings.push({
      severity: 'review',
      message: `CLP ${info.processorType} não está na base de regras. Confira se a v${target} suporta esse modelo.`,
    })
  }

  for (const rule of FEATURE_RULES) {
    if (target >= rule.minVersion) continue
    const count = doc.querySelectorAll(rule.selector).length
    if (count > 0) {
      findings.push({
        severity: rule.severity,
        message: `${rule.description} só existe a partir da v${rule.minVersion}.`,
        count,
      })
    }
  }

  if (info.targetType === 'Controller' && info.moduleCount > 0) {
    findings.push({
      severity: 'review',
      message: `Confira se os perfis dos módulos de I/O existem na v${target}.`,
      count: info.moduleCount,
    })
  }

  if (opts.learned && opts.learned.length > 0) {
    const unknown = unknownIn(doc, opts.learned)
    if (unknown.length > 0) {
      findings.push({
        severity: 'review',
        message: `Itens que nunca apareceram nos arquivos v${target} que você ensinou. Podem não existir nessa versão.`,
        count: unknown.length,
        details: unknown.slice(0, 12),
      })
    }
  }

  return findings
}

/**
 * Rebaixa o L5X para a versão `target` e, se pedido, troca o modelo do CLP,
 * sem reformatar o resto do arquivo.
 */
export function convert(xml: string, target: number, opts: ConvertOptions = {}): ConversionResult {
  const doc = parseL5x(xml)
  const info = analyze(doc)
  const changing = isControllerChange(info, opts.processorType)

  if (target > info.majorVersion || (target === info.majorVersion && !changing)) {
    throw new L5xError(`O arquivo já está na v${info.majorVersion}. Só é possível converter para uma versão mais antiga.`)
  }
  if (opts.processorType && !info.processorType) {
    throw new L5xError('Este arquivo não tem controlador definido, então não dá para trocar o CLP.')
  }

  const findings = checkCompatibility(doc, info, target, opts)
  if (findings.some((f) => f.severity === 'block')) {
    return { ok: false, changes: [], findings }
  }

  const changes: string[] = []
  const downgrade = target < info.majorVersion
  let output = xml
  if (downgrade) {
    const newRevision = `${target}.00`
    output = output.replace(ROOT_TAG, (tag) => setAttribute(tag, 'SoftwareRevision', newRevision))
    changes.push(`SoftwareRevision: ${info.softwareRevision} → ${newRevision}`)
  }

  output = output.replace(CONTROLLER_TAG, (tag) => {
    let out = tag
    const major = getAttribute(tag, 'MajorRev')
    if (downgrade && major !== undefined) {
      changes.push(`Controller MajorRev: ${major} → ${target}`)
      out = setAttribute(out, 'MajorRev', String(target))
    }
    if (changing) {
      changes.push(`Controller ProcessorType: ${info.processorType} → ${opts.processorType}`)
      out = setAttribute(out, 'ProcessorType', opts.processorType!)
    }
    return out
  })

  output = output.replace(LOCAL_MODULE_TAG, (tag) => {
    let out = tag
    const major = getAttribute(tag, 'Major')
    if (downgrade && major !== undefined && major !== String(target)) {
      changes.push(`Módulo Local Major: ${major} → ${target}`)
      out = setAttribute(out, 'Major', String(target))
    }
    const catalog = getAttribute(tag, 'CatalogNumber')
    if (changing && catalog !== undefined) {
      changes.push(`Módulo Local CatalogNumber: ${catalog} → ${opts.processorType}`)
      out = setAttribute(out, 'CatalogNumber', opts.processorType!)
    }
    return out
  })

  if (downgrade && changes.some((c) => c.startsWith('Controller MajorRev'))) {
    findings.push({
      severity: 'review',
      message: 'O MinorRev do firmware foi mantido. Ajuste no Studio 5000 se a revisão não existir na versão alvo.',
    })
  }

  return { ok: true, output, changes, findings }
}

function getAttribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
}

function setAttribute(tag: string, name: string, value: string): string {
  return tag.replace(new RegExp(`(\\s${name}=")[^"]*(")`), `$1${value}$2`)
}
