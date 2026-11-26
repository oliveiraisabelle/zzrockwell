// Gera a planilha .xlsx da lista de I/O, com formatação (cores, filtros,
// cabeçalho fixo). Carregado só na hora do download, porque a biblioteca
// de Excel é grande.
import ExcelJS from 'exceljs'
import { MODULE_LABEL, pointDescription, TYPE_LABEL, type IoList, type PointType } from './iolist'

const INK = 'FF1F1B1E'
const RED = 'FFB3121F'
const LINE = 'FFD9D4D6'
const MUTED = 'FF8A8287'
const ZEBRA = 'FFF7F4F5'

const TYPE_COLORS: Record<PointType, { fill: string; font: string }> = {
  DI: { fill: 'FFE3F2E7', font: 'FF1E6B35' },
  DO: { fill: 'FFFDEBD3', font: 'FF8A4B00' },
  AI: { fill: 'FFE1ECFA', font: 'FF1D4E89' },
  AO: { fill: 'FFEFE3F7', font: 'FF5B2C83' },
  REDE: { fill: 'FFECECEC', font: 'FF444444' },
}

const thin = { style: 'thin' as const, color: { argb: LINE } }
const border = { top: thin, left: thin, bottom: thin, right: thin }

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 22
  row.eachCell((c) => {
    c.fill = fill(INK)
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.alignment = { vertical: 'middle', horizontal: 'left' }
    c.border = { ...border, bottom: { style: 'medium', color: { argb: RED } } }
  })
}

function title(ws: ExcelJS.Worksheet, text: string, sub: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols)
  ws.mergeCells(2, 1, 2, cols)
  const t = ws.getCell(1, 1)
  t.value = text
  t.font = { bold: true, size: 16, color: { argb: RED } }
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26
  const s = ws.getCell(2, 1)
  s.value = sub
  s.font = { size: 10, color: { argb: MUTED } }
}

export interface XlsxMeta {
  fileName: string
  generatedAt?: Date
}

export async function buildIoListXlsx(list: IoList, meta: XlsxMeta): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'zzrockwell'
  wb.created = meta.generatedAt ?? new Date()
  const when = (meta.generatedAt ?? new Date()).toLocaleString('pt-BR')
  const origin = [
    `Arquivo: ${meta.fileName}`,
    list.software ? `software ${list.software}` : '',
    list.exportedAt ? `exportado em ${list.exportedAt}` : '',
    `gerado em ${when}`,
  ]
    .filter(Boolean)
    .join('  ·  ')

  // ---------------------------------------------------------------- Lista
  const ws = wb.addWorksheet('Lista de IO', { views: [{ state: 'frozen', ySplit: 4 }] })
  const cols = [
    { header: 'Tipo', width: 8 },
    { header: 'Direção', width: 10 },
    { header: 'Rack', width: 14 },
    { header: 'Slot', width: 6 },
    { header: 'Ponto', width: 7 },
    { header: 'Endereço', width: 26 },
    { header: 'Tag', width: 22 },
    { header: 'Descrição', width: 60 },
    { header: 'Módulo', width: 14 },
    { header: 'Observação', width: 30 },
  ]
  cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.width))
  title(ws, 'Lista de I/O', origin, cols.length)
  const head = ws.getRow(4)
  head.values = cols.map((c) => c.header)
  styleHeader(head)

  let group = ''
  let shade = false
  for (const p of list.points) {
    const g = `${p.adapter}|${p.slot}|${p.direction}`
    if (g !== group) {
      group = g
      shade = !shade
    }
    const notes: string[] = []
    if (p.spare) notes.push('Reserva')
    if (p.aliases.length > 1) notes.push(`${p.aliases.length} tags no mesmo ponto`)
    if (p.aliases.some((a) => a.scope)) notes.push(`Tag do programa ${p.aliases.find((a) => a.scope)!.scope}`)
    const row = ws.addRow([
      p.type,
      p.direction,
      p.adapter,
      p.slot,
      p.word !== undefined ? `${p.word}.${p.point}` : p.point,
      p.address,
      p.aliases.map((a) => a.name).join(', '),
      pointDescription(p),
      p.module?.catalog ?? '',
      notes.join(' · '),
    ])
    row.eachCell({ includeEmpty: true }, (c, n) => {
      c.border = border
      c.alignment = { vertical: 'top', wrapText: n === 8 || n === 10 }
      c.font = { size: 10, color: { argb: p.spare ? MUTED : INK }, italic: p.spare }
      if (shade) c.fill = fill(ZEBRA)
    })
    const tc = row.getCell(1)
    const colors = TYPE_COLORS[p.type]
    tc.fill = fill(colors.fill)
    tc.font = { size: 10, bold: true, color: { argb: colors.font } }
    tc.alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'top' }
    row.getCell(6).font = { size: 10, name: 'Consolas', color: { argb: p.spare ? MUTED : INK } }
    row.getCell(7).font = { size: 10, bold: !p.spare, color: { argb: INK } }
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + list.points.length, column: cols.length } }
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4' }

  // ---------------------------------------------------------------- Resumo
  const rs = wb.addWorksheet('Resumo')
  const rcols = [16, 8, 16, 22, 10, 10, 10, 34]
  rcols.forEach((w, i) => (rs.getColumn(i + 1).width = w))
  title(rs, 'Resumo da lista de I/O', origin, rcols.length)

  const totHead = rs.getRow(4)
  totHead.values = ['Tipo', '', 'Usados', 'Reserva']
  rs.mergeCells(4, 1, 4, 2)
  styleHeader(totHead)
  const types: PointType[] = ['DI', 'DO', 'AI', 'AO', 'REDE']
  let r = 5
  for (const t of types) {
    const usedN = list.counts[t]
    const spareN = list.points.filter((p) => p.spare && p.type === t).length
    if (!usedN && !spareN) continue
    const row = rs.getRow(r)
    row.values = [`${t}  ${TYPE_LABEL[t]}`, '', usedN, spareN]
    rs.mergeCells(r, 1, r, 2)
    row.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 4) return
      c.border = border
      c.font = { size: 10 }
    })
    row.getCell(1).fill = fill(TYPE_COLORS[t].fill)
    row.getCell(1).font = { size: 10, bold: true, color: { argb: TYPE_COLORS[t].font } }
    r++
  }
  const total = rs.getRow(r)
  total.values = ['Total', '', list.used, list.spares]
  rs.mergeCells(r, 1, r, 2)
  total.eachCell((c) => {
    c.font = { bold: true, size: 10 }
    c.border = { top: { style: 'medium', color: { argb: INK } } }
  })

  r += 2
  const modHead = rs.getRow(r)
  modHead.values = ['Rack', 'Slot', 'Módulo', 'Tipo', 'Pontos', 'Usados', 'Livres', 'Observação']
  styleHeader(modHead)
  r++
  for (const m of list.modules) {
    const pts = list.points.filter((p) => p.module === m)
    const usedN = pts.filter((p) => !p.spare).length
    const io = m.kind !== 'REDE' && m.kind !== 'OUTRO'
    const row = rs.getRow(r)
    row.values = [
      m.adapter,
      m.slot,
      m.catalog,
      MODULE_LABEL[m.kind],
      io ? (m.size ?? '') : '',
      io ? usedN : '',
      io && m.size ? Math.max(0, m.size - usedN) : '',
      m.exactModel
        ? 'Modelo informado (I/O Configuration)'
        : m.kind === 'REDE'
        ? 'Os pontos desta rede estão na aba Rede'
        : m.sizeGuessed && m.size
          ? 'Quantidade de pontos estimada; confira o modelo'
          : '',
    ]
    row.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 8) return
      c.border = border
      c.font = { size: 10, color: { argb: n === 8 ? MUTED : INK } }
      c.alignment = { vertical: 'top', horizontal: n === 2 || (n >= 5 && n <= 7) ? 'center' : 'left' }
    })
    r++
  }

  // ---------------------------------------------------------------- Rede
  if (list.network.length) {
    const ns = wb.addWorksheet('Rede', { views: [{ state: 'frozen', ySplit: 4 }] })
    const ncols = [10, 14, 22, 64, 34]
    ncols.forEach((w, i) => (ns.getColumn(i + 1).width = w))
    title(ns, 'Pontos de rede (palavras comentadas)', origin, ncols.length)
    const h = ns.getRow(4)
    h.values = ['Direção', 'Tag', 'Endereço', 'Descrição', 'Tag da rede']
    styleHeader(h)
    let tag = ''
    let sh = false
    for (const n of list.network) {
      if (n.tag !== tag) {
        tag = n.tag
        sh = !sh
      }
      const row = ns.addRow([n.direction, n.tag, n.address, n.comment, n.tagDescription])
      row.eachCell({ includeEmpty: true }, (c, i) => {
        c.border = border
        c.font = { size: 10, name: i === 3 ? 'Consolas' : undefined, color: { argb: i === 5 ? MUTED : INK } }
        c.alignment = { vertical: 'top', wrapText: i === 4 || i === 5 }
        if (sh) c.fill = fill(ZEBRA)
      })
    }
    ns.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + list.network.length, column: ncols.length } }
  }

  // Resumo como segunda aba, lista primeiro: é o que a pessoa quer ver ao abrir.
  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}
