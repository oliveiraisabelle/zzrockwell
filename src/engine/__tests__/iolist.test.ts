import { describe, expect, it } from 'vitest'
import { buildIoList, decodeCsv, describeModule, parseIoAddress, pointDescription, TagCsvError } from '../iolist'
import { buildIoListXlsx } from '../iolistXlsx'

// CSV sintético no formato do Export Tags (rack remoto com conexão otimizada).
const csv = [
  'remark,"CSV-Import-Export"',
  'remark,"Version = Software v17.00"',
  '0.3',
  'TYPE,SCOPE,NAME,DESCRIPTION,DATATYPE,SPECIFIER,ATTRIBUTES',
  'TAG,,Rack1:I,"","AB:1756_CNB_10SLOT:I:0","",""',
  'TAG,,Rack1:O,"","AB:1756_CNB_10SLOT:O:0","",""',
  'TAG,,Rack1:1:I,"","AB:1756_DNB_500Bytes:I:0","",""',
  'TAG,,Rack1:2:C,"","AB:1756_IF8_Float:C:0","",""',
  'TAG,,Rack1:2:I,"","AB:1756_IF8_Float:I:0","",""',
  'TAG,,Rack1:3:C,"","AB:1756_OF4_Float:C:0","",""',
  'TAG,,Rack1:3:I,"","AB:1756_OF4_Float:I:0","",""',
  'TAG,,Rack1:3:O,"","AB:1756_OF4_Float:O:0","",""',
  'TAG,,Rack1:4:C,"","AB:1756_DI:C:0","",""',
  'TAG,,Rack1:5:C,"","AB:1756_DO:C:0","",""',
  'TAG,,DNET_I,"Leitura da rede","INT[10]","",""',
  'ALIAS,,Rack1:4:I,"","","Rack1:I.Slot[4]",""',
  'ALIAS,,Rack1:5:O,"","","Rack1:O.Slot[5]",""',
  'ALIAS,,BOT_LIGA,"Botão$NLiga bomba","","Rack1:4:I.Data.2","(RADIX := Decimal)"',
  'ALIAS,,SENSOR_X,"Sensor X","","Rack1:I.Slot[4].Data.20",""',
  'ALIAS,,VALV1,"Válvula 1","","Rack1:5:O.Data.0",""',
  'ALIAS,,VALV1_DUP,"","","Rack1:5:O.Data.0",""',
  'ALIAS,,VALV_ALIAS,"","","VALV1",""',
  'ALIAS,,PT100,"Pressão","","Rack1:2:I.Ch1Data","(RADIX := Float)"',
  'ALIAS,,FCV1,"Controle","","Rack1:3:O.Ch0Data","(RADIX := Float)"',
  'ALIAS,,N7_0,"Inteiro","","N7[0]",""',
  'TYPE,SCOPE,ROUTINE,COMMENT,OWNING_ELEMENT,LOCATION',
  'COMMENT,,Rack1:5:O,"Comentário$Nda saída",,"Rack1:5:O.DATA.0"',
  'COMMENT,,Rack1:I,"Fim de curso",,"Rack1:I.SLOT[4].DATA.7"',
  'COMMENT,,DNET_I,"Trip do relé",,"DNET_I[0].0"',
  'RCOMMENT,"Main","R1","Comentário de rung","NOP()","0"',
].join('\r\n')

describe('parseIoAddress', () => {
  it('entende slot direto e slot do rack', () => {
    expect(parseIoAddress('Rack1:4:I.Data.19')).toMatchObject({ adapter: 'Rack1', slot: 4, kind: 'I', point: 19 })
    expect(parseIoAddress('Rack1:I.SLOT[5].DATA.23')).toMatchObject({ slot: 5, kind: 'I', point: 23 })
    expect(parseIoAddress('Local:2:I.Ch3Data')).toMatchObject({ member: 'Ch', point: 3 })
    expect(parseIoAddress('Local:1:I.Pt07.Data')).toMatchObject({ member: 'Pt', point: 7 })
    expect(parseIoAddress('Rack1:1:I.Data[5].3')).toMatchObject({ word: 5, point: 3 })
    expect(parseIoAddress('N7[0]')).toBeUndefined()
  })
})

describe('describeModule', () => {
  it('classifica pelo catálogo', () => {
    expect(describeModule('AB:1756_IF16_Float_No_Alm:I:0')).toMatchObject({ catalog: '1756-IF16', kind: 'AI', size: 16 })
    expect(describeModule('AB:1756_OF4_Float:O:0')).toMatchObject({ kind: 'AO', size: 4 })
    expect(describeModule('AB:1756_DI:C:0')).toMatchObject({ kind: 'DI', size: undefined })
    expect(describeModule('AB:1756_OB16E:O:0')).toMatchObject({ kind: 'DO', size: 16 })
    expect(describeModule('AB:1769_IQ16:I:0')).toMatchObject({ kind: 'DI', size: 16 })
    expect(describeModule('AB:1756_DNB_500Bytes:I:0')).toMatchObject({ kind: 'REDE' })
  })
})

describe('buildIoList', () => {
  const list = buildIoList(csv, { spares: true })
  const at = (addr: string) => list.points.find((p) => p.address === addr)

  it('lê versão, módulos e contagens', () => {
    expect(list.software).toBe('v17.00')
    expect(list.modules.map((m) => `${m.slot}:${m.kind}`)).toEqual(['1:REDE', '2:AI', '3:AO', '4:DI', '5:DO'])
    expect(list.counts).toMatchObject({ DI: 3, DO: 1, AI: 1, AO: 1 })
  })

  it('junta alias e comentário no mesmo ponto, nos dois formatos de endereço', () => {
    const p = at('Rack1:4:I.Data.20')!
    expect(p.aliases.map((a) => a.name)).toEqual(['SENSOR_X'])
    expect(at('Rack1:4:I.Data.7')!.comment).toBe('Fim de curso')
    expect(pointDescription(at('Rack1:4:I.Data.2')!)).toBe('Botão / Liga bomba')
  })

  it('o comentário do endereço vale mais que a descrição do alias', () => {
    const p = at('Rack1:5:O.Data.0')!
    expect(pointDescription(p)).toBe('Comentário / da saída')
    expect(p.aliases.map((a) => a.name)).toEqual(['VALV1', 'VALV1_DUP', 'VALV_ALIAS'])
  })

  it('analógicos por canal, sem o eco da saída', () => {
    expect(at('Rack1:2:I.Ch1Data')!.type).toBe('AI')
    expect(at('Rack1:3:O.Ch0Data')!.type).toBe('AO')
    expect(list.points.some((p) => p.address.startsWith('Rack1:3:I'))).toBe(false)
  })

  it('cria reservas e estima o tamanho do cartão digital', () => {
    const di = list.modules.find((m) => m.slot === 4)!
    expect(di.size).toBe(32)
    expect(di.sizeGuessed).toBe(true)
    expect(list.points.filter((p) => p.slot === 4).length).toBe(32)
    expect(list.points.filter((p) => p.slot === 2).length).toBe(8)
    expect(at('Rack1:4:I.Data.0')!.spare).toBe(true)
    expect(buildIoList(csv).points.some((p) => p.spare)).toBe(false)
  })

  it('separa os comentários de rede', () => {
    expect(list.network).toEqual([
      { direction: 'Entrada', tag: 'DNET_I', tagDescription: 'Leitura da rede', address: 'DNET_I[0].0', comment: 'Trip do relé' },
    ])
  })

  it('aceita CSV com ponto e vírgula (Windows em português)', () => {
    const semi = csv
      .split('\r\n')
      .map((l) => l.replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ';'))
      .join('\r\n')
    expect(semi).toContain('TYPE;SCOPE;NAME')
    const l2 = buildIoList(semi, { spares: true })
    expect(l2.counts).toEqual(list.counts)
    expect(l2.points.length).toBe(list.points.length)
  })

  it('recusa arquivo que não é CSV de tags', () => {
    expect(() => buildIoList('a,b,c\n1,2,3')).toThrow(TagCsvError)
  })

  it('gera um xlsx válido', async () => {
    const bytes = await buildIoListXlsx(list, { fileName: 'teste.csv', generatedAt: new Date(2026, 0, 1) })
    expect(bytes[0]).toBe(0x50) // "PK": arquivo zip
    expect(bytes[1]).toBe(0x4b)
  })
})

describe('decodeCsv', () => {
  it('lê ANSI (acentos em Windows-1252)', () => {
    expect(decodeCsv(new Uint8Array([0x56, 0xe1, 0x6c]))).toBe('Vál')
    expect(decodeCsv(new TextEncoder().encode('Vál'))).toBe('Vál')
  })
})
