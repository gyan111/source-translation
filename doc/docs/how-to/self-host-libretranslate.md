# Self-host LibreTranslate

[LibreTranslate](https://libretranslate.com/) is a free and open-source machine translation API. You can self-host it for unlimited, private translations.

## Option 1: Docker (Recommended)

```bash
docker run -d -p 5000:5000 libretranslate/libretranslate
```

Then in the Source Translation Tool:

1. Select **LibreTranslate** as the translation service
2. Set the endpoint to `http://localhost:5000/translate`
3. Leave the API key field empty (not needed for self-hosted)

## Option 2: Docker with GPU

For faster translations using CUDA:

```bash
docker run -d -p 5000:5000 --gpus all libretranslate/libretranslate
```

## Option 3: pip Install

```bash
pip install libretranslate
libretranslate --port 5000 --host 0.0.0.0
```

## Configuration Tips

!!! tip "Pre-download Language Models"
    By default LibreTranslate downloads models on first use. Pre-download for faster startup:
    ```bash
    docker run -d -p 5000:5000 \
      -e LT_LOAD_ONLY=en,hi,bn,ta,te \
      libretranslate/libretranslate
    ```

!!! tip "API Key for Public Instances"
    If using the public instance at `libretranslate.com`, an API key may be required. Get one at [libretranslate.com](https://libretranslate.com/).

## Verify Installation

```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"q": "Hello", "source": "en", "target": "hi"}'
```

Expected response:

```json
{"translatedText": "नमस्ते"}
```

## Language Support

LibreTranslate supports fewer language pairs than other services. Check [available languages](https://libretranslate.com/languages) for your pair. For Indian languages, MinT or Google Translate is recommended.
