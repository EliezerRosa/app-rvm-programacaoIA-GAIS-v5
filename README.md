# Execute e publique seu app do AI Studio

![GHBanner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

Este repositório contém tudo que você precisa para rodar o app localmente.

Veja o app no AI Studio: <https://ai.studio/apps/drive/11l9oAhdWDXN-ZOPUznLwqPZpMTUp2m4j>

## Rodar localmente

**Pré-requisitos:** Node.js


1. Instale as dependências:
   `npm install`
2. Copie `.env.example` para `.env.local` e defina ao menos um dos valores abaixo:
   - `GEMINI_API_KEY`: use somente em ambiente local, pois a chave fica exposta no bundle.
   - `AI_PROXY_URL`: URL do worker/proxy que protegerá a chave em produção (veja a seção **Proxy via Cloudflare Workers**).
3. Execute o app:
   `npm run dev`

Quando `GEMINI_API_KEY` não estiver disponível, o app usará automaticamente `AI_PROXY_URL` para chamar o proxy seguro.

### Configurar as chaves no GitHub (deploy)

1. Abra **Settings → Secrets and variables → Actions** e clique em **New repository secret**.
2. Cadastre `GEMINI_API_KEY` (opcional em produção) e `AI_PROXY_URL` (obrigatório para o proxy) com os mesmos valores usados localmente.
3. O workflow `Deploy to GitHub Pages` já exporta esses secrets para `npm run build`, então nenhuma etapa adicional é necessária.

> **Importante:** sem `GEMINI_API_KEY` o build local apenas exibirá um aviso, mas no GitHub Actions ele depende de pelo menos um dos dois valores. Caso só use o proxy, garanta que `AI_PROXY_URL` esteja definido.

## Proxy via Cloudflare Workers (recomendado para produção)

O diretório [`worker/`](worker/) contém um Worker pronto (`ai-scheduler-proxy.ts`) que chama o Gemini e expõe somente um endpoint seguro para o front-end.

1. Instale o Wrangler: <https://developers.cloudflare.com/workers/wrangler/install-and-update/>.
2. Dentro de `worker/`, copie `wrangler.example.toml` para `wrangler.toml` e ajuste o nome do serviço, se desejar.
3. Configure o segredo no Worker:

   ```bash
   wrangler secret put GEMINI_API_KEY
   ```

4. Faça o deploy:

   ```bash
   wrangler deploy
   ```

5. Copie a URL pública retornada (ex.: `https://ai-scheduler-proxy.yourname.workers.dev`) e configure-a em `AI_PROXY_URL` no `.env.local`, nos secrets do GitHub Actions e/ou em qualquer ambiente onde o app será servido.

Com isso o bundle publicado no GitHub Pages permanece totalmente estático e o segredo do Gemini fica protegido dentro do Worker.

## Automatizar commit + PR + deploy

Quando precisar que eu faça commit, PR e deploy sob demanda, execute o script abaixo na raiz do repositório (PowerShell 5+):

```powershell
pwsh ./scripts/auto-pr-deploy.ps1 -CommitMessage "Descrição do commit" -PrTitle "Título do PR" -PrBody "Resumo em Markdown"
```

O script executa `npm run build`, cria uma branch `auto/<timestamp>`, faz commit/push, abre o PR contra `main` e volta para o branch original. Use `-AutoMerge` para já mesclar o PR (o deploy do GitHub Pages dispara após o merge) ou `-SkipBuild` caso já tenha rodado o build manualmente. É necessário ter Git, Node/NPM e GitHub CLI (`gh`) configurados e autenticados.
