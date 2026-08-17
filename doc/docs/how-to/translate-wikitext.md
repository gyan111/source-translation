# Translate Wikitext Directly

The wikitext mode allows you to paste raw wikitext or templates and translate them without fetching a full Wikipedia article.

## When to Use

- Translating a specific Wikipedia template or infobox
- Translating a section you've copied from the wiki editor
- Testing how the translation pipeline handles specific markup

## Steps

1. Click the **Translate** dropdown in the toolbar
2. Select **Translate Wikitext**
3. A text area will appear — paste your wikitext
4. Choose source and target languages
5. Click **Translate**
6. The translated wikitext appears below
7. Use **Copy** to copy the result

## Example

### Input (English)

```wikitext
{{Infobox country
|name = Republic of India
|capital = [[New Delhi]]
|largest_city = [[Mumbai]]
|official_languages = [[Hindi]], [[English language|English]]
}}

'''India''', officially the '''Republic of India''', is a country in [[South Asia]].
It is the [[List of countries and dependencies by population|most populous country]]
in the world.
```

### Output (Hindi)

The tool will:

1. Resolve `[[New Delhi]]` → `[[नई दिल्ली]]` via Wikidata
2. Resolve `[[Mumbai]]` → `[[मुम्बई]]` via Wikidata
3. Translate `Infobox country` → `जानकारी डिब्बा देश` via Wikidata
4. Translate plain text via the selected translation service
5. Preserve all `'''`, `[[]]`, `{{}}` markup

## Tips

!!! tip "Large Templates"
    For very large templates (like country infoboxes), the tool splits parameters and translates text-heavy ones while preserving numeric values and dates.

!!! tip "Preview"
    After translating, you can use the **Preview** button to see how the wikitext renders.
