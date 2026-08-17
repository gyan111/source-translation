# Getting Started

This tutorial walks you through translating your first Wikipedia article using the Source Translation Tool.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm or pnpm package manager

## Step 1: Install and Start

```bash
# Clone the repository
git clone https://github.com/gyan111/source-translation.git
cd source-translation

# Install dependencies
npm install

# Start both the Vite dev server and the Express backend
npm run dev:all
```

You should see output like:

```
[0] VITE v5.3.1 ready in 300ms
[0]   ➜  Local:   http://localhost:5173/
[1] Server listening on port: 3000
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Step 2: Choose Languages

1. In the toolbar, select a **source language** (e.g., `English`)
2. Select a **target language** (e.g., `Hindi (हिन्दी)`)

!!! tip
    If the article already exists in the target language Wikipedia, you'll see a warning with a link to it.

## Step 3: Fetch an Article

1. Type an article name in the search box (e.g., `India`)
2. Suggestions will appear as you type — click one, or press Enter
3. The article will be fetched and split into paragraph sections

Each section shows:

- **Left panel**: Source wikitext (read-only)
- **Right panel**: Translation target (editable)

## Step 4: Translate

### Individual Paragraphs

Click the **Translate** button on any paragraph to translate just that section. The translation will appear in the right panel and you can edit it.

### Full Article

Click the **Translate** dropdown → **Translate Article** to enable paragraph-by-paragraph translation mode.

### Wikitext Mode

Click **Translate** dropdown → **Translate Wikitext** to paste raw wikitext or templates directly and translate them.

## Step 5: Review and Export

- Click **Preview** to see a rendered Wikipedia preview of your translation
- Click **Copy All** to copy the full translated wikitext
- Click **Export** to download as a `.wiki` file

## What Gets Translated?

| Element | Translation Method |
|---------|-------------------|
| Plain text | Translation service (MinT, Google, etc.) |
| `[[Wikilinks]]` | Wikidata sitelink resolution |
| `{{Templates}}` | Wikidata sitelink resolution |
| Template parameters | Translation service (text-heavy params only) |
| Headings (`== ==`) | Preserved, text translated |
| Bold/Italic | Preserved |
| Categories | Preserved as-is |
| Files/Images | Preserved as-is |
| References | Preserved as-is |
| HTML tags | Preserved as-is |

## Next Steps

- [Configure OpenAI](../how-to/configure-openai.md) for higher-quality translations
- [Add a custom translation service](adding-translation-service.md) 
- Read about the [translation pipeline](../explanation/translation-pipeline.md) in depth
