<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1">

    <!-- Toast Notification -->
    <transition name="toast">
      <div v-if="toastMessage" :class="toastClass" @click="toastMessage = ''">
        <div class="flex items-center gap-2">
          <span class="material-icons-round text-sm">{{ toastIcon }}</span>
          <span>{{ toastMessage }}</span>
        </div>
      </div>
    </transition>

    <!-- Main Toolbar -->
    <div class="card-elevated relative z-40 p-4 sm:p-5 mb-5">
      <!-- Row 1: Languages + Article name -->
      <div class="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 mb-4 items-end">
        <!-- Source Language -->
        <div>
          <label class="field-label">{{ $t('toolbar.fromLanguage') }}</label>
          <select v-model="fromLanguage" @change="suggestions = []" class="select-field w-full sm:w-36">
            <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
          </select>
        </div>

        <!-- Article Input -->
        <div class="relative">
          <label class="field-label">{{ $t('toolbar.articleName') }}</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                v-model="articleInput"
                @input="onArticleInput"
                @keydown.enter.prevent="getArticleAction"
                type="text"
                class="input-field pr-8"
                :class="{ 'ring-2 ring-red-400 border-red-400': articleInputError }"
                :placeholder="$t('toolbar.articlePlaceholder')"
                autocomplete="off"
              />
              <span v-if="fetchingArticle" class="absolute right-2.5 top-1/2 -translate-y-1/2">
                <span class="material-icons-round text-slate-400 animate-spin text-base">refresh</span>
              </span>
              <span v-else-if="articleInput" @click="clearArticle" class="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer">
                <span class="material-icons-round text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-base transition-colors">close</span>
              </span>
              <!-- Suggestions dropdown -->
              <ul v-if="suggestions.length" class="absolute top-full left-0 right-0 mt-1 glass-strong rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto">
                <li
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  @click="selectSuggestion(suggestion)"
                  class="px-3 py-2.5 text-sm cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                >
                  <span class="material-icons-round text-slate-400 text-base mr-1.5 align-middle">article</span>{{ suggestion }}
                </li>
              </ul>
            </div>
            <button @click="getArticleAction" :disabled="fetchingArticle" class="btn-primary flex items-center gap-1.5 flex-shrink-0 disabled:opacity-60">
              <span class="material-icons-round text-sm">download</span>
              <span class="hidden sm:inline">{{ $t('toolbar.getArticle') }}</span>
            </button>
          </div>
        </div>

        <!-- Target Language -->
        <div>
          <label class="field-label">{{ $t('toolbar.toLanguage') }}</label>
          <select v-model="toLanguage" class="select-field w-full sm:w-36" :class="{ 'ring-2 ring-red-400': toLanguageError }">
            <option value="" disabled>{{ $t('toolbar.selectTarget') }}</option>
            <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
          </select>
        </div>
      </div>

      <!-- Row 2: Service + Action buttons -->
      <div class="flex flex-wrap gap-2 items-center">
        <!-- Translation Service -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <label class="field-label mb-0 whitespace-nowrap">{{ $t('toolbar.via') }}</label>
          <select v-model="translationService" class="select-field py-2 text-xs w-auto">
            <option value="mint">Mint Wikimedia</option>
            <option value="google">Google Translate</option>
            <option value="microsoft">Microsoft</option>
          </select>
        </div>
        <input v-if="showInputBox" v-model="serviceInput" type="password" class="input-field w-32 text-xs py-2" :placeholder="$t('toolbar.apiKeyPlaceholder')" />

        <div class="flex-1"></div>

        <!-- Translate dropdown button -->
        <div class="relative z-50" ref="translateDropdownRef">
          <button
            @click="translateMenuOpen = !translateMenuOpen"
            class="btn-success flex items-center gap-1.5"
          >
            <span class="material-icons-round text-sm">translate</span>
            <span>{{ $t('toolbar.translate') }}</span>
            <span class="material-icons-round text-sm transition-transform" :class="{ 'rotate-180': translateMenuOpen }">expand_more</span>
          </button>
          <transition name="dropdown">
            <div v-if="translateMenuOpen" class="absolute top-full right-0 mt-1 w-52 rounded-xl glass-strong shadow-xl overflow-hidden">
              <button @click="showWikitextBox = false; translateMenuOpen = false" :disabled="!paragraphs.length" class="dropdown-item disabled:opacity-50 disabled:cursor-not-allowed">
                <span class="material-icons-round text-primary-500 text-lg">article</span>
                {{ $t('toolbar.translateArticle') }}
              </button>
              <div class="border-t border-slate-200/50 dark:border-slate-700/50"></div>
              <button @click="showWikitextBox = true; translateMenuOpen = false" class="dropdown-item">
                <span class="material-icons-round text-emerald-500 text-lg">code</span>
                {{ $t('toolbar.translateWikitext') }}
              </button>
            </div>
          </transition>
        </div>

        <!-- Preview -->
        <button @click="previewAction" :disabled="!hasAnyTranslation" class="btn-warning flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          <span class="material-icons-round text-sm">visibility</span>
          <span class="hidden sm:inline">{{ $t('toolbar.preview') }}</span>
        </button>

        <!-- Copy -->
        <button @click="copyAll" :disabled="!hasAnyTranslation" class="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
          <span class="material-icons-round text-sm">content_copy</span>
          <span class="hidden md:inline">{{ $t('toolbar.copyAll') }}</span>
        </button>

        <!-- Export -->
        <button @click="exportWikitext" :disabled="!hasAnyTranslation" class="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
          <span class="material-icons-round text-sm">download</span>
          <span class="hidden md:inline">{{ $t('toolbar.exportWikitext') }}</span>
        </button>

        <!-- Reset -->
        <button @click="confirmReset" class="btn-secondary flex items-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50">
          <span class="material-icons-round text-sm">restart_alt</span>
          <span class="hidden md:inline">Reset</span>
        </button>
      </div>

      <!-- Reset Confirmation Dialog -->
      <div v-if="showResetConfirm" class="mt-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
        <div class="flex items-center gap-2 text-red-800 dark:text-red-300">
          <span class="material-icons-round">warning</span>
          <span class="font-medium">Are you sure you want to reset all work? This cannot be undone.</span>
        </div>
        <div class="flex items-center gap-2">
          <button @click="showResetConfirm = false" class="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button @click="executeReset" class="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Yes, Reset</button>
        </div>
      </div>

      <!-- Article exists warning -->
      <div v-if="articleExistsWarning" class="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300 animate-fade-in">
        <span class="material-icons-round text-amber-500 flex-shrink-0 mt-0.5">warning</span>
        <div>
          <span class="font-semibold">{{ $t('warnings.articleExistsTitle') }}</span>
          {{ $t('warnings.articleExistsBody') }}
          <a :href="articleExistsUrl" target="_blank" class="underline font-medium ml-1">{{ $t('warnings.articleExistsLink') }}</a>
        </div>
      </div>
    </div>

    <!-- ===================== WIKITEXT PASTE BOX ===================== -->
    <transition name="dropdown">
      <div v-if="showWikitextBox" class="card-elevated p-4 sm:p-5 mb-5 border-t-4 border-emerald-500">
        <div class="flex justify-between items-center mb-3">
          <label class="field-label mb-0">{{ $t('toolbar.pasteWikitext') }}</label>
          <button @click="showWikitextBox = false" class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
            <span class="material-icons-round">close</span>
          </button>
        </div>

        <textarea
          v-model="wikitextInput"
          class="textarea-field w-full mb-3"
          rows="6"
          placeholder="Paste wikitext or templete and choose target language"
        ></textarea>

        <div class="flex flex-wrap gap-2 items-center">
          <button @click="translateWikitextMode" :disabled="wikitextTranslating || !wikitextInput.trim()" class="btn-success flex items-center gap-1.5 disabled:opacity-50">
            <span class="material-icons-round text-sm" :class="{ 'animate-spin': wikitextTranslating }">{{ wikitextTranslating ? 'refresh' : 'translate' }}</span>
            {{ wikitextTranslating ? $t('paragraph.translating') : $t('toolbar.translate') }}
          </button>
          <button v-if="wikitextTranslated" @click="copyWikitextResult" class="btn-secondary flex items-center gap-1.5">
            <span class="material-icons-round text-sm">content_copy</span>
            {{ $t('toolbar.copyAll') }}
          </button>
        </div>

        <!-- Wikitext result -->
        <div v-if="wikitextTranslated" class="mt-4">
          <label class="field-label">{{ $t('toolbar.translationResult') }}</label>
          <textarea v-model="wikitextTranslated" class="textarea-field" rows="6"></textarea>
        </div>
      </div>
    </transition>

    <!-- ===================== PARAGRAPH SECTIONS ===================== -->
    <div v-if="!showWikitextBox">
      <!-- Stats bar shown when paragraphs are loaded -->
      <div v-if="paragraphs.length" class="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500 dark:text-slate-400">
        <span class="flex items-center gap-1">
          <span class="material-icons-round text-sm text-slate-400">text_snippet</span>
          {{ paragraphs.length }} {{ $t('paragraph.sections') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          {{ translatedCount }} {{ $t('paragraph.translated') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
          {{ paragraphs.length - translatedCount }} {{ $t('paragraph.pending') }}
        </span>
        <div class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all duration-500"
            :style="{ width: translationProgress + '%' }"
          ></div>
        </div>
        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ translationProgress }}%</span>
      </div>

      <!-- Sections -->
      <div v-if="paragraphs.length" class="space-y-3 mb-6 pb-12">
        <ParagraphSection
          v-for="(para, idx) in paragraphs"
          :key="idx"
          :index="idx"
          :source="para.source"
          :translation="para.translation"
          :status="para.status"
          @translate-paragraph="translateParagraph"
          @update-translation="updateTranslation"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="card-elevated p-10 sm:p-14 text-center mb-6">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40 flex items-center justify-center">
          <span class="material-icons-round text-3xl text-primary-500">translate</span>
        </div>
        <h3 class="text-slate-700 dark:text-slate-300 text-lg font-semibold mb-2">Ready to translate</h3>
        <p class="text-slate-400 dark:text-slate-500 text-sm max-w-md mx-auto">Search for a Wikipedia article above, select source and target languages, then click <strong>Fetch</strong> to load the article content.</p>
      </div>
    </div>

    <!-- Progress Overlay -->
    <ProgressBar :showProgressBar="showProgressBar" :progressBarWidth="progressBarWidth" />

    <!-- Preview Modal -->
    <PreviewModal
      :showPreview="showPreview"
      :previewLoading="previewLoading"
      :previewHtml="previewHtml"
      @close-preview="closePreview"
    />
  </div>
</template>

<script>
import ParagraphSection from './ParagraphSection.vue';
import ProgressBar from './ProgressBar.vue';
import PreviewModal from './PreviewModal.vue';
import axios from 'axios';
import debounce from 'lodash/debounce';

export default {
  name: 'SourceTranslation',
  components: { ParagraphSection, ProgressBar, PreviewModal },

  data() {
    return {
      // Main toolbar state
      fromLanguage: 'en',
      toLanguage: '',
      articleInput: '',
      fetchingArticle: false,
      suggestions: [],
      articleInputError: false,
      toLanguageError: false,
      paragraphs: [],
      rawWikitext: '',
      articleExistsWarning: false,
      articleExistsUrl: '',

      // Wikitext explicit mode state
      showWikitextBox: false,
      wikitextInput: '',
      wikitextTranslated: '',
      wikitextTranslating: false,

      // Translation service
      translationService: 'mint',
      serviceInput: '',

      // Translate dropdown
      translateMenuOpen: false,

      // UI state
      showResetConfirm: false,

      // Progress
      showProgressBar: false,
      progressBarWidth: 0,

      // Preview
      showPreview: false,
      previewHtml: '',
      previewLoading: false,

      // Toast
      toastMessage: '',
      toastType: 'error',
      toastTimeout: null,

      // All Indian languages + common world languages
      languages: [
        { code: 'as', name: 'Assamese (অসমীয়া)' },
        { code: 'bn', name: 'Bengali (বাংলা)' },
        { code: 'bho', name: 'Bhojpuri (भोजपुरी)' },
        { code: 'doi', name: 'Dogri (डोगरी)' },
        { code: 'en', name: 'English' },
        { code: 'gom', name: 'Goan Konkani (कोंकणी)' },
        { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
        { code: 'hi', name: 'Hindi (हिन्दी)' },
        { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
        { code: 'ks', name: 'Kashmiri (كٲشُر)' },
        { code: 'mai', name: 'Maithili (मैथिली)' },
        { code: 'ml', name: 'Malayalam (മലയാളം)' },
        { code: 'mni', name: 'Meitei (মৈতৈলোন্)' },
        { code: 'mr', name: 'Marathi (मराठी)' },
        { code: 'ne', name: 'Nepali (नेपाली)' },
        { code: 'new', name: 'Newari (नेपाल भाषा)' },
        { code: 'or', name: 'Odia (ଓଡ଼ିଆ)' },
        { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
        { code: 'sa', name: 'Sanskrit (संस्कृतम्)' },
        { code: 'sat', name: 'Santali (ᱥᱟᱱᱛᱟᱲᱤ)' },
        { code: 'sd', name: 'Sindhi (سنڌي)' },
        { code: 'si', name: 'Sinhala (සිංහල)' },
        { code: 'ta', name: 'Tamil (தமிழ்)' },
        { code: 'te', name: 'Telugu (తెలుగు)' },
        { code: 'ur', name: 'Urdu (اردو)' },
        { code: 'ar', name: 'Arabic (العربية)' },
        { code: 'de', name: 'German (Deutsch)' },
        { code: 'es', name: 'Spanish (Español)' },
        { code: 'fr', name: 'French (Français)' },
        { code: 'ja', name: 'Japanese (日本語)' },
        { code: 'pt', name: 'Portuguese (Português)' },
        { code: 'ru', name: 'Russian (Русский)' },
        { code: 'zh', name: 'Chinese (中文)' },
      ],
    };
  },

  computed: {
    showInputBox() {
      return this.translationService === 'google' || this.translationService === 'microsoft';
    },
    fullTranslatedText() {
      return this.paragraphs.map(p => p.translation || '').filter(Boolean).join('\n\n');
    },
    hasAnyTranslation() {
      return this.paragraphs.some(p => p.translation);
    },
    translatedCount() {
      return this.paragraphs.filter(p => p.status === 'translated').length;
    },
    translationProgress() {
      if (!this.paragraphs.length) return 0;
      return Math.round((this.translatedCount / this.paragraphs.length) * 100);
    },
    toastClass() {
      const base = 'fixed top-20 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium cursor-pointer max-w-sm flex items-center gap-2';
      if (this.toastType === 'success') return `${base} bg-emerald-500 text-white`;
      if (this.toastType === 'warning') return `${base} bg-amber-500 text-white`;
      return `${base} bg-red-500 text-white`;
    },
    toastIcon() {
      if (this.toastType === 'success') return 'check_circle';
      if (this.toastType === 'warning') return 'warning';
      return 'error';
    },
  },

  watch: {
    toLanguage(newVal) {
      if (newVal && this.articleInput && this.paragraphs.length) {
        this.checkArticleExists();
      }
      this.saveState();
    },
    fromLanguage() { this.saveState(); },
    articleInput() { this.saveState(); },
    translationService() { this.saveState(); },
    serviceInput() { this.saveState(); },
    paragraphs: {
      deep: true,
      handler() { this.saveState(); }
    },
    wikitextInput() { this.saveState(); },
    wikitextTranslated() { this.saveState(); },
    showWikitextBox() { this.saveState(); },
  },

  methods: {
    saveState() {
      const state = {
        fromLanguage: this.fromLanguage,
        toLanguage: this.toLanguage,
        articleInput: this.articleInput,
        translationService: this.translationService,
        serviceInput: this.serviceInput,
        paragraphs: this.paragraphs,
        rawWikitext: this.rawWikitext,
        showWikitextBox: this.showWikitextBox,
        wikitextInput: this.wikitextInput,
        wikitextTranslated: this.wikitextTranslated,
      };
      localStorage.setItem('sourceTranslationState', JSON.stringify(state));
    },

    loadState() {
      try {
        const saved = localStorage.getItem('sourceTranslationState');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.fromLanguage) this.fromLanguage = parsed.fromLanguage;
          if (parsed.toLanguage) this.toLanguage = parsed.toLanguage;
          if (parsed.articleInput) this.articleInput = parsed.articleInput;
          if (parsed.translationService) this.translationService = parsed.translationService;
          if (parsed.serviceInput) this.serviceInput = parsed.serviceInput;
          if (parsed.paragraphs) this.paragraphs = parsed.paragraphs;
          if (parsed.rawWikitext) this.rawWikitext = parsed.rawWikitext;
          if (parsed.showWikitextBox) this.showWikitextBox = parsed.showWikitextBox;
          if (parsed.wikitextInput) this.wikitextInput = parsed.wikitextInput;
          if (parsed.wikitextTranslated) this.wikitextTranslated = parsed.wikitextTranslated;
        }
      } catch (e) {
        console.error('Could not load saved state', e);
      }
    },

    confirmReset() {
      this.showResetConfirm = true;
    },

    executeReset() {
      this.showResetConfirm = false;
      this.clearArticle();
      this.translationService = 'mint';
      this.serviceInput = '';
      this.toLanguage = '';
      this.showWikitextBox = false;
      this.wikitextInput = '';
      this.wikitextTranslated = '';
      localStorage.removeItem('sourceTranslationState');
      this.showToast('All progress reset', 'success');
    },

    showToast(message, type = 'error') {
      this.toastMessage = message;
      this.toastType = type;
      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => { this.toastMessage = ''; }, 4000);
    },

    onArticleInput() {
      this.articleInputError = false;
      this.debouncedFetchSuggestions();
    },

    debouncedFetchSuggestions: debounce(function () {
      if (this.articleInput.length > 2) {
        const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(this.articleInput)}&limit=8&namespace=0&format=json&origin=*`;
        fetch(url)
          .then(r => r.json())
          .then(data => { this.suggestions = data[1] || []; })
          .catch(() => { this.suggestions = []; });
      } else {
        this.suggestions = [];
      }
    }, 280),

    selectSuggestion(suggestion) {
      this.articleInput = suggestion;
      this.suggestions = [];
      this.getArticleAction();
    },

    clearArticle() {
      this.articleInput = '';
      this.suggestions = [];
      this.paragraphs = [];
      this.rawWikitext = '';
      this.articleExistsWarning = false;
    },

    async getArticleAction() {
      if (!this.articleInput.trim()) {
        this.articleInputError = true;
        this.showToast(this.$t('warnings.enterArticle'), 'warning');
        return;
      }
      this.articleInputError = false;
      this.fetchingArticle = true;
      this.articleExistsWarning = false;
      this.showWikitextBox = false;

      const url = `https://${this.fromLanguage}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(this.articleInput)}&prop=wikitext&format=json&origin=*`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.parse?.wikitext?.['*']) {
          this.rawWikitext = data.parse.wikitext['*'];
          this.splitIntoParagraphs(this.rawWikitext);
          if (this.toLanguage) this.checkArticleExists();
        } else {
          this.showToast(this.$t('warnings.articleNotFound'), 'warning');
        }
      } catch {
        this.showToast(this.$t('warnings.fetchError'));
      } finally {
        this.fetchingArticle = false;
      }
    },

    splitIntoParagraphs(wikitext) {
      const parts = wikitext.split(/\n\n+/).filter(p => p.trim() !== '');
      this.paragraphs = parts.map(source => ({
        source: source.trim(),
        translation: '',
        status: 'pending',
      }));
    },

    async checkArticleExists() {
      if (!this.articleInput || !this.toLanguage) return;
      this.articleExistsWarning = false;
      try {
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&titles=${encodeURIComponent(this.articleInput)}&sites=${this.fromLanguage}wiki&props=sitelinks&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const entities = data.entities || {};
        const entityId = Object.keys(entities)[0];
        if (entityId && entityId !== '-1') {
          const sitelinks = entities[entityId].sitelinks || {};
          const targetSitelink = sitelinks[`${this.toLanguage}wiki`];
          if (targetSitelink) {
            this.articleExistsWarning = true;
            this.articleExistsUrl = `https://${this.toLanguage}.wikipedia.org/wiki/${encodeURIComponent(targetSitelink.title)}`;
          }
        }
      } catch {
        // silently fail - it's just a warning
      }
    },

    async translateParagraph(index) {
      if (this.fromLanguage === this.toLanguage) {
        this.showToast(this.$t('warnings.sameLanguage'), 'warning');
        return;
      }
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showToast(this.$t('warnings.selectTarget'), 'warning');
        return;
      }
      this.toLanguageError = false;

      if ((this.translationService === 'google' || this.translationService === 'microsoft') && !this.serviceInput.trim()) {
        this.showToast(this.$t('warnings.apiKeyRequired'), 'warning');
        return;
      }

      const para = this.paragraphs[index];
      if (para.status === 'translating') return;

      para.status = 'translating';
      para.translation = '';

      try {
        const response = await axios.post('/translate', {
          text: para.source,
          fromLanguage: this.fromLanguage,
          toLanguage: this.toLanguage,
          translationService: this.translationService,
          apiKey: this.serviceInput,
        });
        
        // Handle variations in translation API response formats
        para.translation = response.data?.translation || response.data?.translatedText || response.data?.text || '';
        
        para.status = para.translation ? 'translated' : 'error';
        if (!para.translation) this.showToast(this.$t('warnings.translationError'));
      } catch (err) {
        console.error('Translation error:', err);
        para.status = 'error';
        this.showToast(this.$t('warnings.translationError'));
      }
    },

    updateTranslation(index, value) {
      this.paragraphs[index].translation = value;
      if (value) this.paragraphs[index].status = 'translated';
    },

    async handleTranslateArticle() {
      // Just toggle the view, user translates paragraphs individually
      this.showWikitextBox = false;
    },

    async translateWikitextMode() {
      if (this.fromLanguage === this.toLanguage) {
        this.showToast(this.$t('warnings.sameLanguage'), 'warning');
        return;
      }
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showToast(this.$t('warnings.selectTarget'), 'warning');
        return;
      }
      if (!this.wikitextInput.trim()) return;

      if ((this.translationService === 'google' || this.translationService === 'microsoft') && !this.serviceInput.trim()) {
        this.showToast(this.$t('warnings.apiKeyRequired'), 'warning');
        return;
      }

      this.wikitextTranslating = true;
      this.wikitextTranslated = '';
      try {
        const response = await axios.post('/translate', {
          text: this.wikitextInput,
          fromLanguage: this.fromLanguage,
          toLanguage: this.toLanguage,
          translationService: this.translationService,
          apiKey: this.serviceInput,
        });
        this.wikitextTranslated = response.data?.translation || response.data?.translatedText || response.data?.text || '';
      } catch (err) {
        console.error('Wikitext translation error:', err);
        this.showToast(this.$t('warnings.translationError'));
      } finally {
        this.wikitextTranslating = false;
      }
    },

    previewAction() {
      if (!this.hasAnyTranslation) {
        this.showToast(this.$t('warnings.emptyTranslation'), 'warning');
        return;
      }
      this.previewLoading = true;
      this.showPreview = true;
      axios.post('/preview', {
        text: this.fullTranslatedText,
        language: this.toLanguage || this.fromLanguage,
      })
        .then(res => { this.previewHtml = res.data.html; })
        .catch(() => { this.showToast(this.$t('warnings.previewError')); })
        .finally(() => { this.previewLoading = false; });
    },

    closePreview() {
      this.showPreview = false;
      this.previewHtml = '';
    },

    copyAll() {
      if (!this.hasAnyTranslation) { this.showToast(this.$t('warnings.emptyTranslation'), 'warning'); return; }
      navigator.clipboard.writeText(this.fullTranslatedText)
        .then(() => this.showToast(this.$t('warnings.copied'), 'success'));
    },

    copyWikitextResult() {
      navigator.clipboard.writeText(this.wikitextTranslated)
        .then(() => this.showToast(this.$t('warnings.copied'), 'success'));
    },

    exportWikitext() {
      if (!this.hasAnyTranslation) { this.showToast(this.$t('warnings.emptyTranslation'), 'warning'); return; }
      const blob = new Blob([this.fullTranslatedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.articleInput || 'translated'}_${this.toLanguage}.wiki`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast(this.$t('warnings.exported'), 'success');
    },

    handleClickOutside(e) {
      if (this.$refs.translateDropdownRef && !this.$refs.translateDropdownRef.contains(e.target)) {
        this.translateMenuOpen = false;
      }
    },
  },

  mounted() {
    this.loadState();
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
};
</script>

<style scoped>
.field-label {
  @apply block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider;
}
.dropdown-item {
  @apply w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2;
}
.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(120px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* Responsive breakpoint for xs screens */
@media (min-width: 480px) {
  .xs\:inline { display: inline; }
  .xs\:hidden { display: none; }
}
</style>
