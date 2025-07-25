import axios from 'axios';
import googleTranslate from '@plainheart/google-translate-api';
import bingTranslate from 'bing-translate-api';

const translateTextUsingService = async (text, fromLanguage, toLanguage, translationService, apiKey) => {
  if (translationService === 'google') {
    const response = await googleTranslate(text, { from: fromLanguage, to: toLanguage, apiKey });
    return response.text;
  } else if (translationService === 'microsoft') {
    const response = await bingTranslate(text, fromLanguage, toLanguage, true, apiKey);
    return response.translation;
  } else if (translationService === 'mint') {
    const response = await axios.post('https://translate.wmcloud.org/api/translate', {
      content: text,
      source_language: fromLanguage,
      target_language: toLanguage,
      format: 'text'
    });
    return response.data.translation;
  } else {
    throw new Error('Unsupported translation service');
  }
};

const extractTemplatesAndLinks = (text) => {
  const templateRegex = /\{\{[^]*?\}\}/g;
  const linkRegex = /\[\[[^\]]+\]\]/g;
  const templates = [];
  const links = [];
  let match;

  while ((match = templateRegex.exec(text)) !== null) {
    templates.push(match[0]);
  }

  while ((match = linkRegex.exec(text)) !== null) {
    links.push(match[0]);
  }

  const cleanedText = text.replace(templateRegex, (match) => `TEMPLATE_PLACEHOLDER_${templates.indexOf(match)}`)
                          .replace(linkRegex, (match) => `LINK_PLACEHOLDER_${links.indexOf(match)}`);

  return { cleanedText, templates, links };
};

const rebuildTextWithTemplatesAndLinks = (text, templates, links) => {
  let rebuiltText = text;
  rebuiltText = rebuiltText.replace(/TEMPLATE_PLACEHOLDER_(\d+)/g, (match, index) => templates[index]);
  rebuiltText = rebuiltText.replace(/LINK_PLACEHOLDER_(\d+)/g, (match, index) => links[index]);
  return rebuiltText;
};

const translateTemplates = async (templates, fromLanguage, toLanguage) => {
  const translatedTemplates = await Promise.all(
    templates.map(async (template) => {
      const templateText = template.replace(/\{\{|\}\}/g, '');
      const response = await axios.get(`https://www.wikidata.org/w/api.php`, {
        params: {
          action: 'wbgetentities',
          titles: templateText,
          sites: `${fromLanguage}wiki`,
          props: 'sitelinks',
          format: 'json',
          origin: '*'
        }
      });
      const entities = response.data.entities;
      const entityId = Object.keys(entities)[0];
      const sitelinks = entities[entityId].sitelinks;
      const translatedTemplate = sitelinks && sitelinks[`${toLanguage}wiki`] ? sitelinks[`${toLanguage}wiki`].title : templateText;
      return `{{${translatedTemplate}}}`;
    })
  );

  return translatedTemplates;
};

const translateLinks = async (links, fromLanguage, toLanguage) => {
  const translatedLinks = await Promise.all(
    links.map(async (link) => {
      const linkText = link.replace(/\[\[|\]\]/g, '');
      const response = await axios.get(`https://www.wikidata.org/w/api.php`, {
        params: {
          action: 'wbgetentities',
          titles: linkText,
          sites: `${fromLanguage}wiki`,
          props: 'sitelinks',
          format: 'json',
          origin: '*'
        }
      });
      const entities = response.data.entities;
      const entityId = Object.keys(entities)[0];
      const sitelinks = entities[entityId].sitelinks;
      const translatedLink = sitelinks && sitelinks[`${toLanguage}wiki`] ? sitelinks[`${toLanguage}wiki`].title : linkText;
      return `[[${translatedLink}]]`;
    })
  );

  return translatedLinks;
};

export const translate = async (req, res) => {
  const { text, fromLanguage, toLanguage, translationService, apiKey } = req.body;

  const { cleanedText, templates, links } = extractTemplatesAndLinks(text);

  try {
    const translatedTemplates = await translateTemplates(templates, fromLanguage, toLanguage);
    const translatedLinks = await translateLinks(links, fromLanguage, toLanguage);
    // Uncomment the following lines to include text translation service
    // const translatedText = await translateTextUsingService(cleanedText, fromLanguage, toLanguage, translationService, apiKey);
    // const rebuiltText = rebuildTextWithTemplatesAndLinks(translatedText, translatedTemplates, translatedLinks);
    const rebuiltText = rebuildTextWithTemplatesAndLinks(cleanedText, translatedTemplates, translatedLinks);
    res.json({ translatedText: rebuiltText });
  } catch (error) {
    console.error('Error during template and link translation:', error);
    res.status(500).send('Error during translation');
  }
};

export const preview = async (req, res) => {
  const { text, language } = req.body;

  try {
    const response = await axios.get(`https://${language}.wikipedia.org/w/api.php`, {
      params: {
        action: 'parse',
        format: 'json',
        prop: 'text',
        contentmodel: 'wikitext',
        origin: '*',
        text: text,
        uselang: language
      }
    });
    res.json({ html: response.data.parse.text['*'] });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).send('Error generating preview');
  }
};
