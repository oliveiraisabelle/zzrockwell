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

/** Versões para as quais o arquivo pode ser rebaixado, respeitando o CLP quando conhecido. */
export function availableTargets(info: L5xInfo): number[] {
  return VERSIONS.filter((v) => {
    if (v >= info.majorVersion) return false
    if (info.family && v < info.family.minVersion) return false
    return true
  })
}

export function checkCompatibility(doc: Document, info: L5xInfo, target: number): Finding[] {
  const findings: Finding[] = []

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

  return findings
}

/** Rebaixa o L5X para a versão `target`, sem reformatar o resto do arquivo. */
export function convert(xml: string, target: number): ConversionResult {
  const doc = parseL5x(xml)
  const info = analyze(doc)

  if (target >= info.majorVersion) {
    throw new L5xError(`O arquivo já está na v${info.majorVersion}. Só é possível converter para uma versão mais antiga.`)
  }

  const findings = checkCompatibility(doc, info, target)
  if (findings.some((f) => f.severity === 'block')) {
    return { ok: false, changes: [], findings }
  }

  const changes: string[] = []
  const newRevision = `${target}.00`
  let output = xml.replace(ROOT_TAG, (tag) => setAttribute(tag, 'SoftwareRevision', newRevision))
  changes.push(`SoftwareRevision: ${info.softwareRevision} → ${newRevision}`)

  output = output.replace(CONTROLLER_TAG, (tag) => {
    const major = getAttribute(tag, 'MajorRev')
    if (major === undefined) return tag
    changes.push(`Controller MajorRev: ${major} → ${target}`)
    return setAttribute(tag, 'MajorRev', String(target))
  })
  if (changes.length > 1) {
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
