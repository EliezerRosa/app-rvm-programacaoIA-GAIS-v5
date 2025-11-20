# Execute e publique seu app do AI Studio

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Este repositório contém tudo que você precisa para rodar o app localmente.

Veja o app no AI Studio: <https://ai.studio/apps/drive/11l9oAhdWDXN-ZOPUznLwqPZpMTUp2m4j>

## Rodar localmente

**Pré-requisitos:** Node.js


1. Instale as dependências:
   `npm install`
2. Defina `GEMINI_API_KEY` em [.env.local](.env.local) com a sua chave do Gemini (apenas para desenvolvimento local). Em CI/CD use os *repository secrets* (`Settings > Secrets and variables > Actions`).
3. Execute o app:
   `npm run dev`

## Automatizar commit + PR + deploy

Quando precisar que eu faça commit, PR e deploy sob demanda, execute o script abaixo na raiz do repositório (PowerShell 5+):

```powershell
pwsh ./scripts/auto-pr-deploy.ps1 -CommitMessage "Descrição do commit" -PrTitle "Título do PR" -PrBody "Resumo em Markdown"
```

O script executa `npm run build`, cria uma branch `auto/<timestamp>`, faz commit/push, abre o PR contra `main` e volta para o branch original. Use `-AutoMerge` para já mesclar o PR (o deploy do GitHub Pages dispara após o merge) ou `-SkipBuild` caso já tenha rodado o build manualmente. É necessário ter Git, Node/NPM e GitHub CLI (`gh`) configurados e autenticados.
