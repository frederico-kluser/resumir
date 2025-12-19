<div align="center">

# Resumir

**Summarize YouTube videos with Artificial Intelligence**

[![Version](https://img.shields.io/badge/Version-1.1.2-blue.svg)](https://github.com/user/resumir/releases)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev)

**[Português](README.pt-BR.md)**

</div>

---

## What is Resumir?

**Resumir** is a Chrome browser extension (side panel) that uses the Google Gemini API to intelligently analyze YouTube
videos. With it, you can:

- **Get instant summaries** of any video with captions
- **Ask specific questions** about the video content
- **Navigate through key moments** with clickable timestamps
- **Save time** by understanding content before watching

## Features

| Feature                  | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| **Smart Summary**        | Generates a concise ~100-word summary of the video          |
| **Q&A**                  | Answers specific questions based on the video transcript    |
| **Key Moments**          | Identifies and lists 3-5 crucial moments with timestamps    |
| **Clickable Timestamps** | Click any timestamp to jump directly to that moment         |
| **Multi-language**       | Interface available in 10 languages                         |
| **Caption Detection**    | Automatically indicates if the video has captions available |

## How It Works

```
1. Open a video on YouTube
2. Click the Resumir icon in the Chrome toolbar
3. (Optional) Type a specific question about the video
4. Click "Summarize" and wait for the analysis
5. Browse the results and click timestamps to jump to specific moments
```

## Architecture

| Component                | File(s)                     | Description                                                                   |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| **UI / Side Panel**      | `App.tsx`, `components/*`   | React interface rendered as extension side panel                              |
| **Background**           | `background.ts`             | Service worker managing states and permissions                                |
| **Content Script**       | `content.ts`                | Injects code into YouTube to extract transcripts and control the player       |
| **AI Service**           | `services/geminiService.ts` | LangChain multi-provider orchestrator (Gemini/OpenAI/Anthropic/Groq/DeepSeek) |
| **Storage**              | `services/apiKeyStorage.ts` | Manages API key securely and locally                                          |
| **Internationalization** | `i18n.ts`                   | Complete translation setup for 10 languages                                   |

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.8
- **Build:** Vite 7
- **Styling:** Tailwind CSS 3
- **AI:** Google Gemini API (gemini-2.5-flash model)
- **i18n:** react-i18next
- **Extension:** Chrome Extensions Manifest V3

## Installation

### Prerequisites

- Node.js 18+ (recommended 20+)
- Chrome 120+
- Google Gemini API Key

### Steps

1. **Clone the repository**

```bash
git clone https://github.com/frederico-kluser/resumir.git
cd resumir
```

2. **Install dependencies**

```bash
npm install
```

3. **Build for production**

```bash
npm run build
```

4. **Load in Chrome**

   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

5. **Configure your API Key**
   - Open Resumir and paste your Gemini API key when prompted

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Generate production build in dist/
npm run preview   # Preview build locally
```

---

## Open Source

This project is **open source** and available under the **Creative Commons Attribution-NonCommercial 4.0 International
(CC BY-NC 4.0)** license.

### You can:

- **Share** — copy and redistribute the material in any format
- **Adapt** — remix, transform, and build upon the material

### Under the following conditions:

- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes

### You may NOT:

- Use this project or derived code in commercial applications
- Sell or directly monetize this software
- Include in paid products or services

For commercial use, please contact the developer.

---

## Contributing

Contributions are welcome! Feel free to:

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

---

## Security & Privacy

- **API keys are stored locally** in your browser
- **No data is sent to external servers** other than the Google Gemini API
- **Transcripts are processed on demand** and are not stored
- **No third-party tracking or analytics**

---

## Developer

<div align="center">

Developed by **Frederico Kluser**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Frederico%20Kluser-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/frederico-kluser/)
[![GitHub](https://img.shields.io/badge/GitHub-frederico--kluser-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/frederico-kluser)

</div>

---

## License

This project is licensed under the
[Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/).

See the [LICENSE](LICENSE) file for more details.

---

<div align="center">

**Resumir** - Understand videos in seconds

[Report Bug](https://github.com/frederico-kluser/resumir/issues) ·
[Request Feature](https://github.com/frederico-kluser/resumir/issues)

</div>
