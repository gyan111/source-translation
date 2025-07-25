<template>
  <div class="container mx-auto p-4 bg-white shadow-lg rounded-lg">
    <h1 class="text-2xl font-bold text-gray-800 mb-4 text-center">{{ mainTitle }}</h1>
    <h1 class="text-1xl font-bold text-gray-800 mb-2 text-center">{{ subTitle }}</h1>

    <WarningMessage :message="warningMessage" class="block mb-4"/>

    <div class="w-full bg-gray-200 p-4 rounded-lg shadow mb-4">
      <div class="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:space-x-2">
        <select v-model="fromLanguage" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
          <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.name }}</option>
        </select>
        <TextInput v-model:inputValue="articleInput" :inputError="articleInputError" :suggestions="suggestions" @fetch-suggestions="fetchSuggestions" @select-suggestion="selectSuggestion" />
        <Button :buttonText="getArticleButtonText" :action="getArticleAction" customClass="bg-blue-500 text-white" />
        <select v-model="toLanguage" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
          <option value="" disabled>To</option>
          <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.name }}</option>
        </select>
        <select v-model="translationService" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded">
          <option value="mint">Mint Wikimedia</option>
          <option value="google">Google</option>
          <option value="microsoft">Microsoft</option>
        </select>
        <input v-if="showInputBox" v-model="serviceInput" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded" placeholder="API Key">
        <Button :buttonText="translateButtonText" :action="translateAction" customClass="bg-green-500 text-white" />
        <Button buttonText="Preview" :action="previewAction" customClass="bg-yellow-500 text-white" />
      </div>
    </div>

    <div class="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
      <TextArea :textareaValue.sync="leftTextarea" :textareaError="leftTextareaError" />
      <TextArea :textareaValue.sync="rightTextarea" />
    </div>

    <ProgressBar :showProgressBar="showProgressBar" :progressBarWidth="progressBarWidth" />
    <PreviewModal :showPreview="showPreview" :previewLoading="previewLoading" :previewHtml="previewHtml" @close-preview="closePreview" />
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
      subTitle: 'Translate the source of an article.',
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

      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showWarning('Please select a language to translate to.');
        return;
      } else {
        this.toLanguageError = false;
      }

      this.rightTextarea = '';
      this.showProgressBar = true;
      this.progressBarWidth = 0;

      try {
        const response = await axios.post('/translate', {
          text: this.leftTextarea,
          fromLanguage: this.fromLanguage,
          toLanguage: this.toLanguage,
          translationService: this.translationService,
          apiKey: this.serviceInput // Include API Key if needed
        });

        this.rightTextarea = response.data.translatedText;

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
/* Ensuring compatibility with the new Forced Colors Mode */
@media (forced-colors: active) {
  .bg-white {
    forced-color-adjust: auto;
  }
  .bg-gray-200 {
    forced-color-adjust: auto;
  }
  .bg-gray-300 {
    forced-color-adjust: auto;
  }
  .bg-blue-500 {
    forced-color-adjust: auto;
  }
  .bg-green-500 {
    forced-color-adjust: auto;
  }
  .bg-yellow-500 {
    forced-color-adjust: auto;
  }
  .border-gray-300 {
    forced-color-adjust: auto;
  }
  .border-red-300 {
    forced-color-adjust: auto;
  }
}
</style>
