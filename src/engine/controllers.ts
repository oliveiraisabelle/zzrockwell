// Catálogo de modelos de CLP oferecidos na troca de controlador.
// A família (e com ela a versão mínima) vem de CONTROLLER_FAMILIES em rules.ts.

export interface ControllerModel {
  catalog: string
  /** Controladores de segurança (GuardLogix / Compact GuardLogix). */
  safety: boolean
}

export interface ControllerGroup {
  label: string
  models: ControllerModel[]
}

const std = (...c: string[]) => c.map((catalog) => ({ catalog, safety: false }))
const saf = (...c: string[]) => c.map((catalog) => ({ catalog, safety: true }))

export const CONTROLLER_GROUPS: ControllerGroup[] = [
  { label: 'ControlLogix 5580', models: std('1756-L81E', '1756-L82E', '1756-L83E', '1756-L84E', '1756-L85E') },
  { label: 'GuardLogix 5580', models: saf('1756-L81ES', '1756-L82ES', '1756-L83ES', '1756-L84ES') },
  { label: 'ControlLogix 5570', models: std('1756-L71', '1756-L72', '1756-L73', '1756-L74', '1756-L75') },
  { label: 'GuardLogix 5570', models: saf('1756-L71S', '1756-L72S', '1756-L73S') },
  { label: 'CompactLogix 5380', models: std('5069-L306ER', '5069-L310ER', '5069-L320ER', '5069-L330ER', '5069-L340ER') },
  { label: 'CompactLogix 5370', models: std('1769-L18ER-BB1B', '1769-L24ER-QB1B', '1769-L30ER', '1769-L33ER', '1769-L36ERM') },
]

/** Identifica CLPs de segurança pelo número de catálogo. */
export function isSafetyCatalog(catalog: string): boolean {
  return /^1756-L[78]\dE?S/i.test(catalog) || /^5069-L3\d+ERS/i.test(catalog) || /^1769-L3\dERMS/i.test(catalog)
}
