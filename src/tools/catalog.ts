// Lista das ferramentas do site. Para adicionar uma nova, inclua aqui e
// crie o componente dela em src/tools.

export type ToolId = 'l5x' | 'telas-se12' | 'global-objects' | 'visualizador' | 'alarmes'

export interface ToolInfo {
  id: ToolId
  group: 'logix' | 'telas'
  name: string
  /** Etiqueta curta ao lado do nome no menu. */
  tag: string
  ready: boolean
  summary: string
  plans: string[]
}

export const TOOL_GROUPS = [
  { id: 'logix', label: 'Projetos do CLP' },
  { id: 'telas', label: 'Telas e alarmes' },
] as const

export const TOOLS: ToolInfo[] = [
  {
    id: 'l5x',
    group: 'logix',
    name: 'Conversor L5X',
    tag: 'v20–36',
    ready: true,
    summary: 'Rebaixa a versão e troca o modelo do CLP em exportações L5X.',
    plans: [],
  },
  {
    id: 'telas-se12',
    group: 'telas',
    name: 'Telas para SE12',
    tag: 'XML',
    ready: false,
    summary: 'Limpa o XML de telas exportadas da versão 15 ou 16 para importar sem erro na versão 12.',
    plans: [
      'Troca o schema do arquivo para o da versão 12.',
      'Remove vínculos de objetos globais e controles ActiveX que a versão 12 não aceita.',
      'Tira atributos visuais novos, como cantos arredondados e cor de borda.',
      'Opcional: põe um prefixo nos nomes dos elementos para não dar conflito.',
    ],
  },
  {
    id: 'global-objects',
    group: 'telas',
    name: 'Trocador de Global Objects',
    tag: 'XML',
    ready: false,
    summary: 'Troca, num XML de tela, a referência de um objeto global por outro.',
    plans: [
      'Lista os objetos globais encontrados na tela.',
      'Troca o arquivo de origem e o nome do objeto com segurança.',
      'Mostra quantas referências foram trocadas antes de baixar.',
    ],
  },
  {
    id: 'visualizador',
    group: 'telas',
    name: 'Visualizador de telas',
    tag: '2D',
    ready: false,
    summary: 'Desenha a tela a partir do XML exportado, com zoom e inspetor de tags.',
    plans: ['Desenho da tela no navegador, com zoom e arrastar.', 'Clique num objeto para ver as tags e expressões dele.'],
  },
  {
    id: 'alarmes',
    group: 'telas',
    name: 'Gerador de alarmes',
    tag: 'SE/ME',
    ready: false,
    summary: 'Cria os alarmes a partir do CSV de tags do CLP, com regras por tipo de dado.',
    plans: [
      'Importa o CSV de tags exportado do CLP.',
      'Regras por tipo de dado: quais bits viram alarme, severidade e reconhecimento.',
      'Exporta planilha para SE ou XML para ME, das versões 10 a 16.',
    ],
  },
]
