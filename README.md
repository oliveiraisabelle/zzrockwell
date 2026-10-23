# zzrockwell

Conversor de versão para exportações L5X do Studio 5000 Logix Designer. O site rebaixa um L5X para uma versão mais antiga e mostra um relatório do que foi alterado e do que precisa de revisão.

Toda a conversão roda no navegador: o arquivo do usuário nunca é enviado para um servidor.

## Como rodar

```bash
npm install
npm run dev     # servidor de desenvolvimento
npm test        # testes do motor de conversão
npm run build   # gera o site estático em dist/
```

## Estrutura

- `src/engine/rules.ts`: base de regras (CLPs e recursos por versão). Adicionar versão ou regra é editar dados.
- `src/engine/l5x.ts`: leitura, análise de compatibilidade e conversão. Só os atributos de versão são reescritos; o resto do arquivo fica byte a byte igual.
- `src/App.tsx`: interface.

## Limitações conhecidas

- As regras em `rules.ts` estão marcadas como `verified: false`: vieram de memória e precisam ser conferidas nas release notes da Rockwell e com L5X reais.
- Os testes usam arquivos L5X sintéticos. Substituir por exportações reais de várias versões.
- Conteúdo protegido (`EncodedData`) não é convertido, por princípio.

Este projeto não é afiliado à Rockwell Automation. Studio 5000 e Logix são marcas de seus respectivos donos.
