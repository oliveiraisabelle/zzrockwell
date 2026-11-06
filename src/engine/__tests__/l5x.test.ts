// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { analyze, availableTargets, convert, parseL5x, L5xError } from '../l5x'

// Arquivos sintéticos, montados à mão no formato L5X. Devem ser substituídos
// por exportações reais do Studio 5000 assim que houver.
const project = (opts: { rev?: string; cpu?: string; extra?: string } = {}) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="${opts.rev ?? '33.01'}" TargetName="Linha1" TargetType="Controller" ContainsContext="false" ExportDate="Fri Oct 23 10:00:00 2026" ExportOptions="NoRawData L5KData DecoratedData ForceProtectedEncoding AllProjDocTrans">
<Controller Use="Target" Name="Linha1" ProcessorType="${opts.cpu ?? '1756-L83E'}" MajorRev="33" MinorRev="11">
<Modules>
<Module Name="Local" CatalogNumber="1756-L83E" Major="33" Minor="11"/>
</Modules>
<Programs>
<Program Name="MainProgram">
${opts.extra ?? ''}
<Routines><Routine Name="MainRoutine" Type="RLL"><RLLContent><Rung Number="0" Type="N"><Text><![CDATA[XIC(Start)OTE(Motor);]]></Text></Rung></RLLContent></Routine></Routines>
</Program>
</Programs>
</Controller>
</RSLogix5000Content>
`

const routine = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="32.00" TargetName="MainRoutine" TargetType="Routine" TargetSubType="RLL" ContainsContext="true" ExportDate="Fri Oct 23 10:00:00 2026" ExportOptions="References NoRawData L5KData DecoratedData Context RoutineLabels AliasExtras IOTags NoStringData ForceProtectedEncoding AllProjDocTrans">
<Controller Use="Context" Name="Linha1">
<Programs Use="Context"><Program Use="Context" Name="MainProgram"><Routines><Routine Use="Target" Name="MainRoutine" Type="RLL"/></Routines></Program></Programs>
</Controller>
</RSLogix5000Content>
`

describe('analyze', () => {
  it('lê versão, CLP e tipo de exportação', () => {
    const info = analyze(parseL5x(project()))
    expect(info.majorVersion).toBe(33)
    expect(info.targetType).toBe('Controller')
    expect(info.family?.name).toMatch(/5580/)
    expect(info.moduleCount).toBe(1)
  })

  it('rejeita XML que não é L5X', () => {
    expect(() => parseL5x('<foo/>')).toThrow(L5xError)
    expect(() => parseL5x('não é xml')).toThrow(L5xError)
  })

  it('oferece só versões mais antigas que o CLP suporta', () => {
    const targets = availableTargets(analyze(parseL5x(project())))
    expect(targets).toEqual([28, 29, 30, 31, 32])
  })

  it('oferece v37 para um arquivo da v38', () => {
    const targets = availableTargets(analyze(parseL5x(project({ rev: '38.01' }))))
    expect(targets[targets.length - 1]).toBe(37)
  })
})

describe('convert', () => {
  it('reescreve só os atributos de versão e preserva o resto byte a byte', () => {
    const input = project()
    const result = convert(input, 30)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('SoftwareRevision="30.00"')
    expect(result.output).toContain('MajorRev="30"')
    expect(result.output).toContain('MinorRev="11"')
    const strip = (s: string) => s.replace(/SoftwareRevision="[^"]*"/, '').replace(/MajorRev="[^"]*"/, '')
    expect(strip(result.output!)).toBe(strip(input))
  })

  it('converte exportação parcial de rotina', () => {
    const result = convert(routine, 24)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('SoftwareRevision="24.00"')
    expect(result.changes).toHaveLength(1)
  })

  it('bloqueia CLP que não existe na versão alvo', () => {
    const result = convert(project(), 24)
    expect(result.ok).toBe(false)
    expect(result.output).toBeUndefined()
    expect(result.findings.some((f) => f.severity === 'block' && /v28/.test(f.message))).toBe(true)
  })

  it('bloqueia parâmetros de programa abaixo da v24', () => {
    const extra = '<Parameters><Parameter Name="P1" DataType="BOOL" Usage="Input"/></Parameters>'
    const result = convert(project({ cpu: '1756-L73', extra }), 21)
    expect(result.ok).toBe(false)
    expect(result.findings.find((f) => /Parâmetros/.test(f.message))?.count).toBe(1)
  })

  it('bloqueia conteúdo protegido', () => {
    const result = convert(project({ extra: '<EncodedData EncodedType="Routine"/>' }), 30)
    expect(result.ok).toBe(false)
  })

  it('converte de v38 para v37', () => {
    const result = convert(project({ rev: '38.01' }), 37)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('SoftwareRevision="37.00"')
  })

  it('bloqueia TIMER_T abaixo da v38', () => {
    const extra = '<Tags><Tag Name="T1" TagType="Base" DataType="TIMER_T"/></Tags>'
    const result = convert(project({ rev: '38.01', extra }), 37)
    expect(result.ok).toBe(false)
    expect(result.findings.find((f) => /TIMER_T/.test(f.message))?.count).toBe(1)
  })

  it('bloqueia ControlLogix 5590 abaixo da v38', () => {
    const result = convert(project({ rev: '38.01', cpu: '1756-L93ES' }), 37)
    expect(result.ok).toBe(false)
  })

  it('recusa conversão para versão igual ou mais nova', () => {
    expect(() => convert(project(), 33)).toThrow(L5xError)
  })
})
