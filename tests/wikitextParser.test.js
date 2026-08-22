import { describe, it, expect } from 'vitest';
import {
  parseWikitext,
  extractLinkTargets,
  extractCategoryTargets,
  extractTemplateNames,
  extractTemplateParamTexts,
  reassembleWikitext,
  normalizeWikitextSyntax,
  parseTemplate,
  reassembleTemplate,
  isTranslatableParamValue,
} from '../server/services/wikitextParser.js';
import { normalizeToAsciiDigits } from '../server/services/numeralConverter.js';

describe('wikitextParser', () => {
  describe('parseWikitext', () => {
    it('parses plain text into a single text segment', () => {
      const text = 'Hello world, this is an article.';
      const segments = parseWikitext(text);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({ type: 'text', content: text });
    });

    it('extracts simple and piped wikilinks', () => {
      const text = 'Albert Einstein was born in [[Ulm]] and developed [[theory of relativity|relativity]].';
      const segments = parseWikitext(text);
      
      const linkSegs = segments.filter(s => s.type === 'link');
      expect(linkSegs).toHaveLength(2);
      expect(linkSegs[0].target).toBe('Ulm');
      expect(linkSegs[0].display).toBeNull();
      expect(linkSegs[1].target).toBe('theory of relativity');
      expect(linkSegs[1].display).toBe('relativity');
    });

    it('extracts categories with various language prefixes', () => {
      const text = 'Some content.\n[[Category:Physicists]]\n[[Category:1879 births]]';
      const segments = parseWikitext(text);
      
      const categories = extractCategoryTargets(segments);
      expect(categories).toContain('Category:Physicists');
      expect(categories).toContain('Category:1879 births');
    });

    it('extracts templates and handles nested templates', () => {
      const text = '{{Infobox person | name = Einstein | award = {{Nobel prize}} }}';
      const segments = parseWikitext(text);
      
      const templates = segments.filter(s => s.type === 'template');
      expect(templates.length).toBeGreaterThanOrEqual(1);
      expect(templates[0].content).toContain('Infobox person');
    });

    it('protects <ref> tags from translation splitting', () => {
      const text = 'Light travels fast.<ref name="speed">Speed of light is 300,000 km/s</ref> It is universal.';
      const segments = parseWikitext(text);
      
      const refSegs = segments.filter(s => s.type === 'ref');
      expect(refSegs).toHaveLength(1);
      expect(refSegs[0].content).toBe('<ref name="speed">Speed of light is 300,000 km/s</ref>');
    });
  });

  describe('extractTemplateParamTexts', () => {
    it('extracts long prose parameters from templates', () => {
      const segments = parseWikitext('{{Cite book | title = The Theory of Relativity | abstract = A comprehensive overview of modern physics and spacetime geometry. }}');
      const paramTexts = extractTemplateParamTexts(segments);
      
      expect(paramTexts.length).toBeGreaterThan(0);
      expect(paramTexts.some(p => p.text.includes('comprehensive overview'))).toBe(true);
    });
  });

  describe('reassembleWikitext', () => {
    it('reassembles translated text, wikilinks, and templates correctly', () => {
      const source = 'Hello [[World]]. {{Greeting | msg = welcome}}';
      const segments = parseWikitext(source);

      const translatedTexts = { 'Hello ': 'Bonjour ' };
      const translatedLinks = { 'World': 'Monde' };
      const translatedTemplates = { 'Greeting': 'Salutation' };
      const translatedDisplayTexts = { 'World': 'Monde' };

      const result = reassembleWikitext(
        segments,
        translatedTexts,
        translatedLinks,
        translatedTemplates,
        translatedDisplayTexts
      );

      expect(result).toBe('Bonjour [[Monde]]. {{Salutation | msg = welcome}}');
    });

    it('translates headings and formats them on their own lines', () => {
      const source = '== Geography ==\nSome description here.';
      const segments = parseWikitext(source);

      const headingSeg = segments.find(s => s.type === 'heading');
      expect(headingSeg).toBeDefined();
      expect(headingSeg.text).toBe('Geography');
      expect(headingSeg.level).toBe(2);

      const result = reassembleWikitext(
        segments,
        { 'Geography': 'ଭୂଗୋଳ', 'Some description here.': 'କିଛି ବର୍ଣ୍ଣନା ଏଠାରେ।' },
        {},
        {},
        {}
      );

      expect(result).toContain('== ଭୂଗୋଳ ==');
      expect(result).toContain('କିଛି ବର୍ଣ୍ଣନା ଏଠାରେ।');
    });

    it('applies pipe trick to wikilinks with disambiguation brackets automatically', () => {
      const source = 'Starred in [[Dhee (film)]] and [[Titanic (1997 film)]].';
      const segments = parseWikitext(source);

      const result = reassembleWikitext(
        segments,
        {},
        {},
        {},
        {}
      );

      expect(result).toBe('Starred in [[Dhee (film)|Dhee]] and [[Titanic (1997 film)|Titanic]].');
    });

    it('reassembles translated categories correctly', () => {
      const source = 'Text [[Category:Physicists]]';
      const segments = parseWikitext(source);

      const translatedTexts = { 'Text ': 'Texte ' };
      const translatedCategories = { 'Category:Physicists': 'Catégorie:Physicien' };

      const result = reassembleWikitext(
        segments,
        translatedTexts,
        {},
        {},
        {},
        {},
        translatedCategories
      );

      expect(result).toBe('Texte [[Catégorie:Physicien]]');
    });
  });

  describe('parseTemplate & reassembleTemplate', () => {
    it('parses single-line templates correctly', () => {
      const tpl = '{{Cite web | url = https://example.com | title = Example Page | author = John Doe }}';
      const parsed = parseTemplate(tpl);

      expect(parsed.name).toBe('Cite web');
      expect(parsed.isMultiLine).toBe(false);
      expect(parsed.params).toHaveLength(3);
      expect(parsed.params[0].name).toBe('url');
      expect(parsed.params[0].value).toBe('https://example.com');
      expect(parsed.params[1].name).toBe('title');
      expect(parsed.params[1].value).toBe('Example Page');
    });

    it('parses multi-line templates correctly', () => {
      const tpl = `{{Infobox person
| name = Albert Einstein
| birth_date = 14 March 1879
| fields = Physics
}}`;
      const parsed = parseTemplate(tpl);

      expect(parsed.name).toBe('Infobox person');
      expect(parsed.isMultiLine).toBe(true);
      expect(parsed.params).toHaveLength(3);
      expect(parsed.params[0].name).toBe('name');
      expect(parsed.params[0].value).toBe('Albert Einstein');
    });

    it('reassembles template with translated values and template name', () => {
      const tpl = `{{Infobox person
| name = Albert Einstein
| fields = Physics
}}`;
      const parsed = parseTemplate(tpl);
      const translated = reassembleTemplate(
        parsed,
        'Infobox Scientifique',
        { 'Physics': 'Physique', 'Albert Einstein': 'Albert Einstein' }
      );

      expect(translated).toContain('{{Infobox Scientifique');
      expect(translated).toContain('| fields = Physique');
      expect(translated).toContain('| name = Albert Einstein');
    });
  });

  describe('normalizeWikitextSyntax & nested placeholder preservation', () => {
    it('normalizes headings with spaces from machine translation', () => {
      const brokenHeadings = '= = Location = =\nSome text.\n= = = History = = =\nMore text.\n= = = = Sub = = = =';
      const normalized = normalizeWikitextSyntax(brokenHeadings);

      expect(normalized).toContain('== Location ==');
      expect(normalized).toContain('=== History ===');
      expect(normalized).toContain('==== Sub ====');
      expect(normalized).not.toContain('= = Location = =');
    });

    it('preserves HTML comments nested inside template bodies without placeholder leakage', () => {
      const source = '{{Infobox settlement <!-- auto-generated --> | name = Kalabuda | type = Village }}';
      const segments = parseWikitext(source);
      
      const tplSeg = segments.find(s => s.type === 'template');
      expect(tplSeg).toBeDefined();
      expect(tplSeg.content).toContain('<!-- auto-generated -->');
      expect(tplSeg.content).not.toContain('\x00COMMENT_');

      const reassembled = reassembleWikitext(segments, {}, {}, {}, {});
      expect(reassembled).toContain('<!-- auto-generated -->');
      expect(reassembled).not.toContain('COMMENT_0');
    });

    it('cleans up list item formatting and wikilink spaces', () => {
      const text = '*Item 1\n*Item 2\n[[ Target | Display ]]';
      const normalized = normalizeWikitextSyntax(text);

      expect(normalized).toContain('* Item 1');
      expect(normalized).toContain('* Item 2');
      expect(normalized).toContain('[[Target|Display]]');
    });

    it('fixes missing spacing between prose words and wikilinks across languages', () => {
      const frenchText = 'Il est connu comme le[[Père de la Nation]]en Inde.';
      const punjabiText = 'ਇਹ ਪਿੰਡ[[ਕਟକ]]ਸ਼ਹਿਰ ਦੇ ਨੇੜੇ ਹੈ।';
      
      const normFr = normalizeWikitextSyntax(frenchText);
      const normPa = normalizeWikitextSyntax(punjabiText);

      expect(normFr).toBe('Il est connu comme le [[Père de la Nation]] en Inde.');
      expect(normPa).toBe('ਇਹ ਪਿੰਡ [[ਕਟକ]] ਸ਼ਹਿਰ ਦੇ ਨੇੜੇ ਹੈ।');
    });

    it('protects image filenames and media parameters from translation', () => {
      const wikitext = `{{Infobox person
| name = Mahatma Gandhi
| image = Mahatma-Gandhi, studio, 1931.jpg
| signature = Gandhi signature.svg
| birth_place = [[Porbandar]], [[Kathiawar Agency]]
}}`;
      const segments = parseWikitext(wikitext);
      const paramTexts = extractTemplateParamTexts(segments);

      const translatableParams = paramTexts.map(p => p.paramName);
      expect(translatableParams).toContain('name');
      expect(translatableParams).toContain('birth_place');
      expect(translatableParams).not.toContain('image');
      expect(translatableParams).not.toContain('signature');
    });

    it('handles missing link strategies: translate (red link), ill, and plain text', () => {
      const text = 'Born in [[Porbandar State]].';
      const segments = parseWikitext(text);
      const translatedTexts = { 'Born in ': 'Né dans ' };
      const translatedDisplayTexts = { 'Porbandar State': 'État de Porbandar' };
      const unresolvedTranslatedTargets = { 'Porbandar State': 'État de Porbandar' };

      // Strategy 1: 'translate' (Native Red Link)
      const redlinkRes = reassembleWikitext(
        segments,
        translatedTexts,
        {}, // No Wikidata sitelink
        {},
        translatedDisplayTexts,
        {},
        {},
        { missingLinkStrategy: 'translate', fromLang: 'en', toLang: 'fr', unresolvedTranslatedTargets }
      );
      expect(redlinkRes).toBe('Né dans [[État de Porbandar]].');

      // Strategy 2: 'ill' (Interlanguage template)
      const illRes = reassembleWikitext(
        segments,
        translatedTexts,
        {},
        {},
        translatedDisplayTexts,
        {},
        {},
        { missingLinkStrategy: 'ill', fromLang: 'en', toLang: 'fr', unresolvedTranslatedTargets }
      );
      expect(illRes).toBe('Né dans {{Lien|trad=Porbandar State|titre=État de Porbandar|lang=en}}.');

      // Strategy 3: 'plain' (Plain unlinked text)
      const plainRes = reassembleWikitext(
        segments,
        translatedTexts,
        {},
        {},
        translatedDisplayTexts,
        {},
        {},
        { missingLinkStrategy: 'plain', fromLang: 'en', toLang: 'fr', unresolvedTranslatedTargets }
      );
      expect(plainRes).toBe('Né dans État de Porbandar.');
    });

    it('localizes category namespace prefix across target languages', () => {
      const text = '[[Category:Indian activists]]';
      const segments = parseWikitext(text);
      const unresolvedTranslatedTargets = { 'Indian activists': 'Militants indiens' };

      const frRes = reassembleWikitext(
        segments,
        {},
        {},
        {},
        {},
        {},
        {},
        { toLang: 'fr', unresolvedTranslatedTargets }
      );
      expect(frRes).toBe('[[Catégorie:Militants indiens]]');
    });

    it('normalizes MT coordinate errors, interwiki links, and political terms', () => {
      const brokenCoord = 'Kendrapara est situé à {{Coord|20h50|N|86.42|E}}.';
      const brokenInterwiki = '[[:ou:ଗର୍ତ୍ତେଶ୍ବର ମହାଦେବ|Temple Garteswar]]';
      const brokenParty = 'Membres de la Fête Janata et Fête Bharatiya Janata.';

      expect(normalizeWikitextSyntax(brokenCoord)).toContain('{{Coord|20.50|N|86.42|E}}');
      expect(normalizeWikitextSyntax(brokenInterwiki)).toBe('[[:or:ଗର୍ତ୍ତେଶ୍ବର ମହାଦେବ|Temple Garteswar]]');
      expect(normalizeWikitextSyntax(brokenParty)).toContain('Parti Janata');
      expect(normalizeWikitextSyntax(brokenParty)).toContain('Parti Bharatiya Janata');
    });

    it('maps English template parameter aliases to target language in reassembleTemplate', () => {
      const tpl = `{{Infobox settlement
| name = Kendrapara
| settlement_type = City
| subdivision_name = India
| population_total = 41404
| elevation_m = 13
}}`;
      const parsed = parseTemplate(tpl);
      const reassembled = reassembleTemplate(
        parsed,
        'Infobox Localité',
        { 'City': 'Ville', 'India': 'Inde' },
        {},
        'fr'
      );

      expect(reassembled).toContain('{{Infobox Localité');
      expect(reassembled).toContain('| nom = Kendrapara');
      expect(reassembled).toContain('| statut = Ville');
      expect(reassembled).toContain('| pays = Inde');
      expect(reassembled).toContain('| population = 41404');
      expect(reassembled).toContain('| altitude = 13');
    });

    describe('isTranslatableParamValue', () => {
      it('protects coordinates, ISO language codes, directions, numbers, and comments', () => {
        expect(isTranslatableParamValue('or', 'native_name_lang')).toBe(false);
        expect(isTranslatableParamValue('20.50', 'latd')).toBe(false);
        expect(isTranslatableParamValue('86.42', 'longd')).toBe(false);
        expect(isTranslatableParamValue('N', 'latNS')).toBe(false);
        expect(isTranslatableParamValue('E', 'longEW')).toBe(false);
        expect(isTranslatableParamValue('<!-- Established -->', 'established_title')).toBe(false);
        expect(isTranslatableParamValue('୧୩', 'elevation_m')).toBe(false);
        expect(isTranslatableParamValue('+୫:୩୦', 'utc_offset1')).toBe(false);
        expect(isTranslatableParamValue('୯୧-୬୭୨୭', 'area_code')).toBe(false);
        expect(isTranslatableParamValue('inline,title', 'coordinates_display')).toBe(false);
        expect(isTranslatableParamValue('auto', 'population_density_km2')).toBe(false);
      });

      it('identifies genuine translatable textual fields', () => {
        expect(isTranslatableParamValue('ସହର', 'settlement_type')).toBe(true);
        expect(isTranslatableParamValue('କେନ୍ଦ୍ରାପଡ଼ା', 'name')).toBe(true);
        expect(isTranslatableParamValue('୧୦ ମାର୍ଚ୍ଚ ୧୮୬୯', 'established_date')).toBe(true);
        expect(isTranslatableParamValue('ଭାଷା', 'demographics_type1')).toBe(true);
      });
    });

    describe('numeralConverter', () => {
      it('converts Indic and Arabic digits to ASCII digits seamlessly', () => {
        // Odia numerals
        expect(normalizeToAsciiDigits('୧୩')).toBe('13');
        expect(normalizeToAsciiDigits('୨୦୦୧')).toBe('2001');
        expect(normalizeToAsciiDigits('+୫:୩୦')).toBe('+5:30');
        expect(normalizeToAsciiDigits('୯୧-୬୭୨୭')).toBe('91-6727');
        expect(normalizeToAsciiDigits('୧୦ ମାର୍ଚ୍ଚ ୧୮୬୯')).toBe('10 ମାର୍ଚ୍ଚ 1869');

        // Devanagari (Hindi) numerals
        expect(normalizeToAsciiDigits('२००१')).toBe('2001');
        expect(normalizeToAsciiDigits('१३')).toBe('13');

        // Gurmukhi (Punjabi) numerals
        expect(normalizeToAsciiDigits('੨੦੦੧')).toBe('2001');
        expect(normalizeToAsciiDigits('੧੩')).toBe('13');

        // Bengali numerals
        expect(normalizeToAsciiDigits('২০০১')).toBe('2001');
      });
    });
  });
});




