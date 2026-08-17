# Wikitext Parser

Reference for the stack-based wikitext parser that segments MediaWiki markup for translation.

## Overview

The parser in `server/services/wikitextParser.js` converts raw wikitext into an array of typed segments. Each segment is classified as either translatable (text, links) or non-translatable (templates, refs, categories, etc.).

## Segment Types

| Type | Description | Translatable? | Example |
|------|-------------|---------------|---------|
| `text` | Plain text content | ✅ Yes | `India is a country` |
| `link` | Wikilink `[[Target\|Display]]` | ✅ Target via Wikidata, display via MT | `[[South Asia]]` |
| `template` | Template `{{Name\|params}}` | ✅ Name via Wikidata, text params via MT | `{{Infobox country\|...}}` |
| `category` | Category link | ❌ Preserved | `[[Category:Countries]]` |
| `file` | File/image link | ❌ Preserved | `[[File:Flag.svg\|thumb]]` |
| `comment` | HTML comment | ❌ Preserved | `<!-- comment -->` |
| `tag` | Protected HTML tags | ❌ Preserved | `<ref>`, `<nowiki>`, `<math>` |
| `ref` | Reference tags | ❌ Preserved | `<ref name="x">...</ref>` |
| `extlink` | External links | ❌ Preserved | `[https://example.com text]` |
| `magic` | Magic words | ❌ Preserved | `__NOTOC__` |

## Parsing Algorithm

The parser operates in three phases:

### Phase 1: Protect Non-Parseable Elements

Simple regex patterns protect elements that shouldn't be parsed for `{{` or `[[`:

1. HTML comments `<!-- -->`
2. Protected tags (`<nowiki>`, `<math>`, `<ref>`, etc.)
3. References (`<ref>...</ref>` and `<ref ... />`)
4. External links `[http://...]`
5. Magic words `__NOTOC__` etc.

Each match is replaced with a null-byte placeholder: `\x00TYPE_N\x00`.

### Phase 2: Stack-Based Element Extraction

A stack-based parser handles `{{templates}}` and `[[wikilinks]]` with arbitrary nesting depth:

```
Input:  {{Infobox|name={{lang|en|India}}|capital=[[New Delhi]]}}

Stack trace:
  pos 0:  {{ push template
  pos 15: {{ push template (nested)
  pos 31: }} pop template → inner template captured
  pos 41: [[ push link
  pos 52: ]] pop link → wikilink captured
  pos 54: }} pop template → outer template captured (includes inner template + link)
```

This correctly handles:

- Templates nested 4-5+ levels deep (common in infoboxes)
- Wikilinks inside template parameters
- Mixed nesting of templates and links

### Phase 3: Segment Assembly

The text remaining after placeholder replacement is split into segments:

```
Original: "{{Infobox}} is in [[Asia]]."
After protection: "\x00TEMPLATE_0\x00 is in \x00LINK_1\x00."
Split: [template_segment, " is in ", link_segment, "."]
```

## Link Classification

Wikilinks are classified based on their namespace prefix:

- **Category**: `[[Category:...]]`, `[[श्रेणी:...]]`, `[[Категория:...]]`, etc.
- **File**: `[[File:...]]`, `[[Image:...]]`, `[[चित्र:...]]`, etc.
- **Regular link**: Anything else → translated via Wikidata

Namespace prefixes are recognized in 15+ languages.

## Template Parameter Extraction

The function `extractTemplateParamTexts()` identifies text-heavy template parameters for translation:

- Only parameters with `name=value` format are considered
- Only values longer than 20 characters with spaces are translated
- Numeric and date values are skipped
- Nested templates within parameters are handled by the stack parser

## Public API

### `parseWikitext(wikitext)`

Parses wikitext into segments.

**Returns:** `Array<Segment>` where each segment has:

- `type` — Segment type (see table above)
- `content` — Original wikitext content
- `placeholder` — The placeholder string used during parsing
- `target` — *(link only)* The link target
- `display` — *(link only)* The pipe-separated display text, or `null`

### `extractLinkTargets(segments)`

Returns an array of wikilink target strings for Wikidata batch lookup.

### `extractTemplateNames(segments)`

Returns an array of template names (without `{{}}`) for Wikidata batch lookup.

### `extractTemplateParamTexts(segments)`

Returns translatable template parameter values.

### `reassembleWikitext(segments, translatedTexts, translatedLinks, translatedTemplates, translatedDisplayTexts, translatedParamTexts, translatedCategories)`

Reconstructs wikitext from translated segments and applies syntactic normalization.

### `normalizeWikitextSyntax(wikitext)`

Post-translation normalizer that automatically detects and repairs:

* Spaced equal signs in headings produced by MT: `= = Heading = =` $\rightarrow$ `== Heading ==`
* Deep subheadings: `= = = Sub = = =` $\rightarrow$ `=== Sub ===`
* Spacing around bullet lists (`*Item` $\rightarrow$ `* Item`)
* Extra whitespace inside wikilinks (`[[ Target | Display ]]` $\rightarrow$ `[[Target|Display]]`)
* Removal of any stray placeholder tokens

### `parseTemplate(templateStr)`

Parses a standalone template string (such as an Infobox or Cite web template) into an object containing:

* `name`: Original template name (e.g. `Infobox person`)
* `params`: Array of `{ name, value, isNamed, raw, index }`
* `isMultiLine`: Boolean indicating if template has newlines

### `reassembleTemplate(parsedTemplate, translatedName, translatedParamValues, translatedParamNames)`

Reassembles a template with a localized template name mapped via Wikidata and translated parameter values while preserving numeric, date, and URL parameters.

