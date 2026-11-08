// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { convertToSe12, DisplayError, inspectDisplay } from '../se12'
import { decodeText, encodeText } from '../textfile'

// Tela sintética, montada à mão. Trocar por uma exportação real assim que houver.
const display = `<?xml version="1.0" encoding="UTF-16"?>
<gfx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="Gfx-SE16.xsd">
  <displaySettings displayType="replace" name="Tela_Bombas" backColor="black"/>
  <rectangle name="Fundo" exposeToVba="notExposed" left="0" top="0" width="100" height="50" cornerRadius="8" borderColor="red"/>
  <group name="Bomba1" exposeToVba="notExposed" isReferenceObject="true" linkSize="true">
    <parameters>
      <parameter name="#1" description="Tag" value="[PLC]P101"/>
    </parameters>
    <polygon name="Corpo" exposeToVba="notExposed" left="1" top="1"/>
    <numericDisplay name="Vazao" exposeToVba="notExposed"><connections><connection name="Value" expression="{[PLC]FT101}"/></connections></numericDisplay>
  </group>
  <button name="BtnLiga" style="line" remarkCheck="true" remarkInfo="x" left="5">
    <confirm message="Ligar?"/>
    <caption caption="Liga"/>
  </button>
  <activeX name="Grafico1" clsid="{0000}">
    <ActiveXEvents><event name="Click"/></ActiveXEvents>
  </activeX>
  <activeX name="Relogio" clsid="{1111}"/>
</gfx>
`

describe('inspectDisplay', () => {
  it('lê versão e nome da tela', () => {
    const info = inspectDisplay(display)
    expect(info.version).toBe(16)
    expect(info.name).toBe('Tela_Bombas')
  })

  it('rejeita o que não é tela', () => {
    expect(() => inspectDisplay('<RSLogix5000Content/>')).toThrow(DisplayError)
    expect(() => inspectDisplay('não é xml')).toThrow(DisplayError)
  })
})

describe('convertToSe12', () => {
  const r = convertToSe12(display)
  const fix = (id: string) => r.fixes.find((f) => f.id === id)!

  it('troca o schema', () => {
    expect(r.output).toContain('Gfx-SE12.xsd')
    expect(r.output).not.toContain('Gfx-SE16.xsd')
  })

  it('desfaz vínculo de Global Object e tira os parâmetros', () => {
    expect(r.output).toContain('isReferenceObject="false"')
    expect(r.output).not.toContain('<parameters>')
    expect(fix('global-objects').objects).toEqual(['Bomba1'])
    expect(fix('global-objects').count).toBe(2)
  })

  it('remove só o ActiveX que tem eventos', () => {
    expect(r.output).not.toContain('Grafico1')
    expect(r.output).toContain('Relogio')
    expect(fix('activex').objects).toEqual(['Grafico1'])
  })

  it('tira atributos visuais e ajusta o estilo do botão', () => {
    expect(r.output).not.toMatch(/cornerRadius|borderColor/)
    expect(fix('visual').count).toBe(2)
    expect(r.output).toContain('<button name="BtnLiga" style="noborder" left="5">')
  })

  it('remove auditoria e confirmação', () => {
    expect(r.output).not.toMatch(/remark|<confirm/)
    expect(fix('audit').count).toBe(3)
  })

  it('mantém o resto igual e o XML válido', () => {
    expect(r.output).toContain('<caption caption="Liga"/>')
    expect(r.output).toContain('<polygon name="Corpo" exposeToVba="notExposed" left="1" top="1"/>')
    expect(() => inspectDisplay(r.output)).not.toThrow()
    expect(r.output).not.toMatch(/\n\s*\n/)
  })

  it('põe prefixo nos nomes sem repetir', () => {
    const p = convertToSe12(display, { prefix: 'IMP_' })
    expect(p.output).toContain('name="IMP_Fundo"')
    expect(p.output).not.toContain('IMP_IMP_')
    expect(p.output).toContain('name="Tela_Bombas"')
    expect(p.output).toContain('<connection name="Value"')
    expect(p.output).toContain('name="IMP_Vazao"')
    expect(convertToSe12(p.output, { prefix: 'IMP_' }).fixes.find((f) => f.id === 'prefix')!.count).toBe(0)
    expect(() => convertToSe12(display, { prefix: 'a b' })).toThrow(DisplayError)
  })

  it('não mexe em tela que já é da versão 12', () => {
    const old = display.replace('Gfx-SE16.xsd', 'Gfx-SE12.xsd')
    expect(convertToSe12(old).fixes.find((f) => f.id === 'schema')!.count).toBe(0)
  })
})

describe('codificação', () => {
  it('preserva UTF-16 com BOM ida e volta', () => {
    const text = '<gfx>ação</gfx>'
    const bytes = encodeText({ text, encoding: 'utf-16le', bom: true })
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfe])
    expect(decodeText(bytes)).toEqual({ text, encoding: 'utf-16le', bom: true })
  })

  it('lê UTF-8 sem BOM', () => {
    expect(decodeText(new TextEncoder().encode('<gfx/>')).encoding).toBe('utf-8')
  })
})
