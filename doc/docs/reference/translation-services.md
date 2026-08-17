# Translation Services

Detailed reference for each supported translation backend.

## Wikimedia MinT (Default)

| Property | Value |
|----------|-------|
| ID | `mint` |
| API Key Required | No |
| Rate Limits | Subject to Wikimedia API limits |
| Best For | Wikipedia content, Indian languages |

**Endpoints tried (in order):**

1. `https://translate.wmcloud.org/api/translate` — MinT direct API
2. `https://cxserver.wikimedia.org/v2/translate/{from}/{to}/MinT` — CXServer MinT
3. `https://cxserver.wikimedia.org/v2/translate/{from}/{to}/Apertium` — CXServer Apertium

MinT is specifically trained for Wikipedia content and supports a wide range of Indian languages. It's the recommended default for this tool.

---

## Google Cloud Translation

| Property | Value |
|----------|-------|
| ID | `google` |
| API Key Required | **Yes** |
| Limits | Dependent on Google Cloud billing |
| Best For | General text, high availability |

Uses the official Google Cloud Translation API (v2 REST API). Requires a Google Cloud API key with Translation API enabled.

---

## Microsoft Azure Translator

| Property | Value |
|----------|-------|
| ID | `microsoft` |
| API Key Required | **Yes** |
| Limits | Dependent on Azure billing (Free tier available) |
| Best For | General text, alternative to Google |

Uses the official Microsoft Azure AI Translator API. Requires an Azure Cognitive Services API key. If your resource is deployed to a specific region, enter the key in the format `region:key` (e.g. `eastus:abc123def456`).

---

## OpenAI GPT

| Property | Value |
|----------|-------|
| ID | `openai` |
| API Key Required | **Yes** |
| Default Model | `gpt-4o-mini` |
| Default Endpoint | `https://api.openai.com/v1/chat/completions` |
| Best For | High-quality translations, complex text |

Uses a wiki-aware system prompt that instructs the model to:

- Preserve all wiki markup syntax
- Not translate placeholder tokens
- Maintain paragraph structure
- Use proper terminology for the target language

Supports any OpenAI-compatible API (Azure OpenAI, Ollama, vLLM, etc.) via custom endpoint.

---

## LibreTranslate

| Property | Value |
|----------|-------|
| ID | `libretranslate` |
| API Key Required | Optional (for public instance) |
| Default Endpoint | `https://libretranslate.com/translate` |
| Best For | Privacy-focused, self-hosted deployments |

Open-source translation API. Can be [self-hosted](../how-to/self-host-libretranslate.md) for unlimited, private translations.

---

## DeepL Translator

| Property | Value |
|----------|-------|
| ID | `deepl` |
| API Key Required | **Yes** |
| Supported Keys | DeepL Free (`...:fx`) and DeepL Pro |
| Best For | High accuracy European & Asian translation |

Connects to DeepL's official API (`api-free.deepl.com` or `api.deepl.com` based on key suffix).

---

## Universal AI / LLM (`custom_openai`)

| Property | Value |
|----------|-------|
| ID | `custom_openai` |
| API Key Required | Optional (depends on endpoint) |
| Best For | Groq, DeepSeek, local Ollama, LM Studio, OpenRouter |

Connects to any standard OpenAI-compatible `/v1/chat/completions` API endpoint:

* **Groq**: `https://api.groq.com/openai/v1/chat/completions` (Model: `llama-3.3-70b-versatile`)
* **DeepSeek**: `https://api.deepseek.com/v1/chat/completions` (Model: `deepseek-chat`)
* **Local Ollama**: `http://localhost:11434/v1/chat/completions` (Model: `llama3`, `mistral`)
* **OpenRouter**: `https://openrouter.ai/api/v1/chat/completions`

---

## Custom REST MT Endpoint

| Property | Value |
|----------|-------|
| ID | `custom_rest` |
| API Key Required | Optional |
| Best For | Proprietary or internal translation microservices |

Connects to any custom REST endpoint returning `{ "translation": "..." }` or `{ "translatedText": "..." }`.

---

## Language Support Matrix

| Language | MinT | DeepL | Universal AI / LLM | Google | Microsoft | OpenAI | LibreTranslate |
|----------|------|-------|-------------------|--------|-----------|--------|----------------|
| Hindi | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Bengali | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tamil | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Telugu | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Marathi | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gujarati | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kannada | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Malayalam | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Punjabi | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Odia | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Urdu | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| German | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| French | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spanish | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Japanese | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chinese | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |


!!! note
    MinT availability varies by language pair. Some pairs may fall back to Apertium.
