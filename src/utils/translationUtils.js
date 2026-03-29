import axios from 'axios';

export const extractTemplates = (wikitext) => {
  const regex = /\{\{(.*?)\}\}/g;
  const templates = [];
  let match;
  let nonTemplateText = wikitext;
  while ((match = regex.exec(wikitext)) !== null) {
    const fullTemplate = match[0];
    templates.push(fullTemplate);
    nonTemplateText = nonTemplateText.replace(fullTemplate, `TEMPLATE_PLACEHOLDER_${templates.length - 1}`);
  }
  return { nonTemplateText, templates };
};

export const extractLinks = (wikitext) => {
  const regex = /\[\[(.*?)(\|.*?)?\]\]/g;
  const links = [];
  let match;
  let nonLinkText = wikitext;
  while ((match = regex.exec(wikitext)) !== null) {
    const parts = match[1].split('|');
    const fullLink = parts[0];
    const hasPipe = parts.length > 1;
    const afterPipe = hasPipe ? parts.slice(1).join('|') : '';
    links.push(fullLink);
    nonLinkText = nonLinkText.replace(match[0], `LINK_PLACEHOLDER_${links.length - 1}`);
  }
  return { nonLinkText, links };
};

export const translateNamesInChunks = async (names, fromLanguage, toLanguage) => {
  const translatedNames = {};
  const chunkSize = 10;

  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    const chunkTranslations = await translateNames(chunk, fromLanguage, toLanguage);
    Object.assign(translatedNames, chunkTranslations);
  }

  return translatedNames;
};

export const translateNames = async (names, fromLanguage, toLanguage) => {
  const translatedNames = {};

  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=${fromLanguage}wiki&titles=${names.join('|')}&props=sitelinks&format=json&origin=*`;
  try {
    const response = await axios.get(url);
    const entities = response.data.entities;

    names.forEach(name => {
      const entity = Object.values(entities).find(e => e.sitelinks && e.sitelinks[`${fromLanguage}wiki`] && e.sitelinks[`${fromLanguage}wiki`].title === name);
      const translatedName = entity && entity.sitelinks && entity.sitelinks[`${toLanguage}wiki`] ? entity.sitelinks[`${toLanguage}wiki`].title : name;
      translatedNames[name] = translatedName;
    });
  } catch (error) {
    console.error('Error translating names in batch:', error);
  }

  return translatedNames;
};

export const rebuildWikitext = (nonText, translatedParts, placeholder) => {
  let wikitext = nonText;
  translatedParts.forEach((part, index) => {
    wikitext = wikitext.replace(`${placeholder}_${index}`, part);
  });
  return wikitext;
};

export const translateTextInChunks = async (text, fromLanguage, toLanguage, translateFunction) => {
  const chunkSize = 5000;
  const chunks = chunkString(text, chunkSize);
  const translatedChunks = await Promise.all(chunks.map(chunk => translateFunction(chunk, { from: fromLanguage, to: toLanguage })));
  return translatedChunks.map(result => result.translation);
};

export const chunkString = (str, length) => {
  return str.match(new RegExp(`.{1,${length}}`, 'g'));
};
