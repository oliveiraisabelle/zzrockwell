// Base de regras de compatibilidade por versão do Studio 5000 / RSLogix 5000.
//
// IMPORTANTE: os valores abaixo foram levantados de memória e estão marcados
// com `verified: false` até serem conferidos nas release notes da Rockwell e
// com arquivos L5X reais. Adicionar uma versão ou regra nova é só editar dados.

/** Versões principais suportadas como destino da conversão. */
export const VERSIONS = [20, 21, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36] as const

export interface ControllerFamily {
  name: string
  /** Testado contra o atributo `ProcessorType` do elemento `Controller`. */
  pattern: RegExp
  minVersion: number
  /** Última versão suportada; ausente quando a família ainda é atual. */
  maxVersion?: number
  verified: boolean
}

export const CONTROLLER_FAMILIES: ControllerFamily[] = [
  { name: 'ControlLogix 5560 (1756-L6x)', pattern: /^1756-L6\d/i, minVersion: 12, maxVersion: 20, verified: false },
  { name: 'GuardLogix 5580 (1756-L8xES)', pattern: /^1756-L8\dES/i, minVersion: 31, verified: false },
  { name: 'ControlLogix 5580 (1756-L8x)', pattern: /^1756-L8\d/i, minVersion: 28, verified: false },
  { name: 'GuardLogix 5570 (1756-L7xS)', pattern: /^1756-L7\dS/i, minVersion: 20, maxVersion: 33, verified: false },
  { name: 'ControlLogix 5570 (1756-L7x)', pattern: /^1756-L7\d/i, minVersion: 19, maxVersion: 33, verified: false },
  { name: 'CompactLogix 5380 (5069-L3xxER)', pattern: /^5069-L3/i, minVersion: 28, verified: false },
  { name: 'CompactLogix 5480 (5069-L4xx)', pattern: /^5069-L4/i, minVersion: 32, verified: false },
  { name: 'CompactLogix 5370 (1769-L1x/L2x/L3xER)', pattern: /^1769-L(1\d|2\d|3\dER)/i, minVersion: 20, maxVersion: 33, verified: false },
  { name: 'CompactLogix 1769-L3x', pattern: /^1769-L3\d/i, minVersion: 13, maxVersion: 20, verified: false },
]

export type Severity = 'block' | 'review'

export interface FeatureRule {
  id: string
  description: string
  /** Primeira versão que suporta o recurso. */
  minVersion: number
  /** Seletor CSS aplicado ao documento L5X. */
  selector: string
  /** `block` impede a conversão; `review` converte mas exige revisão manual. */
  severity: Severity
  verified: boolean
}

export const FEATURE_RULES: FeatureRule[] = [
  {
    id: 'program-parameters',
    description: 'Parâmetros de programa (Program Parameters)',
    minVersion: 24,
    selector: 'Program > Parameters > Parameter',
    severity: 'block',
    verified: false,
  },
  {
    id: 'tag-based-alarms',
    description: 'Alarmes baseados em tag (AlarmConditions)',
    minVersion: 31,
    selector: 'AlarmConditions',
    severity: 'block',
    verified: false,
  },
]
