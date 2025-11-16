# 📖 Guia de Uso - App RVM

## Introdução

Este é um guia completo para usar o aplicativo de Designações da Reunião Vida e Ministério, desenvolvido inteiramente com Google AI Studio.

## Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Conexão com a internet
- Chave da API do Google AI Studio

## Obtenção da Chave API

1. Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Faça login com sua conta Google
3. Clique em "Create API Key"
4. Copie a chave gerada

## Passo a Passo

### 1. Abrir a Aplicação

Abra o arquivo `index.html` em seu navegador web preferido. Você pode:
- Clicar duas vezes no arquivo
- Arrastar o arquivo para o navegador
- Usar "Abrir Arquivo" no menu do navegador

### 2. Configurar a API

Na seção "Configuração da API":
1. Cole sua chave da API no campo
2. Clique em "Salvar Chave"
3. Você verá a mensagem "✓ Chave salva com sucesso!"

A chave ficará salva no navegador para uso futuro.

### 3. Preparar os Dados

#### Data da Reunião
- Selecione a data usando o seletor de calendário
- Por padrão, aparece a data de hoje

#### Participantes
Liste os nomes dos participantes disponíveis, um por linha:
```
João Silva
Maria Santos
Pedro Oliveira
Ana Costa
```

#### Partes da Reunião
Liste as partes que precisam ser designadas, uma por linha:
```
Presidente
Discurso de 10 minutos
Leitor
Vídeo Inicial
Primeira Conversa
Segunda Conversa
```

### 4. Gerar Designações

1. Clique no botão "🤖 Gerar com IA"
2. Aguarde enquanto a IA processa (aparecerá um indicador de carregamento)
3. As designações aparecerão automaticamente na seção "Designações Geradas"

### 5. Usar as Designações

Você tem três opções:

#### 📋 Copiar
- Copia as designações como texto
- Cole em qualquer aplicativo (Word, Email, WhatsApp)

#### 🖨️ Imprimir
- Abre a janela de impressão do navegador
- O layout é otimizado para impressão

#### 💾 Baixar
- Salva as designações como arquivo .txt
- Nome do arquivo: `designacoes-YYYY-MM-DD.txt`

### 6. Histórico

O aplicativo mantém um histórico das últimas 10 designações geradas:
- Clique em qualquer item do histórico para visualizar novamente
- O histórico é mantido mesmo se você fechar o navegador

## Dicas e Melhores Práticas

### Nomes dos Participantes
- Use nomes completos ou apelidos reconhecíveis
- Mantenha uma lista consistente
- Não use caracteres especiais desnecessários

### Partes da Reunião
- Seja específico nos nomes das partes
- Use a nomenclatura oficial do programa
- Inclua detalhes importantes (ex: "Discurso de 10 minutos")

### Distribuição Inteligente
A IA considera:
- Equilibrar as designações entre participantes
- Evitar sobrecarregar alguém com muitas partes
- Variar os tipos de partes para cada pessoa

## Solução de Problemas

### "Por favor, configure sua chave da API primeiro!"
**Solução**: Você precisa salvar uma chave da API válida na seção de configuração.

### "Erro ao gerar designações"
**Possíveis causas**:
- Chave da API inválida ou expirada
- Sem conexão com a internet
- Campos vazios

**Solução**: Verifique sua chave da API e conexão com a internet.

### As designações não fazem sentido
**Solução**: Tente gerar novamente. A IA usa algoritmos probabilísticos e pode produzir resultados diferentes a cada execução.

## Privacidade e Segurança

- ✅ Sua chave da API fica armazenada apenas no seu navegador
- ✅ Nenhum dado é enviado para servidores terceiros
- ✅ As designações ficam salvas apenas no seu computador
- ✅ Você pode limpar os dados a qualquer momento limpando o cache do navegador

## Limpando os Dados

Para remover todos os dados salvos:

### Chrome/Edge
1. Pressione F12
2. Vá em "Application" > "Local Storage"
3. Clique com botão direito > "Clear"

### Firefox
1. Pressione F12
2. Vá em "Storage" > "Local Storage"
3. Clique com botão direito > "Delete All"

## Suporte

Para problemas ou sugestões:
1. Verifique este guia primeiro
2. Consulte o README.md para informações técnicas
3. Abra uma issue no repositório GitHub

## Limitações Conhecidas

- Limite de 10 itens no histórico
- Requer conexão com internet para gerar novas designações
- A qualidade das designações depende da qualidade dos dados de entrada

---

**Desenvolvido com Google AI Studio** 🤖
