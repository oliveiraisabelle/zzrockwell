// Lê o texto de uma imagem no próprio navegador (tesseract.js). Os arquivos
// do leitor ficam em /ocr no site (copiados no build), sem CDN: a foto não
// sai do computador.

/** Redimensiona e passa para cinza. O OCR acerta mais com letra grande. */
async function prepare(bmp: ImageBitmap, scale: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = 'grayscale(1) contrast(1.2)'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Escalas a tentar: o resultado muda bastante com o tamanho da letra. */
function scalesFor(width: number): number[] {
  const out = [2, 1, 3].map((s) => Math.min(s, 4000 / width)).filter((s) => s >= 0.5)
  return [...new Set(out.map((s) => Math.round(s * 100) / 100))]
}

/**
 * Lê a imagem em algumas escalas e devolve o texto de cada leitura. Quem chama
 * escolhe/junta as leituras (o parser descarta o que não é modelo).
 */
export async function readImageTexts(file: Blob, onProgress?: (p: number) => void): Promise<string[]> {
  const { createWorker } = await import('tesseract.js')
  const base = new URL(import.meta.env.BASE_URL + 'ocr/', location.href).href
  const bmp = await createImageBitmap(file)
  const scales = scalesFor(bmp.width)
  let pass = 0
  const worker = await createWorker('eng', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.((pass + m.progress) / scales.length)
    },
  })
  try {
    const texts: string[] = []
    for (const s of scales) {
      const { data } = await worker.recognize(await prepare(bmp, s))
      texts.push(data.text)
      pass++
    }
    return texts
  } finally {
    bmp.close()
    await worker.terminate()
  }
}
