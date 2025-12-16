<div align="center">

# Resumir

**Resuma vídeos do YouTube com Inteligência Artificial**

[![Version](https://img.shields.io/badge/Version-0.0.8-blue.svg)](https://github.com/user/resumir/releases)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

**[English](README.md)**

</div>

---

## O que é o Resumir?

O **Resumir** é uma extensão de navegador (side panel) para Chrome que utiliza a API do Google Gemini para analisar vídeos do YouTube de forma inteligente. Com ela, você pode:

- **Obter resumos instantâneos** de qualquer vídeo com legendas
- **Fazer perguntas específicas** sobre o conteúdo do vídeo
- **Navegar por momentos-chave** com timestamps clicáveis
- **Economizar tempo** entendendo o conteúdo antes de assistir

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Resumo Inteligente** | Gera um resumo conciso de aproximadamente 100 palavras do vídeo |
| **Perguntas e Respostas** | Responde perguntas específicas baseadas na transcrição do vídeo |
| **Momentos-Chave** | Identifica e lista 3-5 momentos cruciais com timestamps |
| **Timestamps Clicáveis** | Clique em qualquer timestamp para pular diretamente para aquele momento |
| **Multi-idiomas** | Interface disponível em 10 idiomas: Português, Inglês, Espanhol, Francês, Chinês, Hindi, Árabe, Bengali, Russo e Indonésio |
| **Detecção de Legendas** | Indica automaticamente se o vídeo possui legendas disponíveis |

## Como Funciona

```
1. Abra um vídeo no YouTube
2. Clique no ícone do Resumir na barra do Chrome
3. (Opcional) Digite uma pergunta específica sobre o vídeo
4. Clique em "Resumir" e aguarde a análise
5. Navegue pelos resultados e clique nos timestamps para pular para momentos específicos
```

## Arquitetura

| Componente | Arquivo(s) | Descrição |
|------------|-----------|-----------|
| **UI / Side Panel** | `App.tsx`, `components/*` | Interface React renderizada como side panel da extensão |
| **Background** | `background.ts` | Service worker que gerencia estados e permissões |
| **Content Script** | `content.ts` | Injeta código no YouTube para extrair transcrições e controlar o player |
| **Serviço de IA** | `services/geminiService.ts` | Integração com a API Gemini para análise de conteúdo |
| **Armazenamento** | `services/apiKeyStorage.ts` | Gerencia a chave da API de forma segura e local |
| **Internacionalização** | `i18n.ts` | Configuração completa de tradução para 10 idiomas |

## Stack Tecnológica

- **Frontend:** React 19 + TypeScript 5.8
- **Build:** Vite 7
- **Estilização:** Tailwind CSS 3
- **IA:** Google Gemini API (modelo gemini-2.5-flash)
- **i18n:** react-i18next
- **Extensão:** Chrome Extensions Manifest V3

## Instalação

### Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Chrome 120+
- Chave de API do Google Gemini

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/frederico-kluser/resumir.git
cd resumir
```

2. **Instale as dependências**
```bash
npm install
```

3. **Gere o build de produção**
```bash
npm run build
```

4. **Carregue no Chrome**
   - Acesse `chrome://extensions`
   - Ative o "Modo do desenvolvedor"
   - Clique em "Carregar sem compactação"
   - Selecione a pasta `dist`

5. **Configure sua API Key**
   - Abra o Resumir e cole sua chave da API Gemini quando solicitado

## Scripts Disponíveis

```bash
npm run dev       # Inicia o servidor de desenvolvimento
npm run build     # Gera build de produção na pasta dist/
npm run preview   # Visualiza o build localmente
```

---

## Open Source

Este projeto é **open source** e está disponível sob a licença **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

### Você pode:

- **Compartilhar** — copiar e redistribuir o material em qualquer formato
- **Adaptar** — remixar, transformar e criar a partir do material

### Sob as seguintes condições:

- **Atribuição** — Você deve dar o crédito apropriado, fornecer um link para a licença e indicar se foram feitas alterações
- **Não Comercial** — Você não pode usar o material para fins comerciais

### Você NÃO pode:

- Usar este projeto ou código derivado em aplicações comerciais
- Vender ou monetizar diretamente este software
- Incluir em produtos ou serviços pagos

Para uso comercial, entre em contato com o desenvolvedor.

---

## Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commitar suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Fazer push para a branch (`git push origin feature/nova-feature`)
5. Abrir um Pull Request

---

## Segurança e Privacidade

- **As chaves de API são armazenadas localmente** no seu navegador
- **Nenhum dado é enviado para servidores externos** além da API do Google Gemini
- **As transcrições são processadas sob demanda** e não são armazenadas
- **Sem rastreamento ou analytics de terceiros**

---

## Desenvolvedor

<div align="center">

Desenvolvido por **Frederico Kluser**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Frederico%20Kluser-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/frederico-kluser/)
[![GitHub](https://img.shields.io/badge/GitHub-frederico--kluser-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/frederico-kluser)

</div>

---

## Licença

Este projeto está licenciado sob a [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).

Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">

**Resumir** - Entenda vídeos em segundos

[Reportar Bug](https://github.com/frederico-kluser/resumir/issues) · [Solicitar Feature](https://github.com/frederico-kluser/resumir/issues)

</div>
