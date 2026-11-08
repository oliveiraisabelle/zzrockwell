// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { analyze, availableTargets, convert, parseL5x, L5xError } from '../l5x'
import { diffLines } from '../diff'
import { signatureOf } from '../signature'
import { xray } from '../xray'

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
    expect(result.output).toContain('<Module Name="Local" CatalogNumber="1756-L83E" Major="30" Minor="11"/>')
    const strip = (s: string) =>
      s.replace(/SoftwareRevision="[^"]*"/, '').replace(/MajorRev="[^"]*"/, '').replace(/ Major="[^"]*"/, '')
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

describe('troca de controlador', () => {
  it('troca o CLP e o módulo local mantendo a versão', () => {
    const result = convert(project(), 33, { processorType: '1756-L85E' })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('ProcessorType="1756-L85E"')
    expect(result.output).toContain('<Module Name="Local" CatalogNumber="1756-L85E" Major="33"')
    expect(result.output).toContain('SoftwareRevision="33.01"')
  })

  it('troca o CLP e rebaixa junto, usando a família nova', () => {
    const result = convert(project(), 24, { processorType: '1756-L73' })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('ProcessorType="1756-L73"')
    expect(result.output).toContain('SoftwareRevision="24.00"')
  })

  it('oferece a versão atual quando troca o CLP', () => {
    const info = analyze(parseL5x(project()))
    expect(availableTargets(info, '1756-L73')).toContain(33)
    expect(availableTargets(info, '1756-L73')).toContain(24)
    expect(availableTargets(info)).not.toContain(33)
  })

  it('bloqueia troca entre CLP de segurança e comum', () => {
    const result = convert(project(), 33, { processorType: '1756-L83ES' })
    expect(result.ok).toBe(false)
  })
})

describe('assinatura aprendida', () => {
  it('aponta itens que não existem nos arquivos ensinados', () => {
    const learned = signatureOf(parseL5x(project()))
    const extra = '<Parameters><Parameter Name="P1" DataType="BOOL" Usage="Input" Novo="1"/></Parameters>'
    const result = convert(project({ extra }), 30, { learned })
    const f = result.findings.find((x) => x.details)
    expect(f?.details).toContain('Parameter@Novo')
  })
})

describe('raio-X e comparação', () => {
  it('conta programas, rotinas e módulos', () => {
    const x = xray(parseL5x(project()))
    expect(x.programs).toBe(1)
    expect(x.routines).toEqual({ RLL: 1 })
    expect(x.rungs).toBe(1)
    expect(x.modules[0].catalog).toBe('1756-L83E')
  })

  it('ignora elementos de contexto em exportação parcial', () => {
    const x = xray(parseL5x(routine))
    expect(x.programs).toBe(0)
    expect(x.routines).toEqual({ RLL: 1 })
  })

  it('mostra só os trechos alterados', () => {
    const input = project()
    const d = diffLines(input, convert(input, 30, { processorType: '1756-L85E' }).output!)
    const changed = d.map((c) => `${c.old.changed}>${c.new.changed}`)
    expect(changed).toContain('33.01>30.00')
    expect(changed).toContain('1756-L83E>1756-L85E')
    expect(d.every((c) => c.old.before.length <= 49)).toBe(true)
  })
})
