import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: false });
dotenv.config({ override: false });

const distDir = 'dist';

async function build() {
  try {
    console.log('Iniciando processo de build...');

    // 1. Limpa e cria o diretório 'dist'
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.mkdir(distDir);

    // 2. Configura a chave da API
    // ATENÇÃO: Em um ambiente de produção real, chaves de API não devem ser expostas no front-end.
    // Se estiver usando GitHub Actions, configure o secret GEMINI_API_KEY lá.
    if (!process.env.API_KEY && process.env.GEMINI_API_KEY) {
      process.env.API_KEY = process.env.GEMINI_API_KEY;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const aiProxyUrl = process.env.AI_PROXY_URL || '';
    if (!apiKey) {
        const message = 'A variável de ambiente GEMINI_API_KEY não foi definida. Configure-a em .env.local (desenvolvimento) ou como GitHub Secret para builds.';
        if (isCi) {
            throw new Error(message);
        }
        console.warn(`AVISO: ${message}`);
    }

    // 3. Compila o JavaScript (Bundle)
    await esbuild.build({
      entryPoints: ['index.tsx'],
      bundle: true,
      outfile: path.join(distDir, 'bundle.js'),
      minify: true,
      sourcemap: true,
      target: ['es2020'],
      loader: { '.tsx': 'tsx', '.ts': 'ts' },
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.API_KEY': `"${apiKey}"`,
        'process.env.AI_PROXY_URL': `"${aiProxyUrl}"`
      },
    });
    console.log('JS compilado com sucesso.');

    // 4. Processa o index.html
    let htmlContent = await fs.readFile('index.html', 'utf-8');
    const cacheBuster = Date.now().toString();
    
    // Remove o importmap (não necessário pois estamos empacotando tudo)
    htmlContent = htmlContent.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
    
    // Substitui a chamada do módulo pelo bundle gerado
    htmlContent = htmlContent.replace(
      /<script type="module" src="\/index.tsx"><\/script>/,
      `<script src="bundle.js?v=${cacheBuster}"></script>`
    );
    
    await fs.writeFile(path.join(distDir, 'index.html'), htmlContent);
    console.log('HTML processado e copiado.');

    console.log('Build concluído! A pasta "dist" está pronta para deploy.');

  } catch (e) {
    console.error('Erro no build:', e);
    // @ts-ignore
    process.exit(1);
  }
}

build();