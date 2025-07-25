import axios from 'axios';
import googleTranslate from '@plainheart/google-translate-api';
import bingTranslate from 'bing-translate-api';

const translateTextUsingService = async (text, fromLanguage, toLanguage, translationService, apiKey) => {
  if (!text || text.trim() === '') {
    return text; // Return empty text as is
  }
  
  try {
    if (translationService === 'google') {
      const response = await googleTranslate(text, { 
        from: fromLanguage, 
        to: toLanguage, 
        apiKey,
        timeout: 10000 // 10 second timeout
      });
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
      }, {
        timeout: 10000 // 10 second timeout
      });
      return response.data.translation;
    } else {
      console.warn(`Unsupported translation service: ${translationService}, using original text`);
      return text; // Return original text instead of throwing
    }
  } catch (error) {
    console.error(`Translation service error (${translationService}):`, error.message);
    // Return original text if translation fails
    return text;
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
  try {
    const translatedTemplates = await Promise.all(
      templates.map(async (template) => {
        try {
          const templateText = template.replace(/\{\{|\}\}/g, '');
          const response = await axios.get(`https://www.wikidata.org/w/api.php`, {
            params: {
              action: 'wbgetentities',
              titles: templateText,
              sites: `${fromLanguage}wiki`,
              props: 'sitelinks',
              format: 'json',
              origin: '*'
            },
            timeout: 5000 // 5 second timeout
          });
          const entities = response.data.entities;
          const entityId = Object.keys(entities)[0];
          const sitelinks = entities[entityId].sitelinks;
          const translatedTemplate = sitelinks && sitelinks[`${toLanguage}wiki`] ? sitelinks[`${toLanguage}wiki`].title : templateText;
          return `{{${translatedTemplate}}}`;
        } catch (error) {
          console.warn(`Failed to translate template: ${template}. Using original.`, error.message);
          return template; // Return the original template if translation fails
        }
      })
    );
    return translatedTemplates;
  } catch (error) {
    console.error('Error in translateTemplates:', error.message);
    return templates; // Return original templates if the whole process fails
  }
};

const translateLinks = async (links, fromLanguage, toLanguage) => {
  try {
    const translatedLinks = await Promise.all(
      links.map(async (link) => {
        try {
          const linkText = link.replace(/\[\[|\]\]/g, '');
          const response = await axios.get(`https://www.wikidata.org/w/api.php`, {
            params: {
              action: 'wbgetentities',
              titles: linkText,
              sites: `${fromLanguage}wiki`,
              props: 'sitelinks',
              format: 'json',
              origin: '*'
            },
            timeout: 5000 // 5 second timeout
          });
          const entities = response.data.entities;
          const entityId = Object.keys(entities)[0];
          const sitelinks = entities[entityId].sitelinks;
          const translatedLink = sitelinks && sitelinks[`${toLanguage}wiki`] ? sitelinks[`${toLanguage}wiki`].title : linkText;
          return `[[${translatedLink}]]`;
        } catch (error) {
          console.warn(`Failed to translate link: ${link}. Using original.`, error.message);
          return link; // Return the original link if translation fails
        }
      })
    );
    return translatedLinks;
  } catch (error) {
    console.error('Error in translateLinks:', error.message);
    return links; // Return original links if the whole process fails
  }
};

export const translate = async (req, res) => {
  const { text, fromLanguage, toLanguage, translationService, apiKey } = req.body;

  try {
    // Extract templates and links
    const { cleanedText, templates, links } = extractTemplatesAndLinks(text);
    
    // Translate templates and links with fallback to originals if they fail
    let translatedTemplates = templates;
    let translatedLinks = links;
    let translatedText = cleanedText;
    
    try {
      translatedTemplates = await translateTemplates(templates, fromLanguage, toLanguage);
    } catch (templateError) {
      console.error('Failed to translate templates:', templateError.message);
      // Continue with original templates
    }
    
    try {
      translatedLinks = await translateLinks(links, fromLanguage, toLanguage);
    } catch (linkError) {
      console.error('Failed to translate links:', linkError.message);
      // Continue with original links
    }
    
    try {
      translatedText = await translateTextUsingService(cleanedText, fromLanguage, toLanguage, translationService, apiKey);
    } catch (textError) {
      console.error('Failed to translate text:', textError.message);
      // If text translation fails, we'll still return the document with translated templates/links if those worked
    }
    
    // Rebuild the text with whatever translations succeeded
    const rebuiltText = rebuildTextWithTemplatesAndLinks(translatedText, translatedTemplates, translatedLinks);
    res.json({ translatedText: rebuiltText });
  } catch (error) {
    console.error('Error during translation process:', error);
    res.status(500).json({ 
      error: 'Error during translation', 
      message: error.message || 'Unknown error',
      suggestion: 'Please try again later or with a different translation service'
    });
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
