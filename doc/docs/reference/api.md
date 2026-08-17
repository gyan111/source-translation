# API Endpoints

The Source Translation Tool exposes three REST API endpoints via the Express backend.

## POST `/translate`

Translate wikitext from one language to another.

### Request

```json
{
  "text": "'''India''' is a country in [[South Asia]].",
  "fromLanguage": "en",
  "toLanguage": "hi",
  "translationService": "mint",
  "apiKey": "optional-api-key",
  "apiEndpoint": "optional-custom-endpoint",
  "model": "optional-model-name"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ | Wikitext to translate |
| `fromLanguage` | string | ✅ | Source language code (e.g., `en`, `hi`) |
| `toLanguage` | string | ✅ | Target language code |
| `translationService` | string | ❌ | Service ID. Default: `mint` |
| `apiKey` | string | ❌ | API key for services that require it |
| `apiEndpoint` | string | ❌ | Custom API endpoint URL |
| `model` | string | ❌ | Model name (for OpenAI). Default: `gpt-4o-mini` |

### Response (200)

```json
{
  "translatedText": "'''भारत''' [[दक्षिण एशिया]] में एक देश है।",
  "stats": {
    "totalSegments": 3,
    "textSegments": 2,
    "linksFound": 1,
    "linksTranslated": 1,
    "templatesFound": 0,
    "templatesTranslated": 0,
    "templateParamsTranslated": 0,
    "errors": [],
    "timingMs": {
      "parsing": 2,
      "wikilinks": 350,
      "templates": 0,
      "textTranslation": 1200,
      "displayTexts": 800,
      "templateParams": 0,
      "total": 2352
    }
  }
}
```

### Error Response (400/500)

```json
{
  "error": "Error during translation",
  "message": "MinT translation failed for en→xx. All endpoints exhausted.",
  "suggestion": "Please try again later or with a different translation service"
}
```

---

## POST `/preview`

Render wikitext as HTML using the Wikipedia parser.

### Request

```json
{
  "text": "'''भारत''' [[दक्षिण एशिया]] में एक देश है।",
  "language": "hi"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ | Wikitext to render |
| `language` | string | ✅ | Language for rendering context |

### Response (200)

```json
{
  "html": "<p><b>भारत</b> <a href=\"/wiki/दक्षिण_एशिया\">दक्षिण एशिया</a> में एक देश है।</p>"
}
```

---

## POST `/translate/template`

Translate a standalone Wikipedia template (e.g., Infobox, Cite web, Taxobox) with Wikidata template name resolution and parameter value translation.

### Request

```json
{
  "template": "{{Infobox person | name = Albert Einstein | birth_place = Ulm, Germany | fields = Physics }}",
  "fromLanguage": "en",
  "toLanguage": "hi",
  "translationService": "mint",
  "apiKey": "optional-api-key",
  "apiEndpoint": "optional-endpoint",
  "model": "optional-model"
}
```

### Response (200)

```json
{
  "translatedTemplate": "{{व्यक्ति की जानकारी\n| name = अल्बर्ट आइंस्टीन\n| birth_place = उल्म, जर्मनी\n| fields = भौतिकी\n}}",
  "parsed": {
    "name": "Infobox person",
    "params": [
      { "name": "name", "value": "Albert Einstein", "isNamed": true },
      { "name": "birth_place", "value": "Ulm, Germany", "isNamed": true },
      { "name": "fields", "value": "Physics", "isNamed": true }
    ],
    "isMultiLine": true
  },
  "stats": {
    "templateName": "Infobox person",
    "translatedName": "व्यक्ति की जानकारी",
    "paramsCount": 3,
    "paramsTranslated": 3,
    "timingMs": { "nameTranslation": 240, "paramTranslation": 680, "total": 920 },
    "errors": []
  }
}
```

---

## POST `/publish`

Publish translated wikitext directly to Wikipedia (requires OAuth authentication).

### Request

```json
{
  "title": "User:Username/Albert Einstein",
  "wikitext": "'''अल्बर्ट आइंस्टीन'''...",
  "summary": "Translated from en:Albert Einstein via Source Translation Tool",
  "language": "hi",
  "destination": "sandbox"
}
```

---

## GET `/translate/services`

List all available translation services.

### Response (200)

```json
[
  {
    "id": "mint",
    "name": "Wikimedia MinT (Free)",
    "requiresKey": false,
    "description": "Free machine translation hosted by Wikimedia. Best for Wikipedia content."
  },
  {
    "id": "deepl",
    "name": "DeepL Translator",
    "requiresKey": true,
    "description": "High quality neural translation. Supports Free (...:fx) and Pro API keys."
  },
  {
    "id": "openai",
    "name": "OpenAI GPT",
    "requiresKey": true,
    "description": "High-quality translation using OpenAI models (GPT-4o, GPT-4o-mini)."
  },
  {
    "id": "custom_openai",
    "name": "Universal AI / LLM",
    "requiresKey": false,
    "description": "Any OpenAI-compatible LLM endpoint (Groq, DeepSeek, Ollama, OpenRouter)."
  },
  {
    "id": "google",
    "name": "Google Cloud",
    "requiresKey": true,
    "description": "Official Google Cloud Translation API v2."
  },
  {
    "id": "microsoft",
    "name": "Microsoft Azure",
    "requiresKey": true,
    "description": "Microsoft Azure Cognitive Services Translator."
  },
  {
    "id": "libretranslate",
    "name": "LibreTranslate",
    "requiresKey": false,
    "description": "Open-source machine translation. Self-hosted or public instances."
  },
  {
    "id": "custom_rest",
    "name": "Custom REST MT Endpoint",
    "requiresKey": false,
    "description": "Connect any custom internal translation microservice via REST."
  }
]
```
