# 🌐 Source Translation Tool

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hosted on Wikimedia Toolforge](https://img.shields.io/badge/Hosted%20on-Wikimedia%20Toolforge-brightgreen.svg)](https://source-translation.toolforge.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Vue 3](https://img.shields.io/badge/Vue.js-3.x-emerald.svg)](https://vuejs.org)

**Source Translation Tool** is an open-source tool for translating Wikipedia articles between languages while preserving MediaWiki formatting, wikilinks, and templates.

🔗 **Live Tool:** [https://source-translation.toolforge.org](https://source-translation.toolforge.org)

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- **Node.js** 18+ and **npm**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/gyan111/source-translation.git
cd source-translation
npm install
```

### 2. Configure Environment Variables
Copy the example `.env` file:
```bash
cp .env.example .env
```

### 3. Start Development Servers
Run both frontend (Vite) and backend (Express) concurrently:
```bash
npm run dev:all
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

### 4. Build for Production
```bash
npm run build
npm start
```

### 5. Run Automated Tests
```bash
npm test
```

---

## 📚 Documentation

Detailed documentation built with MkDocs is available in the [`doc/`](doc/) directory:

* **[Documentation Home](doc/docs/index.md)** - Overview and architecture guide
* **[Tutorials](doc/docs/tutorials/)** - Step-by-step guides for translating articles and templates
* **[How-To Guides](doc/docs/how-to/)** - Connecting translation services (DeepL, OpenAI, MinT, Ollama) and Toolforge deployment
* **[Reference](doc/docs/reference/)** - API endpoints, wikitext parser specifications, and configuration options
* **[Explanation](doc/docs/explanation/)** - Translation pipeline mechanics and Wikidata sitelink mapping

To serve documentation locally:
```bash
cd doc && mkdocs serve
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
