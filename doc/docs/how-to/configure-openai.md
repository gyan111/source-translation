# Configure OpenAI Translation

This guide shows how to set up OpenAI GPT models for high-quality Wikipedia article translation.

## Prerequisites

- An OpenAI API account with credits
- An API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Setup

1. In the translation toolbar, select **OpenAI GPT** from the service dropdown
2. Enter your API key in the field that appears (starts with `sk-...`)
3. _(Optional)_ Enter a custom endpoint URL if using an OpenAI-compatible API

!!! info "Default Model"
    The default model is `gpt-4o-mini`, which provides good quality at low cost. For best results, you can use `gpt-4o` but it costs more.

## Cost Estimates

| Article Size | Token Count | Approximate Cost (4o-mini) |
|-------------|-------------|---------------------------|
| Short (1KB) | ~500 tokens | ~$0.001 |
| Medium (10KB) | ~5,000 tokens | ~$0.008 |
| Long (50KB) | ~25,000 tokens | ~$0.04 |

## Using a Custom Endpoint

If you're using an OpenAI-compatible API (like Azure OpenAI, Ollama, or vLLM), enter the endpoint URL:

```
https://your-instance.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-01
```

Or for local Ollama:

```
http://localhost:11434/v1/chat/completions
```

## How It Works

The OpenAI adapter uses a carefully crafted system prompt that:

- Instructs the model to translate from source to target language
- Tells it to preserve ALL wiki markup syntax (`==`, `'''`, `''`, `*`, `#`)
- Warns not to translate placeholder tokens used by the parser
- Produces natural, accurate translations with proper terminology

## Troubleshooting

!!! warning "Empty Response"
    If you get "Empty response from OpenAI", check:
    
    - Your API key is valid and has credits
    - You haven't exceeded rate limits
    - The text isn't too long (max ~16K tokens per chunk)

!!! warning "Slow Translation"
    OpenAI translations take 2-10 seconds per paragraph. This is normal. For faster translations, use MinT or Google Translate.
