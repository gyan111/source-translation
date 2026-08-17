# How to Translate Wikipedia Templates

This guide explains how to translate standalone Wikipedia templates (such as Infoboxes, `{{Cite web}}`, and `{{Taxobox}}`) using the dedicated **Template Mode**.

---

## 1. When to Use Template Mode

While the Article Translation mode translates templates within full article paragraphs, **Template Mode** is designed for:

* Translating an individual template independently (e.g. `Infobox person`, `Cite book`, `Geobox`).
* Inspecting how parameter values and Wikidata template names are mapped.
* Re-using translated template code across multiple articles.

---

## 2. Step-by-Step Translation

1. In the top navigation bar, select the **Template Mode** tab.
2. Select your **Source Language** (e.g. `en`) and **Target Language** (e.g. `hi`, `pa`, `or`).
3. Paste your template or load a 1-click sample:
   - **Infobox Person**: Standard biographical infobox.
   - **Cite Web**: Web citation template.
   - **Taxobox**: Biological classification infobox.
4. Click **Translate Template**.
5. The pipeline:
   - Queries Wikidata sitelinks to map the template name to the target wiki equivalent (e.g. `Infobox person` $\rightarrow$ `व्यक्ति की जानकारी` or `ਸੂਚਨਾਡੱਬਾ ਵਿਅਕਤੀ`).
   - Translates text parameter values while preserving numbers, dates, and URLs.
6. Click **Copy** to copy the reassembled template to your clipboard.
