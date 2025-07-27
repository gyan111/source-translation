<template>
  <div class="container min-h-[100vh] mx-auto p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 shadow-xl rounded-lg transition-all duration-300">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">{{ mainTitle }}</h1>
    <h1 class="text-1xl font-bold text-gray-700 dark:text-gray-200 mb-2 text-center">{{ subTitle }}</h1>

    <WarningMessage :message="warningMessage" class="block mb-4"/>

    <div class="w-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-4 rounded-lg shadow-md mb-4 border border-gray-200 dark:border-gray-700">
      <div class="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:space-x-2">
        <select v-model="fromLanguage" class="w-full md:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200">
          <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.name }}</option>
        </select>
        <TextInput v-model:inputValue="articleInput" :inputError="articleInputError" :suggestions="suggestions" @fetch-suggestions="fetchSuggestions" @select-suggestion="selectSuggestion" />
        <Button :buttonText="getArticleButtonText" :action="getArticleAction" customClass="bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg rounded-lg" />
        <select v-model="toLanguage" class="w-full md:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200">
          <option value="" disabled>To</option>
          <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.name }}</option>
        </select>
        <select v-model="translationService" class="w-full md:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200">
          <option value="mint">Mint Wikimedia</option>
          <option value="google">Google</option>
          <option value="microsoft">Microsoft</option>
        </select>
        <input v-if="showInputBox" v-model="serviceInput" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="API Key">
        <Button buttonText="Preview" :action="previewAction" customClass="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg rounded-lg" />
      </div>
    </div>

    <div class="flex flex-col space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-1">
          <h3 class="text-lg font-semibold mb-2 text-center text-gray-800 dark:text-gray-200">Source</h3>
        </div>
        <div class="col-span-1">
          <h3 class="text-lg font-semibold mb-2 text-center text-gray-800 dark:text-gray-200">Translation</h3>
        </div>
        
        <template v-if="leftTextarea">
          <template v-for="(sourcePara, index) in getFormattedParagraphs(leftTextarea)" :key="index">
            <div class="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[100px] max-h-[300px] overflow-y-auto transition-all duration-200 hover:shadow-lg relative">
              <div class="absolute top-2 right-2">
                <Button buttonText="Translate" :action="() => translateParagraph(index)" customClass="bg-gradient-to-r from-teal-500 to-green-400 hover:from-teal-600 hover:to-green-500 text-white text-xs py-1 px-2 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg rounded-lg" />
              </div>
              <div v-html="sourcePara" class="paragraph-content dark:text-gray-200"></div>
              <div class="flex justify-end items-center mt-2">
                <div class="text-xs text-gray-500 dark:text-gray-400 text-right">para{{index + 1}}</div>
              </div>
            </div>
            
            <div class="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[100px] max-h-[300px] overflow-y-auto transition-all duration-200 hover:shadow-lg glassmorphic" :class="{ 'translated': index < translatedParagraphs.length }">
              <div v-html="index < translatedParagraphs.length ? translatedParagraphs[index] : ''" class="paragraph-content dark:text-gray-200"></div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">translated{{index + 1}}</div>
            </div>
          </template>
        </template>
        <template v-else>
          <div class="col-span-1">
            <TextArea :textareaValue="leftTextarea" :textareaError="leftTextareaError" :isDisplayMode="true" areaType="source" />
          </div>
          <div class="col-span-1">
            <TextArea :textareaValue="rightTextarea" :isDisplayMode="true" areaType="translated" />
          </div>
        </template>
      </div>
    </div>

    <ProgressBar :showProgressBar="showProgressBar" :progressBarWidth="progressBarWidth" />
    <PreviewModal :showPreview="showPreview" :previewLoading="previewLoading" :previewHtml="previewHtml" :articleName="articleInput" :language="toLanguage" @close-preview="closePreview" />
  </div>
</template>

<script>
import WarningMessage from './WarningMessage.vue';
import TextInput from './TextInput.vue';
import Button from './Button.vue';
import TextArea from './TextArea.vue';
import ProgressBar from './ProgressBar.vue';
import PreviewModal from './PreviewModal.vue';
import axios from 'axios';
import debounce from 'lodash/debounce';

export default {
  components: {
    WarningMessage,
    TextInput,
    Button,
    TextArea,
    ProgressBar,
    PreviewModal
  },
  data() {
    return {
      mainTitle: 'Source Translation Tool',
      subTitle: 'Translate only wiki markup templates and links, preserving regular text.',
      getArticleButtonText: 'Get',
      translateButtonText: 'Translate',
      fromLanguage: 'en',  // Default to English
      toLanguage: '',      // Default to blank, requiring user to select a language
      articleInput: '',
      leftTextarea: '',
      rightTextarea: '',
      translationService: 'mint',  // Default to Mint Wikimedia
      serviceInput: '',
      languages: [
        { code: 'en', name: 'English' },
        { code: 'bn', name: 'Bengali' },
        { code: 'fr', name: 'French' },
        { code: 'hi', name: 'Hindi' },
        { code: 'or', name: 'Odia' },
        { code: 'pa', name: 'Punjabi' },
        { code: 'ta', name: 'Tamil' },
      ],
      suggestions: [], // Initialize suggestions array
      articleInputError: false,
      leftTextareaError: false,
      toLanguageError: false,
      warningMessage: '',
      showProgressBar: false,
      progressBarWidth: 0,
      showPreview: false,
      previewHtml: '',
      previewLoading: false,
      translatedParagraphs: [], // Array to store translated paragraphs
    };
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
    getFormattedParagraphs(text) {
      if (!text) return [];
      
      // Split the text by double newlines to get paragraphs
      const paragraphs = text.split(/\n\n+/);
      
      return paragraphs.map(paragraph => {
        // Replace single newlines with <br> for line breaks within paragraphs
        return paragraph.replace(/\n/g, '<br>');
      });
    },
    fetchSuggestions: debounce(function() {
      if (this.articleInput.length > 2) {
        const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=opensearch&search=${this.articleInput}&limit=10&namespace=0&format=json&origin=*`;
        fetch(url)
          .then(response => response.json())
          .then(data => {
            this.suggestions = data[1];
          })
          .catch(error => {
            console.error('Error fetching suggestions:', error);
            this.suggestions = [];
          });
      } else {
        this.suggestions = [];
      }
    }, 300),
    selectSuggestion(suggestion) {
      this.articleInput = suggestion;
      this.suggestions = [];
    },
    getArticleAction() {
      if (!this.articleInput) {
        this.articleInputError = true;
        this.showWarning('Please enter an article name.');
        return;
      }
      this.articleInputError = false;
      if (this.articleInput && this.fromLanguage) {
        const articleName = this.articleInput;
        const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=parse&page=${articleName}&prop=wikitext&format=json&origin=*`;

        fetch(url)
          .then(response => response.json())
          .then(data => {
            const wikitext = data.parse.wikitext['*'];
            if (wikitext) {
              this.leftTextarea = wikitext;
            } else {
              this.leftTextarea = 'Article not found.';
            }
          })
          .catch(error => {
            console.error('Error fetching article:', error);
            this.leftTextarea = 'Error fetching article.';
          });
      }
    },
    async translateAction() {
      if (!this.leftTextarea) {
        this.leftTextareaError = true;
        this.showWarning('Left box is empty. Please fetch an article or paste source code first.');
        return;
      } else {
        this.leftTextareaError = false;
      }
      
      // Call translateAllParagraphs when the translate action is triggered
      await this.translateAllParagraphs();
    },
    async translateAllParagraphs() {
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showWarning('Please select a language to translate to.');
        return;
      } else {
        this.toLanguageError = false;
      }

      const rawParagraphs = this.leftTextarea.split(/\n\n+/);
      this.showProgressBar = true;
      this.progressBarWidth = 0;
      this.translatedParagraphs = []; // Reset translated paragraphs

      try {
        // Translate each paragraph sequentially
        for (let i = 0; i < rawParagraphs.length; i++) {
          const paragraphToTranslate = rawParagraphs[i];
          
          // Update progress bar
          this.progressBarWidth = ((i + 1) / rawParagraphs.length) * 100;
          
          const response = await axios.post('/translate', {
            text: paragraphToTranslate,
            fromLanguage: this.fromLanguage,
            toLanguage: this.toLanguage,
            translationService: this.translationService,
            apiKey: this.serviceInput
          });
          
          // Format the translated text with <br> for line breaks
          const translatedParagraph = response.data.translatedText.replace(/\n/g, '<br>');
          this.translatedParagraphs.push(translatedParagraph);
        }
        
        // Update the rightTextarea with all translated paragraphs joined
        this.rightTextarea = this.translatedParagraphs.join('\n\n');
      } catch (error) {
        console.error('Error during translation:', error);
        this.showWarning('Error during translation.');
      } finally {
        this.showProgressBar = false;
      }
    },
    async translateParagraph(index) {
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showWarning('Please select a language to translate to.');
        return;
      } else {
        this.toLanguageError = false;
      }

      const paragraphs = this.getFormattedParagraphs(this.leftTextarea);
      if (index >= paragraphs.length) {
        this.showWarning('Invalid paragraph index.');
        return;
      }

      // Get the raw paragraph text (without HTML formatting)
      const rawParagraphs = this.leftTextarea.split(/\n\n+/);
      const paragraphToTranslate = rawParagraphs[index];

      this.showProgressBar = true;
      this.progressBarWidth = 0;

      try {
        const response = await axios.post('/translate', {
          text: paragraphToTranslate,
          fromLanguage: this.fromLanguage,
          toLanguage: this.toLanguage,
          translationService: this.translationService,
          apiKey: this.serviceInput // Include API Key if needed
        });

        // Create a copy of the current translatedParagraphs array
        const updatedTranslatedParagraphs = [...this.translatedParagraphs];
        
        // Update the translated paragraph at the specified index
        // Format the translated text with <br> for line breaks
        updatedTranslatedParagraphs[index] = response.data.translatedText.replace(/\n/g, '<br>');
        
        // Update the translatedParagraphs array
        this.translatedParagraphs = updatedTranslatedParagraphs;
        
        // Update the rightTextarea with all translated paragraphs joined
        this.rightTextarea = updatedTranslatedParagraphs.join('\n\n');
    
      } catch (error) {
        console.error('Error during translation:', error);
        this.showWarning('Error during translation.');
      } finally {
        this.showProgressBar = false;
      }
    },
    previewAction() {
      if (!this.rightTextarea) {
        this.showWarning('Right box is empty. Please translate the article first.');
        return;
      }

      this.previewLoading = true;
      this.showPreview = true;

      axios.post('/preview', {
        text: this.rightTextarea,
        language: this.toLanguage
      })
      .then(response => {
        this.previewHtml = response.data.html;
      })
      .catch(error => {
        console.error('Error generating preview:', error);
        this.showWarning('Error generating preview.');
      })
      .finally(() => {
        this.previewLoading = false;
      });
    },
    closePreview() {
      this.showPreview = false;
      this.previewHtml = '';
    }
  }
};
</script>

<style scoped>
.transition-opacity {
  transition: opacity 0.5s ease-in-out;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
.loader {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: spin 1s ease infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Glassmorphic effect for untranslated boxes */
.glassmorphic {
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.glassmorphic:not(.translated) {
  color: transparent;
  text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
}

.glassmorphic.translated {
  backdrop-filter: none;
  background-color: white;
  border: 1px solid rgba(229, 231, 235, 1);
}

.dark .glassmorphic {
  background-color: rgba(31, 41, 55, 0.3);
  border: 1px solid rgba(31, 41, 55, 0.1);
}

.dark .glassmorphic.translated {
  background-color: rgb(31, 41, 55);
  border: 1px solid rgba(55, 65, 81, 1);
}

/* Ensuring compatibility with the new Forced Colors Mode */
@media (forced-colors: active) {
  .bg-white, .bg-gray-50, .bg-gray-100, .bg-gray-200, .bg-gray-700, .bg-gray-800, .bg-gray-900 {
    forced-color-adjust: auto;
  }
  .from-gray-50, .to-white, .from-gray-100, .to-gray-200, .from-gray-700, .to-gray-800, .from-gray-800, .to-gray-900 {
    forced-color-adjust: auto;
  }
  .from-blue-500, .to-blue-400, .from-blue-600, .to-blue-500,
  .from-teal-500, .to-green-400, .from-teal-600, .to-green-500,
  .from-pink-500, .to-orange-400, .from-pink-600, .to-orange-500 {
    forced-color-adjust: auto;
  }
  .border-gray-200, .border-gray-300, .border-gray-600, .border-gray-700 {
    forced-color-adjust: auto;
  }
  .border-red-300 {
    forced-color-adjust: auto;
  }
  .text-gray-100, .text-gray-200, .text-gray-400, .text-gray-500, .text-gray-700, .text-gray-800 {
    forced-color-adjust: auto;
  }
}
</style>
