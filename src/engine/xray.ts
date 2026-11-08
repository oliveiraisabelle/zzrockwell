// Raio-X: inventário do que tem dentro de um L5X, sem alterar nada.

export interface ModuleInfo {
  name: string
  catalog: string
  parent: string
  revision: string
}

export interface XRay {
  programs: number
  routines: Record<string, number>
  rungs: number
  controllerTags: number
  programTags: number
  dataTypes: number
  addOns: number
  tasks: number
  modules: ModuleInfo[]
}

/** Elementos com `Use="Context"` são só referência e não contam como conteúdo. */
function own(doc: Document, selector: string): Element[] {
  return Array.from(doc.querySelectorAll(selector)).filter((e) => e.getAttribute('Use') !== 'Context')
}

export function xray(doc: Document): XRay {
  const routines: Record<string, number> = {}
  for (const r of own(doc, 'Routine')) {
    const type = r.getAttribute('Type') ?? '?'
    routines[type] = (routines[type] ?? 0) + 1
  }
  const modules = own(doc, 'Modules > Module').map((m) => {
    const major = m.getAttribute('Major')
    const minor = m.getAttribute('Minor')
    return {
      name: m.getAttribute('Name') ?? '',
      catalog: m.getAttribute('CatalogNumber') ?? '',
      parent: m.getAttribute('ParentModule') ?? '',
      revision: major ? `${major}.${minor ?? '0'}` : '',
    }
  })
  return {
    programs: own(doc, 'Programs > Program').length,
    routines,
    rungs: doc.querySelectorAll('RLLContent > Rung').length,
    controllerTags: own(doc, 'Controller > Tags > Tag').length,
    programTags: own(doc, 'Program > Tags > Tag').length,
    dataTypes: own(doc, 'DataTypes > DataType').length,
    addOns: own(doc, 'AddOnInstructionDefinitions > AddOnInstructionDefinition').length,
    tasks: own(doc, 'Tasks > Task').length,
    modules,
  }
}

export const ROUTINE_TYPES: Record<string, string> = {
  RLL: 'Ladder',
  ST: 'Texto estruturado',
  FBD: 'Blocos de função',
  SFC: 'SFC',
}
