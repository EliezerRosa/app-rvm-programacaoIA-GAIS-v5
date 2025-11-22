# Execute e publique seu app do AI Studio

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Este repositório contém tudo que você precisa para rodar o app localmente.

Veja o app no AI Studio: <https://ai.studio/apps/drive/11l9oAhdWDXN-ZOPUznLwqPZpMTUp2m4j>

## Rodar localmente

**Pré-requisitos:** Node.js


1. Instale as dependências:
   `npm install`
2. Copie `.env.example` para `.env.local` e preencha `GEMINI_API_KEY` com a sua chave do Gemini (arquivo ignorado pelo Git – nunca commite sua chave).
3. Execute o app:
   `npm run dev`

### Configurar a chave no GitHub (deploy)

1. Abra **Settings → Secrets and variables → Actions** no repositório e clique em **New repository secret**.
2. Informe `GEMINI_API_KEY` como nome e cole a mesma chave utilizada localmente.
3. Salve. O workflow `Deploy to GitHub Pages` já exporta esse secret para `npm run build`, portanto nenhuma etapa extra é necessária.

> **Importante:** sem `GEMINI_API_KEY` o build local apenas exibirá um aviso, mas no GitHub Actions ele falhará imediatamente para evitar publicar uma versão sem IA funcional.

## Automatizar commit + PR + deploy

Quando precisar que eu faça commit, PR e deploy sob demanda, execute o script abaixo na raiz do repositório (PowerShell 5+):

```powershell
pwsh ./scripts/auto-pr-deploy.ps1 -CommitMessage "Descrição do commit" -PrTitle "Título do PR" -PrBody "Resumo em Markdown"
```

O script executa `npm run build`, cria uma branch `auto/<timestamp>`, faz commit/push, abre o PR contra `main` e volta para o branch original. Use `-AutoMerge` para já mesclar o PR (o deploy do GitHub Pages dispara após o merge) ou `-SkipBuild` caso já tenha rodado o build manualmente. É necessário ter Git, Node/NPM e GitHub CLI (`gh`) configurados e autenticados.
