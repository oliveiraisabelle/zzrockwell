// Leitura e gravação de arquivos de texto preservando a codificação original.
// Exportações de telas costumam vir em UTF-16 com BOM; devolver em UTF-8
// com o cabeçalho dizendo UTF-16 faz a importação falhar.

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be'

export interface TextFile {
  text: string
  encoding: Encoding
  bom: boolean
}

export function decodeText(buf: ArrayBuffer | Uint8Array): TextFile {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le', bom: true }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be', bom: true }
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8', bom: true }
  }
  // UTF-16 sem BOM: o "<" vem seguido (ou precedido) de um byte zero.
  if (bytes[0] === 0x3c && bytes[1] === 0x00) {
    return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le', bom: false }
  }
  if (bytes[0] === 0x00 && bytes[1] === 0x3c) {
    return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be', bom: false }
  }
  return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8', bom: false }
}

export function encodeText(file: TextFile): Uint8Array {
  if (file.encoding === 'utf-8') {
    const body = new TextEncoder().encode(file.text)
    if (!file.bom) return body
    const out = new Uint8Array(body.length + 3)
    out.set([0xef, 0xbb, 0xbf])
    out.set(body, 3)
    return out
  }
  const le = file.encoding === 'utf-16le'
  const start = file.bom ? 2 : 0
  const out = new Uint8Array(start + file.text.length * 2)
  if (file.bom) out.set(le ? [0xff, 0xfe] : [0xfe, 0xff])
  for (let i = 0; i < file.text.length; i++) {
    const c = file.text.charCodeAt(i)
    out[start + i * 2] = le ? c & 0xff : c >> 8
    out[start + i * 2 + 1] = le ? c >> 8 : c & 0xff
  }
  return out
}

export const ENCODING_LABEL: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16',
  'utf-16be': 'UTF-16 (BE)',
}
