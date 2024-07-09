<template>
    <div class="container mx-auto p-4 bg-white shadow-lg rounded-lg">
      <h1 class="text-2xl font-bold text-gray-800 mb-4 text-center">{{ mainTitle }}</h1>
      <h1 class="text-1xl font-bold text-gray-800 mb-2 text-center">{{ subTitle }}</h1>
  
      <div class="relative mb-4">
        <div v-if="warningMessage" :class="['bg-red-100', 'border', 'border-red-400', 'text-red-700', 'px-4', 'py-3', 'rounded', 'absolute', 'w-full', 'transition-opacity', warningMessage ? 'opacity-100' : 'opacity-0']" role="alert">
          <span class="block sm:inline">{{ warningMessage }}</span>
        </div>
      </div>
  
      <div class="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
        <!-- Left Box -->
        <div class="w-full md:w-1/2 bg-gray-200 p-4 rounded-lg shadow">
          <div class="flex flex-col space-y-2 md:flex-row md:items-center md:space-y-0 md:space-x-2 mb-4">
            <select v-model="fromLanguage" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
              <option v-for="language in languages" :value="language.code">{{ language.name }}</option>
            </select>
            <div class="relative w-full md:w-auto">
              <input v-model="articleInput" @input="fetchSuggestions" :class="{'border-red-500': articleInputError}" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded" placeholder="Article">
              <ul v-if="suggestions.length" class="absolute bg-white border border-gray-300 rounded mt-1 w-full max-h-60 overflow-y-auto">
                <li v-for="suggestion in suggestions" @click="selectSuggestion(suggestion)" class="px-2 py-1 cursor-pointer hover:bg-gray-200">{{ suggestion }}</li>
              </ul>
            </div>
            <button @click="getArticleAction" class="w-full md:w-auto px-4 py-2 bg-blue-500 text-white font-semibold rounded">{{ getArticleButtonText }}</button>
            <select v-model="toLanguage" :class="{'border-red-500': toLanguageError}" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
              <option value="" disabled>To</option>
              <option v-for="language in languages" :value="language.code">{{ language.name }}</option>
            </select>
            <select v-model="translationService" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded md:hidden">
              <option value="mint">Mint Wikimedia</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
            <input v-if="showInputBox" v-model="serviceInput" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded md:hidden" placeholder="Enter API Key">
            <button @click="translateAction" class="w-full md:w-auto px-4 py-2 bg-green-500 text-white font-semibold rounded">{{ translateButtonText }}</button>
          </div>
          <textarea v-model="leftTextarea" :class="{'border-red-500': leftTextareaError}" class="w-full p-4 border border-gray-300 rounded" rows="8" placeholder="Type something..."></textarea>
        </div>
  
        <!-- Right Box -->
        <div class="w-full md:w-1/2 bg-gray-200 p-4 rounded-lg shadow">
          <div class="flex flex-col md:flex-row md:items-center md:space-x-2 mb-4 hidden md:flex">
            <select v-model="translationService" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
              <option value="mint">Mint Wikimedia</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
            </select>
            <input v-if="showInputBox" v-model="serviceInput" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded" placeholder="Enter API Key">
          </div>
          <textarea v-model="rightTextarea" class="w-full p-4 border border-gray-300 rounded" rows="8" placeholder="Translated text will appear here..."></textarea>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        mainTitle: 'Source Translation Tool',
        subTitle: 'Translate the source of an article.',
        getArticleButtonText: 'Get',
        translateButtonText: 'Translate',
        fromLanguage: 'en', // Set default to English
        toLanguage: '',
        articleInput: '',
        leftTextarea: '',
        rightTextarea: '',
        translationService: 'mint', // Set default to Mint
        serviceInput: '',
        languages: [
          { code: 'en', name: 'English' },
          { code: 'or', name: 'Odia' },
          { code: 'ta', name: 'Tamil' },
          { code: 'pa', name: 'Punjabi' },
          { code: 'bn', name: 'Bengali' },
          { code: 'de', name: 'Germany' },
          // Add other languages as needed
        ],
        refs: [],
        links: [],
        suggestions: [],
        articleInputError: false,
        leftTextareaError: false,
        toLanguageError: false,
        warningMessage: ''
      }
    },
    computed: {
      showInputBox() {
        return this.translationService === 'google' || this.translationService === 'microsoft';
      }
    },
    methods: {
      showWarning(message) {
        this.warningMessage = message;
        setTimeout(() => {
          this.warningMessage = '';
        }, 3000);
      },
      async fetchSuggestions() {
        if (this.articleInput.length > 2) {
          const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=opensearch&search=${this.articleInput}&limit=10&namespace=0&format=json&origin=*`;
          try {
            const response = await fetch(url);
            const data = await response.json();
            this.suggestions = data[1];
          } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.suggestions = [];
          }
        } else {
          this.suggestions = [];
        }
      },
      selectSuggestion(suggestion) {
        this.articleInput = suggestion;
        this.suggestions = [];
      },
      async getArticleAction() {
        if (!this.articleInput) {
          this.articleInputError = true;
          this.showWarning('Please enter an article name.');
          return;
        }
        this.articleInputError = false;
        if (this.articleInput && this.fromLanguage) {
          const articleName = this.articleInput;
          const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=parse&page=${articleName}&prop=wikitext&format=json&origin=*`;
  
          try {
            const response = await fetch(url);
            const data = await response.json();
            const wikitext = data.parse.wikitext['*'];
  
            if (wikitext) {
              this.leftTextarea = wikitext;
            } else {
              this.leftTextarea = 'Article not found.';
            }
          } catch (error) {
            console.error('Error fetching article:', error);
            this.leftTextarea = 'Error fetching article.';
          }
        }
      },
      async translateAction() {
        if (!this.leftTextarea) {
          this.leftTextareaError = true;
          this.showWarning('Left textarea is empty. Please fetch an article or paste source code first.');
          return;
        } else {
          this.leftTextareaError = false;
        }
  
        if (!this.toLanguage) {
          this.toLanguageError = true;
          this.showWarning('Please select a language to translate to.');
          return;
        } else {
          this.toLanguageError = false;
        }
  
        if (this.leftTextarea && this.toLanguage) {
          // Extract and translate links
          const { nonLinkText, links } = this.extractLinks(this.leftTextarea);
          this.links = links;
  
          // Translate the full links using Wikidata
          const fullLinkTranslations = await this.translateFullLinks(links.map(link => link.fullLink), this.fromLanguage, this.toLanguage);
  
          let textWithTranslatedLinks = nonLinkText;
          links.forEach((link, index) => {
            const translatedFullLink = fullLinkTranslations[link.fullLink] || link.fullLink;
            const linkPlaceholder = `LINK_PLACEHOLDER_${index}`;
            textWithTranslatedLinks = textWithTranslatedLinks.replace(linkPlaceholder, link.hasPipe ? `[[${translatedFullLink}|${link.afterPipe}]]` : `[[${translatedFullLink}]]`);
          });
  
          this.rightTextarea = textWithTranslatedLinks;
        }
      },
      extractLinks(wikitext) {
        const regex = /\[\[(.*?)(\|.*?)?\]\]/g;
        const links = [];
        let match;
        let nonLinkText = wikitext;
        while ((match = regex.exec(wikitext)) !== null) {
          const parts = match[1].split('|');
          const fullLink = parts[0];
          const hasPipe = parts.length > 1;
          const afterPipe = hasPipe ? parts.slice(1).join('|') : '';
          links.push({ fullLink, afterPipe, hasPipe });
          nonLinkText = nonLinkText.replace(match[0], `LINK_PLACEHOLDER_${links.length - 1}`);
        }
        return { nonLinkText, links };
      },
      async bulkTranslateText(text, sourceLang, targetLang) {
        const chunks = this.chunkString(text, 3000);
        const translations = await Promise.all(chunks.map(chunk => this.translateText(chunk, sourceLang, targetLang)));
        return translations.join(' ');
      },
      chunkString(str, length) {
        const regex = new RegExp(`.{1,${length}}`, 'g');
        return str.match(regex) || [];
      },
      async translateText(text, sourceLang, targetLang) {
        try {
          const response = await fetch('https://translate.wmcloud.org/api/translate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: text,
              source_language: sourceLang,
              target_language: targetLang,
              format: 'text'
            })
          });
  
          if (!response.ok) {
            console.error('Error response from translation service:', response.statusText);
            return null;
          }
  
          const data = await response.json();
          return data.translation;
        } catch (error) {
          console.error('Error translating text:', error);
          return null;
        }
      },
      async translateFullLinks(fullLinks, fromLang, toLang) {
        const validFullLinks = fullLinks.filter(link => !link.startsWith('File:'));
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=${fromLang}wiki&titles=${validFullLinks.join('|')}&props=sitelinks&format=json&origin=*`;
  
        const translations = {};
        try {
          const response = await fetch(url);
          const data = await response.json();
          const entities = data.entities;
  
          for (const entity of Object.values(entities)) {
            if (entity.sitelinks && entity.sitelinks[`${toLang}wiki`]) {
              const originalTitle = entity.sitelinks[`${fromLang}wiki`].title;
              const translatedTitle = entity.sitelinks[`${toLang}wiki`].title;
              translations[originalTitle] = translatedTitle;
            } else {
              translations[entity.title] = entity.title; // Use original if no translation found
            }
          }
        } catch (error) {
          console.error('Error fetching translations:', error);
        }
  
        // Add the skipped File: links back with their original titles
        fullLinks.forEach(link => {
          if (link.startsWith('File:')) {
            translations[link] = link;
          }
        });
  
        return translations;
      },
      escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
  }
  </script>
  
  <style scoped>
  .transition-opacity {
    transition: opacity 0.5s ease-in-out;
  }
  </style>
  