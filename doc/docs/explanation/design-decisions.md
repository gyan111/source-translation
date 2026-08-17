# Design Decisions

This document explains the key design decisions made in the Source Translation Tool and their rationale.

## Why Parse Wikitext Instead of Translating Raw Text?

**Decision**: Segment wikitext into typed parts before translation rather than translating the raw wikitext directly.

**Rationale**: Translation APIs are designed for natural language text. When you feed them wikitext like:

```wikitext
{{Infobox country|name=India}} is in [[South Asia]], with a population of {{formatnum:1428627663}}.
```

The translation API will:

- Try to translate `{{Infobox country}}` as literal text
- May break the `{{` `}}` delimiters
- Translate `[[South Asia]]` as "[[दक्षिण एशिया]]" instead of resolving the actual Hindi article title
- Possibly mangle `{{formatnum:...}}`

By parsing first, we send only plain text to the translation API and use Wikidata for structural elements.

## Why Stack-Based Parsing Instead of Regex?

**Decision**: Use a stack-based parser for templates and wikilinks instead of regular expressions.

**Rationale**: Real Wikipedia articles have deeply nested templates:

```wikitext
{{Infobox country
|name = {{lang|en|India}}
|area  = {{convert|3287263|km2|sqmi|abbr=on}}
|leader_name = {{nowrap|[[Narendra Modi]]}}
}}
```

A regex like `\{\{.*?\}\}` would match `{{lang|en|India}}` but miss the outer `{{Infobox country...}}`. Even a regex handling 2-3 levels of nesting fails on real-world Wikipedia content where 5+ levels is common.

The stack-based parser handles arbitrary nesting by tracking `{{` and `}}` openings and closings on a stack, producing correct results for any depth.

## Why Wikidata Instead of Translation API for Links?

**Decision**: Resolve wikilinks using Wikidata sitelinks API instead of translating link targets as text.

**Rationale**: Wikipedia article titles are not literal translations. For example:

| English | Hindi (correct) | Hindi (literal translation) |
|---------|----------------|--------------------------|
| Solar System | सौर मण्डल | सौर प्रणाली ❌ |
| Mumbai | मुम्बई | मुम्बई ✅ (coincidentally same) |
| United States | संयुक्त राज्य | संयुक्त राज्य ✅ |
| Cat | बिल्ली | बिल्ली ✅ |
| Photosynthesis | प्रकाश संश्लेषण | प्रकाश संश्लेषण ✅ |

While many titles are correct literal translations, the only **authoritative** source for cross-language article mapping is Wikidata. It's the same system that Wikipedia itself uses for interlanguage links.

## Why MinT as Default?

**Decision**: Use Wikimedia's MinT (Machine Translation) as the default service.

**Rationale**:

1. **Free and keyless**: No API key required
2. **Wikipedia-trained**: Specifically designed for Wikipedia content, produces better translations for encyclopedic text
3. **Ethical alignment**: It's part of the Wikimedia ecosystem, consistent with the tool's purpose
4. **Indian language support**: Good coverage for Indian languages which are the primary target audience

Other services are available as fallbacks or for users who prefer different quality/speed tradeoffs.

## Why Server-Side Translation?

**Decision**: All translation happens on the Express backend, not in the browser.

**Rationale**:

1. **CORS**: Many translation APIs don't support browser-side CORS requests
2. **API keys**: Server-side prevents API key exposure in browser DevTools
3. **Rate limiting**: Server can implement rate limiting to protect API keys
4. **Caching**: Server-side LRU cache for Wikidata lookups persists across users
5. **Chunking**: Server handles text chunking without browser memory concerns

## Why Adapter Pattern for Translation Services?

**Decision**: Each translation service is a function (adapter) in a registry, rather than a class hierarchy.

**Rationale**:

- **Simplicity**: Adding a new service requires one function + one registry entry
- **No inheritance complexity**: No abstract classes, no method overriding issues
- **Easy testing**: Each adapter is independently testable
- **Hot-swappable**: The registry can be extended at runtime

```javascript
// Adding a service is this simple:
async function myTranslate(text, fromLang, toLang, options) {
  return await callMyApi(text, fromLang, toLang);
}

const ADAPTERS = { ...ADAPTERS, myservice: myTranslate };
```

## Why Client-Side Article Fetching?

**Decision**: Fetch Wikipedia articles from the browser using `origin=*` CORS on the Wikipedia API.

**Rationale**:

- Reduces server load — article fetching is read-only and can be done client-side
- Wikipedia's `origin=*` parameter explicitly enables CORS for third-party apps
- The article parser `action=parse` is a read operation with no authentication needed
- Autocomplete suggestions (`action=opensearch`) also work client-side

## Why Preserve Categories and Files As-Is?

**Decision**: Don't translate `[[Category:...]]` or `[[File:...]]` content.

**Rationale**:

- Categories in the target language Wikipedia have different structures and naming
- A translated category name may not exist and would create a red link
- File names are shared across all Wikimedia projects (Commons)
- Translating file captions could be useful but would require parsing the complex file link syntax with multiple parameters

## Why LRU Cache with TTL Instead of Persistent Cache?

**Decision**: Use an in-memory LRU cache with 30-minute TTL instead of a database.

**Rationale**:

- Wikidata content changes infrequently (article title mappings are very stable)
- In-memory avoids infrastructure dependencies (no Redis/SQLite needed)
- 500 entries covers a typical translation session of several articles
- 30-minute TTL ensures fresh data for long sessions
- Cache resets on server restart, which is acceptable for this use case
