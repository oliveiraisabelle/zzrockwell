// "Aprender versão": guarda quais elementos e atributos aparecem em uma
// exportação real de cada versão. Na conversão, o que o arquivo usa e nunca
// apareceu nos arquivos ensinados da versão alvo vira ponto de revisão.

/** Pares `Elemento` e `Elemento@atributo` presentes no documento. */
export function signatureOf(doc: Document): string[] {
  const set = new Set<string>()
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    set.add(el.nodeName)
    for (const at of Array.from(el.attributes)) set.add(`${el.nodeName}@${at.name}`)
  }
  return [...set].sort()
}

/** O que o documento usa e não está na assinatura aprendida. */
export function unknownIn(doc: Document, learned: Iterable<string>): string[] {
  const known = new Set(learned)
  return signatureOf(doc).filter((s) => !known.has(s))
}

export type Signatures = Record<number, string[]>

const KEY = 'l5x-assinaturas'

export function loadSignatures(): Signatures {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Signatures
  } catch {
    return {}
  }
}

/** Junta a assinatura nova com a que já existia para a versão. */
export function learnSignature(version: number, doc: Document): Signatures {
  const all = loadSignatures()
  all[version] = [...new Set([...(all[version] ?? []), ...signatureOf(doc)])].sort()
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Sem armazenamento (aba anônima): vale só até fechar a página.
  }
  return all
}

export function forgetSignature(version: number): Signatures {
  const all = loadSignatures()
  delete all[version]
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // ignora
  }
  return all
}
