import { describe, expect, it } from 'vitest'
import { fixModel, matchIoConfig, mergeMatches, parseIoConfigText } from '../ioconfig'
import { buildIoList, describeModule, normalizeModel, type IoModule } from '../iolist'

// Textos do jeito que o OCR leu prints sintéticos da árvore I/O Configuration
// (com os erros típicos: [ lido como 1, IB32 como 1832, B como 8).
const ocrNitido = `[1M 1/0 Configuration
[1 1756 Backplane, 1756-A10
[0] 1756-L61 Rack_PLC
[1 [2] 1756-CNB/D CNB_Local
[=H ControlNet
[51 11] 756-CNB/D Rack A
[1 1756 Backplane, 1756-A10
HI [0] 1756-CNB/D Rack A
HI [1] 1756-DNB/A DNB_A
[21 1756-IF16/A ALA
[3 1756-OF 4/A AOA
I [411756-1832/8 DAS.
HI [51 1756-1832/8 DAS
HI [6] 1756-OBI6E/A DO_AS
[7] 1756-OW161/A DO_A7
[21 [2] 1756-CNB/D Rack_8
[1 1756 Backplane, 1756-A10
[0] 1756-CNB/D Rack_B
HI [1] 1756-DNB/A DNB_8
[21 1756-IF8/A ALB
I [3]1756-OF 4/A AQ_8
I [411756-1832/8 DLB_4.
HI [51 1756-1832/8 DLB_S
HI [6] 1756-OBI6E/A DO_B6
[7] 1756-0832/A DO_B_7`

function mod(adapter: string, slot: number, datatype: string): IoModule {
  const d = describeModule(datatype)
  return { adapter, slot, catalog: d.catalog, datatype, kind: d.kind, size: d.size, sizeGuessed: false }
}

const modules: IoModule[] = ['Rack_A', 'Rack_B'].flatMap((r) => [
  mod(r, 1, 'AB:1756_DNB_500Bytes:I:0'),
  mod(r, 2, r === 'Rack_A' ? 'AB:1756_IF16_Float:I:0' : 'AB:1756_IF8_Float:I:0'),
  mod(r, 3, 'AB:1756_OF4_Float:O:0'),
  mod(r, 4, 'AB:1756_DI:C:0'),
  mod(r, 5, 'AB:1756_DI:C:0'),
  mod(r, 6, 'AB:1756_DO:C:0'),
  mod(r, 7, 'AB:1756_DO:C:0'),
])

describe('fixModel', () => {
  it('desfaz as trocas comuns do OCR', () => {
    expect(fixModel('1832')).toBe('IB32')
    expect(fixModel('0832')).toBe('OB32')
    expect(fixModel('OBI6E')).toBe('OB16E')
    expect(fixModel('OW161')).toBe('OW16I')
    expect(fixModel('1F16')).toBe('IF16')
    expect(fixModel('IRT8I')).toBe('IRT8I')
    expect(fixModel('IE12')).toBe('IE12')
    expect(fixModel('DN8')).toBe('DNB')
    expect(fixModel('EN2TR')).toBe('EN2TR')
    expect(fixModel('L61')).toBe('L61')
    expect(fixModel('A10')).toBeUndefined()
  })
})

describe('parseIoConfigText + matchIoConfig', () => {
  it('acha rack, slot e modelo de cada cartão', () => {
    const hits = parseIoConfigText(ocrNitido, ['Rack_A', 'Rack_B'])
    const { models } = matchIoConfig(hits, modules)
    expect(models).toEqual({
      'rack_a|1': '1756-DNB',
      'rack_a|2': '1756-IF16',
      'rack_a|3': '1756-OF4',
      'rack_a|4': '1756-IB32',
      'rack_a|5': '1756-IB32',
      'rack_a|6': '1756-OB16E',
      'rack_a|7': '1756-OW16I',
      'rack_b|1': '1756-DNB',
      'rack_b|2': '1756-IF8',
      'rack_b|3': '1756-OF4',
      'rack_b|4': '1756-IB32',
      'rack_b|5': '1756-IB32',
      'rack_b|6': '1756-OB16E',
      'rack_b|7': '1756-OB32',
    })
  })

  it('aceita slot sem o colchete de abertura, e "17]" lido no lugar de "[7]"', () => {
    const hits = parseIoConfigText('Rack_A\n6] 1756-OB16E/A x\n17] 1756-OW161/A y', ['Rack_A', 'Rack_B'])
    expect(matchIoConfig(hits, modules).models).toEqual({ 'rack_a|6': '1756-OB16E', 'rack_a|7': '1756-OW16I' })
  })

  it('rack local e rack Ethernet sem slot na linha do adaptador', () => {
    const mods = [mod('Local', 3, 'AB:1756_IF16:I:0'), mod('Local', 10, 'AB:1756_DI:C:0'), mod('AENTR1', 2, 'AB:1794_IB32:I:0')]
    const text = `1756 Backplane, 1756-A10
[0] 1756-L73 CPU
[10] 1756-IB16/A DI_10
[3] 1756-IF16/A AI_3
[2] 1756-EN2TR/C ETH
Ethernet
1794-AENTR/A AENTR1
[2] 1794-IB32/A DI`
    const { models, unmatched } = matchIoConfig(parseIoConfigText(text, ['Local', 'AENTR1']), mods)
    expect(models).toEqual({ 'local|10': '1756-IB16', 'local|3': '1756-IF16', 'aentr1|2': '1794-IB32' })
    expect(unmatched.map((h) => h.model)).toEqual(['1756-EN2TR'])
  })

  it('sem nome de rack, só casa quando o slot é único', () => {
    const hits = parseIoConfigText('[4] 1756-IB32/B\n[9] 1756-OB16E/A', [])
    const r = matchIoConfig(hits, [...modules, mod('Local', 9, 'AB:1756_DO:C:0')])
    expect(r.models).toEqual({ 'local|9': '1756-OB16E' })
    expect(r.unmatched.map((h) => h.slot)).toEqual([4])
  })
})

describe('buildIoList com modelos exatos', () => {
  const csv = [
    'TYPE,SCOPE,NAME,DESCRIPTION,DATATYPE,SPECIFIER,ATTRIBUTES',
    'TAG,,R:I,"","AB:1756_CNB_10SLOT:I:0","",""',
    'TAG,,R:4:C,"","AB:1756_DI:C:0","",""',
    'ALIAS,,S1,"Sensor","","R:I.Slot[4].Data.2",""',
  ].join('\n')

  it('usa a quantidade de pontos do modelo em vez de estimar', () => {
    const est = buildIoList(csv, { spares: true })
    expect(est.modules[0]).toMatchObject({ catalog: '1756-DI', size: 16, sizeGuessed: true })
    const exact = buildIoList(csv, { spares: true, models: { 'r|4': '1756-ib32/b' } })
    expect(exact.modules[0]).toMatchObject({ catalog: '1756-IB32', exactModel: '1756-IB32', size: 32, sizeGuessed: false })
    expect(exact.points.length).toBe(32)
  })

  it('normaliza o modelo digitado', () => {
    expect(normalizeModel(' 1756 ob16e/A ')).toBe('1756-OB16E')
    expect(normalizeModel('1794-IE12')).toBe('1794-IE12')
  })
})

describe('mergeMatches', () => {
  it('fica com a leitura mais completa e completa com as outras', () => {
    const r = mergeMatches([
      { models: { a: '1756-IB16' }, unmatched: [] },
      { models: { a: '1756-IB32', b: '1756-OB16' }, unmatched: [] },
    ])
    expect(r.models).toEqual({ a: '1756-IB32', b: '1756-OB16' })
  })
})

describe('fixModel recusa leituras impossíveis', () => {
  it('não inventa modelo', () => {
    expect(fixModel('OO8I6E')).toBeUndefined()
    expect(fixModel('OB16XYZ')).toBeUndefined()
  })
  it('voto da maioria entre leituras', () => {
    const r = mergeMatches([
      { models: { a: '1756-OB8', b: '1756-IB16' }, unmatched: [] },
      { models: { a: '1756-OB16E' }, unmatched: [] },
      { models: { a: '1756-OB16E' }, unmatched: [] },
    ])
    expect(r.models).toEqual({ a: '1756-OB16E', b: '1756-IB16' })
  })
})
