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

    <!-- Main Navigation & Mode Switcher -->
    <div class="card-elevated p-4 sm:p-5 mb-5">
      <!-- Top Bar: Mode Switcher & Provider Badge -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <!-- Segmented Mode Pills -->
        <div class="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.06] text-xs font-semibold self-start">
          <button
            type="button"
            @click="setMode('article')"
            :class="[
              'px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5',
              currentMode === 'article'
                ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            ]"
          >
            <span class="material-icons-round text-sm">article</span>
            <span>{{ $t('toolbar.articleMode') }}</span>
          </button>
          <button
            type="button"
            @click="setMode('template')"
            :class="[
              'px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5',
              currentMode === 'template'
                ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            ]"
          >
            <span class="material-icons-round text-sm">extension</span>
            <span>{{ $t('toolbar.templateMode') }}</span>
          </button>
          <button
            type="button"
            @click="setMode('wikitext')"
            :class="[
              'px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5',
              currentMode === 'wikitext'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            ]"
          >
            <span class="material-icons-round text-sm">code</span>
            <span>{{ $t('toolbar.wikitextMode') }}</span>
          </button>
        </div>

        <!-- Provider Engine Badge & Settings Button -->
        <button
          type="button"
          @click="showProviderModal = true"
          class="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/[0.08] transition-all flex items-center justify-between sm:justify-start gap-2 shadow-sm self-start sm:self-auto"
        >
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-slate-400 dark:text-zinc-500 font-normal">{{ $t('toolbar.engine') }}:</span>
            <span class="font-semibold text-slate-800 dark:text-zinc-200">{{ currentServiceDisplayName }}</span>
          </div>
          <span class="material-icons-round text-sm text-slate-400 hover:text-primary-500 transition-colors">tune</span>
        </button>
      </div>

      <!-- Search & Language Bar (Article Mode) -->
      <div v-if="currentMode === 'article'">
        <div class="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <!-- Language Pair Selector -->
          <div class="flex items-center gap-1.5 bg-slate-100/90 dark:bg-zinc-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] flex-shrink-0">
            <select v-model="fromLanguage" @change="suggestions = []" class="select-field bg-transparent border-0 py-1.5 pl-2.5 pr-7 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-32 sm:w-36">
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
            
            <button
              type="button"
              @click="swapLanguages"
              title="Swap source & target languages"
              class="p-1.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-slate-500 hover:text-primary-600 dark:text-zinc-400 dark:hover:text-primary-400 transition-colors"
            >
              <span class="material-icons-round text-base">swap_horiz</span>
            </button>

            <select v-model="toLanguage" class="select-field bg-transparent border-0 py-1.5 pl-2.5 pr-7 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-32 sm:w-36" :class="{ 'text-red-500 font-bold': toLanguageError }">
              <option value="" disabled>{{ $t('toolbar.selectTarget') }}</option>
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
          </div>

          <!-- Article Search Bar -->
          <div class="relative flex-1">
            <div class="relative flex items-center">
              <span class="material-icons-round absolute left-3.5 text-slate-400 text-lg pointer-events-none">search</span>
              <input
                v-model="articleInput"
                @input="onArticleInput"
                @keydown.enter.prevent="getArticleAction"
                type="text"
                class="input-field pl-10 pr-24 py-2.5 bg-white dark:bg-zinc-900/90 text-sm"
                :class="{ 'ring-2 ring-red-400 border-red-400': articleInputError }"
                :placeholder="$t('toolbar.articlePlaceholder')"
                autocomplete="off"
              />
              <button
                @click="getArticleAction"
                :disabled="fetchingArticle"
                class="absolute right-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <span class="material-icons-round text-xs" :class="{ 'animate-spin': fetchingArticle }">{{ fetchingArticle ? 'refresh' : 'download' }}</span>
                <span>{{ fetchingArticle ? $t('toolbar.fetching') : $t('toolbar.getArticle') }}</span>
              </button>
            </div>

            <!-- Suggestions dropdown -->
            <ul v-if="suggestions.length" class="absolute top-full left-0 right-0 mt-1.5 glass-strong rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto border border-slate-200 dark:border-white/[0.1]">
              <li
                v-for="suggestion in suggestions"
                :key="suggestion"
                @click="selectSuggestion(suggestion)"
                class="px-4 py-2.5 text-sm cursor-pointer hover:bg-primary-50 dark:hover:bg-zinc-800/80 transition-colors text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-white/[0.04] last:border-0 flex items-center gap-2"
              >
                <span class="material-icons-round text-slate-400 text-sm">article</span>
                <span>{{ suggestion }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Article exists warning -->
        <div v-if="articleExistsWarning" class="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 animate-fade-in">
          <span class="material-icons-round text-amber-500 text-base flex-shrink-0 mt-0.5">warning</span>
          <div>
            <span class="font-semibold">{{ $t('warnings.articleExistsTitle') }}</span>
            {{ $t('warnings.articleExistsBody') }}
            <a :href="articleExistsUrl" target="_blank" class="underline font-medium ml-1">{{ $t('warnings.articleExistsLink') }}</a>
          </div>
        </div>
      </div>

      <!-- Action Bar (When paragraphs are loaded) -->
      <div v-if="currentMode === 'article' && paragraphs.length" class="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 mt-3.5 border-t border-slate-200/70 dark:border-white/[0.06]">
        <div class="flex items-center gap-2">
          <button @click="translateAllPending" class="btn-success text-xs py-2 px-3.5 flex items-center gap-1.5">
            <span class="material-icons-round text-sm">auto_fix_high</span>
            <span>{{ $t('toolbar.translateAllPending') }}</span>
          </button>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button @click="previewAction" :disabled="!hasAnyTranslation" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1 disabled:opacity-40">
            <span class="material-icons-round text-sm text-amber-500">visibility</span>
            <span>{{ $t('toolbar.preview') }}</span>
          </button>
          <button @click="copyAll" :disabled="!hasAnyTranslation" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1 disabled:opacity-40">
            <span class="material-icons-round text-sm text-slate-400">content_copy</span>
            <span>{{ $t('toolbar.copyAll') }}</span>
          </button>
          <button @click="exportWikitext" :disabled="!hasAnyTranslation" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1 disabled:opacity-40">
            <span class="material-icons-round text-sm text-slate-400">download</span>
            <span>{{ $t('toolbar.exportWikitext') }}</span>
          </button>
          <button @click="confirmReset" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/40">
            <span class="material-icons-round text-sm">restart_alt</span>
            <span>{{ $t('toolbar.reset') }}</span>
          </button>
        </div>
      </div>

      <!-- Reset Confirmation Dialog -->
      <div v-if="showResetConfirm" class="mt-3.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
        <div class="flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
          <span class="material-icons-round text-base text-red-500">warning</span>
          <span class="font-medium">Are you sure you want to reset all work? This cannot be undone.</span>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button @click="showResetConfirm = false" class="px-3 py-1 text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
          <button @click="executeReset" class="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm">Yes, Reset</button>
        </div>
      </div>
    </div>

    <!-- ===================== TEMPLATE-ONLY TRANSLATION BOX ===================== -->
    <transition name="fade">
      <div v-if="currentMode === 'template'" class="card-elevated p-4 sm:p-6 mb-5 border-t-4 border-amber-500 animate-fade-in">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <span class="material-icons-round text-lg">extension</span>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">Translate Wikipedia Template</h3>
              <p class="text-xs text-slate-500 dark:text-zinc-400">Translates parameters and maps template name via Wikidata</p>
            </div>
          </div>

          <!-- Language Selector for Template -->
          <div class="flex items-center gap-1.5 bg-slate-100/90 dark:bg-zinc-900/90 p-1 rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
            <select v-model="fromLanguage" class="select-field bg-transparent border-0 py-1 pl-2 pr-6 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-28">
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
            <span class="material-icons-round text-xs text-slate-400">arrow_forward</span>
            <select v-model="toLanguage" class="select-field bg-transparent border-0 py-1 pl-2 pr-6 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-28">
              <option value="" disabled>Target</option>
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
          </div>
        </div>

        <!-- Quick Samples -->
        <div class="flex items-center gap-2 mb-3 flex-wrap text-xs">
          <span class="text-slate-500 dark:text-zinc-400 font-medium">Quick Samples:</span>
          <button @click="loadSampleTemplate('infobox')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors">
            Infobox Person
          </button>
          <button @click="loadSampleTemplate('cite')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors">
            Cite Web
          </button>
          <button @click="loadSampleTemplate('taxobox')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors">
            Taxobox
          </button>
        </div>

        <textarea
          v-model="templateInput"
          class="textarea-field w-full mb-3 font-mono text-xs"
          rows="6"
          placeholder="Paste template here, e.g. {{Infobox person | name = Albert Einstein | birth_place = Ulm, Germany | fields = Physics}}"
        ></textarea>

        <div class="flex flex-wrap gap-2 items-center">
          <button @click="translateTemplateMode" :disabled="templateTranslating || !templateInput.trim()" class="btn-success text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-50">
            <span class="material-icons-round text-sm" :class="{ 'animate-spin': templateTranslating }">{{ templateTranslating ? 'refresh' : 'translate' }}</span>
            {{ templateTranslating ? 'Translating Template...' : 'Translate Template' }}
          </button>
          <button v-if="templateTranslated" @click="copyTemplateResult" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <span class="material-icons-round text-sm">content_copy</span>
            {{ $t('toolbar.copyAll') }}
          </button>
        </div>

        <!-- Template result & stats -->
        <div v-if="templateTranslated" class="mt-4 animate-fade-in">
          <div v-if="templateStats" class="flex flex-wrap gap-2 mb-2 text-xs">
            <span class="px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium">
              Template: {{ templateStats.templateName }} → {{ templateStats.translatedName }}
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              Parameters: {{ templateStats.paramsTranslated }}/{{ templateStats.paramsCount }} translated
            </span>
          </div>
          <label class="field-label">Translated Template</label>
          <textarea v-model="templateTranslated" class="textarea-field font-mono text-xs" rows="6"></textarea>
        </div>
      </div>
    </transition>

    <!-- ===================== WIKITEXT PASTE BOX ===================== -->
    <transition name="fade">
      <div v-if="currentMode === 'wikitext'" class="card-elevated p-4 sm:p-6 mb-5 border-t-4 border-emerald-500 animate-fade-in">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span class="material-icons-round text-lg">code</span>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">{{ $t('toolbar.pasteWikitext') }}</h3>
              <p class="text-xs text-slate-500 dark:text-zinc-400">Directly translate raw wikitext content</p>
            </div>
          </div>

          <!-- Language Selector for Wikitext -->
          <div class="flex items-center gap-1.5 bg-slate-100/90 dark:bg-zinc-900/90 p-1 rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
            <select v-model="fromLanguage" class="select-field bg-transparent border-0 py-1 pl-2 pr-6 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-28">
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
            <span class="material-icons-round text-xs text-slate-400">arrow_forward</span>
            <select v-model="toLanguage" class="select-field bg-transparent border-0 py-1 pl-2 pr-6 text-xs font-semibold focus:ring-0 text-slate-800 dark:text-zinc-200 w-28">
              <option value="" disabled>Target</option>
              <option v-for="lang in languages" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
            </select>
          </div>
        </div>

        <textarea
          v-model="wikitextInput"
          class="textarea-field w-full mb-3 font-mono text-xs"
          rows="6"
          placeholder="Paste raw wikitext here..."
        ></textarea>

        <div class="flex flex-wrap gap-2 items-center">
          <button @click="translateWikitextMode" :disabled="wikitextTranslating || !wikitextInput.trim()" class="btn-success text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-50">
            <span class="material-icons-round text-sm" :class="{ 'animate-spin': wikitextTranslating }">{{ wikitextTranslating ? 'refresh' : 'translate' }}</span>
            {{ wikitextTranslating ? $t('paragraph.translating') : $t('toolbar.translate') }}
          </button>
          <button v-if="wikitextTranslated" @click="copyWikitextResult" class="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <span class="material-icons-round text-sm">content_copy</span>
            {{ $t('toolbar.copyAll') }}
          </button>
        </div>

        <!-- Wikitext result -->
        <div v-if="wikitextTranslated" class="mt-4 animate-fade-in">
          <label class="field-label">{{ $t('toolbar.translationResult') }}</label>
          <textarea v-model="wikitextTranslated" class="textarea-field font-mono text-xs" rows="6"></textarea>
        </div>
      </div>
    </transition>

    <!-- ===================== ARTICLE SECTIONS & PROGRESS ===================== -->
    <div v-if="currentMode === 'article'">
      <!-- Stats bar shown when paragraphs are loaded -->
      <div v-if="paragraphs.length" class="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-500 dark:text-zinc-400">
        <span class="flex items-center gap-1">
          <span class="material-icons-round text-sm text-slate-400">text_snippet</span>
          {{ paragraphs.length }} {{ $t('paragraph.sections') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          {{ translatedCount }} {{ $t('paragraph.translated') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-zinc-700"></span>
          {{ paragraphs.length - translatedCount }} {{ $t('paragraph.pending') }}
        </span>
        <div class="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all duration-500"
            :style="{ width: translationProgress + '%' }"
          ></div>
        </div>
        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ translationProgress }}%</span>
      </div>

      <!-- Sections List -->
      <div v-if="paragraphs.length">
        <div class="space-y-3 mb-6">
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

        <!-- Publish Section -->
        <div v-if="hasAnyTranslation" class="card-elevated p-5 sm:p-6 mb-12 border-t-4 border-primary-500">
          <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">Publish to Wikipedia</h3>
          <p class="text-xs text-slate-500 dark:text-zinc-400 mb-4">Publish your translated article directly to the target Wikipedia. Choose your target destination namespace below.</p>
          
          <!-- Destination Selector -->
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mr-1">Destination:</span>
            <button
              type="button"
              @click="publishDestination = 'mainspace'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                publishDestination === 'mainspace'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              ]"
            >
              Mainspace (Live Article)
            </button>
            <button
              type="button"
              @click="publishDestination = 'sandbox'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                publishDestination === 'sandbox'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              ]"
            >
              User Sandbox
            </button>
            <button
              type="button"
              @click="publishDestination = 'draft'"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                publishDestination === 'draft'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              ]"
            >
              Draft Namespace
            </button>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div class="w-full sm:w-auto flex-1 max-w-md">
              <label class="field-label">Target Page Title ({{ formattedPublishTarget }})</label>
              <input
                v-model="publishTitle"
                type="text"
                class="input-field w-full text-xs"
                :placeholder="publishPlaceholder"
                :disabled="isPublishing"
              />
            </div>
            <div class="w-full sm:w-auto">
              <button
                v-if="user"
                @click="publishArticle"
                :disabled="isPublishing || !publishTitle.trim()"
                class="btn-primary w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs py-2.5"
              >
                <span class="material-icons-round text-sm" :class="{'animate-spin': isPublishing}">
                  {{ isPublishing ? 'refresh' : 'publish' }}
                </span>
                {{ isPublishing ? 'Publishing...' : 'Publish Article' }}
              </button>
              <button
                v-else
                disabled
                class="btn-secondary w-full sm:w-auto flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed text-xs py-2.5"
                title="Please login via the header to publish"
              >
                <span class="material-icons-round text-sm">lock</span>
                Login to Publish
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="card-elevated p-10 sm:p-14 text-center mb-6">
        <div class="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
          <span class="material-icons-round text-2xl">translate</span>
        </div>
        <h3 class="text-slate-800 dark:text-zinc-200 text-base font-semibold mb-1.5">Ready to translate</h3>
        <p class="text-slate-400 dark:text-zinc-500 text-xs max-w-md mx-auto">Select your language pair above, type an article name (e.g. <em>Albert Einstein</em>), and click <strong>Fetch Article</strong>.</p>
      </div>
    </div>

    <!-- Provider Configuration Modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showProviderModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showProviderModal = false">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-md"></div>
          <div class="relative w-full max-w-lg glass-strong rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-white/[0.1] animate-fade-in">
            <div class="flex items-center justify-between mb-5">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <span class="material-icons-round text-lg">tune</span>
                </div>
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Translation Engine</h3>
                  <p class="text-xs text-slate-500 dark:text-zinc-400">Configure machine translation & AI providers</p>
                </div>
              </div>
              <button @click="showProviderModal = false" class="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
                <span class="material-icons-round text-lg">close</span>
              </button>
            </div>

            <div class="space-y-4 text-xs">
              <div>
                <label class="field-label">Select Provider</label>
                <select v-model="translationService" class="select-field">
                  <option value="mint">Wikimedia MinT (100% Free, Recommended)</option>
                  <option value="deepl">DeepL Translator (Free or Pro)</option>
                  <option value="openai">OpenAI GPT (GPT-4o, GPT-4o-mini)</option>
                  <option value="custom_openai">Universal AI (Groq, DeepSeek, Ollama, OpenRouter)</option>
                  <option value="google">Google Cloud Translation</option>
                  <option value="microsoft">Microsoft Azure Translator</option>
                  <option value="libretranslate">LibreTranslate (Open-source)</option>
                  <option value="custom_rest">Custom REST MT Endpoint</option>
                </select>
              </div>

              <div v-if="showApiKeyInput">
                <label class="field-label">API Key / Auth Token</label>
                <input v-model="serviceInput" type="password" class="input-field" :placeholder="apiKeyPlaceholder" />
                <p v-if="translationService === 'deepl'" class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">For DeepL Free API, keys end in <code>:fx</code>.</p>
              </div>

              <div v-if="showEndpointInput">
                <label class="field-label">API Endpoint URL</label>
                <input v-model="serviceEndpoint" type="text" class="input-field font-mono text-xs" :placeholder="endpointPlaceholder" />
                <p v-if="translationService === 'custom_openai'" class="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">For local Ollama, use <code>http://localhost:11434/v1/chat/completions</code>.</p>
              </div>

              <div v-if="showModelInput">
                <label class="field-label">Model Name</label>
                <input v-model="serviceModel" type="text" class="input-field font-mono text-xs" :placeholder="modelPlaceholder" />
              </div>
            </div>

            <div class="mt-6 flex justify-end">
              <button @click="showProviderModal = false" class="btn-primary w-full sm:w-auto text-xs px-5">
                Done
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Progress Overlay -->
    <ProgressBar :showProgressBar="showProgressBar" :progressBarWidth="progressBarWidth" />

    <!-- Preview Modal -->
    <PreviewModal
      :showPreview="showPreview"
      :previewLoading="previewLoading"
      :previewHtml="previewHtml"
      :sourceWikitext="rawWikitext || paragraphs.map(p => p.source).join('\n\n')"
      :translatedWikitext="fullTranslatedText"
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
  props: {
    user: {
      type: Object,
      default: null,
    }
  },

  data() {
    return {
      // Active Mode & Modals
      currentMode: 'article', // 'article' | 'template' | 'wikitext'
      showProviderModal: false,

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

      // Template-only translation mode state
      showTemplateBox: false,
      templateInput: '',
      templateTranslated: '',
      templateTranslating: false,
      templateStats: null,

      // Translation service
      translationService: 'mint',
      serviceInput: '',
      serviceEndpoint: '',
      serviceModel: '',

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

      // Publish
      publishTitle: '',
      publishDestination: 'mainspace', // 'mainspace' | 'sandbox' | 'draft'
      isPublishing: false,      // Comprehensive language options: All Indian languages + major world languages
      languages: [
        // Indian & South Asian Languages
        { code: 'as', name: 'Assamese (অসমীয়া)' },
        { code: 'awa', name: 'Awadhi (अवधी)' },
        { code: 'bn', name: 'Bengali (বাংলা)' },
        { code: 'bho', name: 'Bhojpuri (भोजपुरी)' },
        { code: 'bpy', name: 'Bishnupriya Manipuri (বিষ্ণুপ্রিয়া মণিপুরী)' },
        { code: 'brx', name: 'Bodo (बड़ो)' },
        { code: 'hne', name: 'Chhattisgarhi (छत्तीसगढ़ी)' },
        { code: 'doi', name: 'Dogri (डोगरी)' },
        { code: 'dty', name: 'Doteli (डोटेली)' },
        { code: 'gom', name: 'Goan Konkani (कोंकणी)' },
        { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
        { code: 'hi', name: 'Hindi (हिन्दी)' },
        { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
        { code: 'ks', name: 'Kashmiri (كٲشُر)' },
        { code: 'mai', name: 'Maithili (मैथिली)' },
        { code: 'ml', name: 'Malayalam (മലയാളം)' },
        { code: 'mr', name: 'Marathi (मराठी)' },
        { code: 'mni', name: 'Meitei (মৈতৈলোন্)' },
        { code: 'ne', name: 'Nepali (नेपाली)' },
        { code: 'new', name: 'Newari (नेपाल भाषा)' },
        { code: 'or', name: 'Odia (ଓଡ଼ିଆ)' },
        { code: 'pi', name: 'Pali (पाऴि)' },
        { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
        { code: 'pnb', name: 'Punjabi Shahmukhi (پنجابی)' },
        { code: 'sa', name: 'Sanskrit (संस्कृतम्)' },
        { code: 'sat', name: 'Santali (ᱥᱟᱱᱛᱟᱲᱤ)' },
        { code: 'skr', name: 'Saraiki (سرائیکی)' },
        { code: 'sd', name: 'Sindhi (سنڌي)' },
        { code: 'si', name: 'Sinhala (සිංහල)' },
        { code: 'ta', name: 'Tamil (தமிழ்)' },
        { code: 'tcy', name: 'Tulu (ತುಳು)' },
        { code: 'te', name: 'Telugu (తెలుగు)' },
        { code: 'ur', name: 'Urdu (اردو)' },

        // Major World Languages
        { code: 'af', name: 'Afrikaans' },
        { code: 'ar', name: 'Arabic (العربية)' },
        { code: 'bg', name: 'Bulgarian (Български)' },
        { code: 'ca', name: 'Catalan (Català)' },
        { code: 'cs', name: 'Czech (Čeština)' },
        { code: 'da', name: 'Danish (Dansk)' },
        { code: 'de', name: 'German (Deutsch)' },
        { code: 'el', name: 'Greek (Ελληνικά)' },
        { code: 'en', name: 'English' },
        { code: 'eo', name: 'Esperanto' },
        { code: 'es', name: 'Spanish (Español)' },
        { code: 'fa', name: 'Persian (فارسی)' },
        { code: 'fi', name: 'Finnish (Suomi)' },
        { code: 'fr', name: 'French (Français)' },
        { code: 'he', name: 'Hebrew (עברית)' },
        { code: 'hu', name: 'Hungarian (Magyar)' },
        { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
        { code: 'it', name: 'Italian (Italiano)' },
        { code: 'ja', name: 'Japanese (日本語)' },
        { code: 'ko', name: 'Korean (한국어)' },
        { code: 'la', name: 'Latin (Latina)' },
        { code: 'ms', name: 'Malay (Bahasa Melayu)' },
        { code: 'nl', name: 'Dutch (Nederlands)' },
        { code: 'no', name: 'Norwegian (Norsk)' },
        { code: 'pl', name: 'Polish (Polski)' },
        { code: 'pt', name: 'Portuguese (Português)' },
        { code: 'ro', name: 'Romanian (Română)' },
        { code: 'ru', name: 'Russian (Русский)' },
        { code: 'sh', name: 'Serbo-Croatian (Srpskohrvatski)' },
        { code: 'sk', name: 'Slovak (Slovenčina)' },
        { code: 'sl', name: 'Slovenian (Slovenščina)' },
        { code: 'sv', name: 'Swedish (Svenska)' },
        { code: 'sw', name: 'Swahili (Kiswahili)' },
        { code: 'th', name: 'Thai (ไทย)' },
        { code: 'tl', name: 'Tagalog (Filipino)' },
        { code: 'tr', name: 'Turkish (Türkçe)' },
        { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
        { code: 'zh', name: 'Chinese (中文)' },
      ],
    };
  },

  computed: {
    currentServiceDisplayName() {
      const map = {
        mint: 'Wikimedia MinT (Free)',
        deepl: 'DeepL Translator',
        openai: 'OpenAI GPT',
        custom_openai: 'Universal AI / LLM',
        google: 'Google Cloud',
        microsoft: 'Microsoft Azure',
        libretranslate: 'LibreTranslate',
        custom_rest: 'Custom REST MT',
      };
      return map[this.translationService] || 'Wikimedia MinT';
    },
    showApiKeyInput() {
      return ['google', 'microsoft', 'openai', 'deepl', 'custom_openai', 'libretranslate', 'custom_rest'].includes(this.translationService);
    },
    showEndpointInput() {
      return ['openai', 'custom_openai', 'libretranslate', 'custom_rest'].includes(this.translationService);
    },
    showModelInput() {
      return ['openai', 'custom_openai'].includes(this.translationService);
    },
    apiKeyPlaceholder() {
      if (this.translationService === 'deepl') return 'DeepL API key (...:fx for free)';
      if (this.translationService === 'openai') return 'sk-... (required)';
      if (this.translationService === 'custom_openai') return 'API key (optional for Ollama)';
      if (this.translationService === 'libretranslate') return 'API key (optional)';
      if (this.translationService === 'custom_rest') return 'Auth key (optional)';
      return this.$t('toolbar.apiKeyPlaceholder');
    },
    endpointPlaceholder() {
      if (this.translationService === 'openai') return 'https://api.openai.com/v1/chat/completions';
      if (this.translationService === 'custom_openai') return 'https://api.groq.com/openai/v1/chat/completions';
      if (this.translationService === 'libretranslate') return 'https://libretranslate.com/translate';
      if (this.translationService === 'custom_rest') return 'https://your-server.com/api/translate';
      return 'API endpoint';
    },
    modelPlaceholder() {
      if (this.translationService === 'custom_openai') return 'Model (e.g. llama-3.3-70b-versatile, deepseek-chat)';
      if (this.translationService === 'openai') return 'Model (e.g. gpt-4o, gpt-4o-mini)';
      return 'Model name';
    },
    formattedPublishTarget() {
      const base = this.publishTitle || (this.articleInput || 'Title');
      if (this.publishDestination === 'sandbox') {
        const username = this.user?.username || 'Username';
        return `User:${username}/${base}`;
      }
      if (this.publishDestination === 'draft') {
        return `Draft:${base}`;
      }
      return base;
    },
    publishPlaceholder() {
      if (this.publishDestination === 'sandbox') return 'Enter subpage name, e.g. Albert Einstein';
      if (this.publishDestination === 'draft') return 'Enter draft title, e.g. Albert Einstein';
      return 'Enter live article title on target wiki';
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
      const base = 'fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-medium cursor-pointer max-w-sm flex items-center gap-2';
      if (this.toastType === 'success') return `${base} bg-emerald-600 text-white`;
      if (this.toastType === 'warning') return `${base} bg-amber-600 text-white`;
      return `${base} bg-red-600 text-white`;
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
    serviceEndpoint() { this.saveState(); },
    serviceModel() { this.saveState(); },
    paragraphs: {
      deep: true,
      handler() { this.saveState(); }
    },
    wikitextInput() { this.saveState(); },
    wikitextTranslated() { this.saveState(); },
    showWikitextBox() { this.saveState(); },
    showTemplateBox() { this.saveState(); },
    templateInput() { this.saveState(); },
    templateTranslated() { this.saveState(); },
  },

  methods: {
    setMode(mode) {
      this.currentMode = mode;
      this.showWikitextBox = (mode === 'wikitext');
      this.showTemplateBox = (mode === 'template');
      this.saveState();
    },

    swapLanguages() {
      const temp = this.fromLanguage;
      this.fromLanguage = this.toLanguage || 'en';
      this.toLanguage = temp;
      if (this.articleInput && this.paragraphs.length) {
        this.checkArticleExists();
      }
      this.saveState();
    },

    async translateAllPending() {
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showToast(this.$t('warnings.selectTarget'), 'warning');
        return;
      }
      if (this.fromLanguage === this.toLanguage) {
        this.showToast(this.$t('warnings.sameLanguage'), 'warning');
        return;
      }
      const pendingIndices = this.paragraphs
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => p.status === 'pending' || !p.translation)
        .map(({ idx }) => idx);

      if (!pendingIndices.length) {
        this.showToast('All sections are already translated!', 'success');
        return;
      }

      this.showToast(`Translating ${pendingIndices.length} section(s)...`, 'warning');
      for (const idx of pendingIndices) {
        await this.translateParagraph(idx);
      }
      this.showToast('All pending sections translated!', 'success');
    },

    saveState() {
      const state = {
        currentMode: this.currentMode,
        fromLanguage: this.fromLanguage,
        toLanguage: this.toLanguage,
        articleInput: this.articleInput,
        translationService: this.translationService,
        serviceInput: this.serviceInput,
        serviceEndpoint: this.serviceEndpoint,
        serviceModel: this.serviceModel,
        paragraphs: this.paragraphs,
        rawWikitext: this.rawWikitext,
        showWikitextBox: this.showWikitextBox,
        showTemplateBox: this.showTemplateBox,
        wikitextInput: this.wikitextInput,
        wikitextTranslated: this.wikitextTranslated,
        templateInput: this.templateInput,
        templateTranslated: this.templateTranslated,
        publishDestination: this.publishDestination,
      };
      localStorage.setItem('sourceTranslationState', JSON.stringify(state));
    },

    loadState() {
      try {
        const saved = localStorage.getItem('sourceTranslationState');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentMode) this.currentMode = parsed.currentMode;
          if (parsed.fromLanguage) this.fromLanguage = parsed.fromLanguage;
          if (parsed.toLanguage) this.toLanguage = parsed.toLanguage;
          if (parsed.articleInput) this.articleInput = parsed.articleInput;
          if (parsed.translationService) this.translationService = parsed.translationService;
          if (parsed.serviceInput) this.serviceInput = parsed.serviceInput;
          if (parsed.serviceEndpoint) this.serviceEndpoint = parsed.serviceEndpoint;
          if (parsed.serviceModel) this.serviceModel = parsed.serviceModel;
          if (parsed.paragraphs) this.paragraphs = parsed.paragraphs;
          if (parsed.rawWikitext) this.rawWikitext = parsed.rawWikitext;
          if (parsed.showWikitextBox) this.showWikitextBox = parsed.showWikitextBox;
          if (parsed.showTemplateBox) this.showTemplateBox = parsed.showTemplateBox;
          if (parsed.wikitextInput) this.wikitextInput = parsed.wikitextInput;
          if (parsed.wikitextTranslated) this.wikitextTranslated = parsed.wikitextTranslated;
          if (parsed.templateInput) this.templateInput = parsed.templateInput;
          if (parsed.templateTranslated) this.templateTranslated = parsed.templateTranslated;
          if (parsed.publishDestination) this.publishDestination = parsed.publishDestination;
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
      this.currentMode = 'article';
      this.translationService = 'mint';
      this.serviceInput = '';
      this.serviceEndpoint = '';
      this.serviceModel = '';
      this.toLanguage = '';
      this.showWikitextBox = false;
      this.showTemplateBox = false;
      this.wikitextInput = '';
      this.wikitextTranslated = '';
      this.templateInput = '';
      this.templateTranslated = '';
      this.templateStats = null;
      localStorage.removeItem('sourceTranslationState');
      this.showToast('All progress reset', 'success');
    },

    showToast(message, type = 'error') {
      this.toastMessage = message;
      this.toastType = type;
      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => { this.toastMessage = ''; }, 4000);
    },

    loadSampleTemplate(type) {
      if (type === 'infobox') {
        this.templateInput = `{{Infobox person
| name = Albert Einstein
| birth_date = 14 March 1879
| birth_place = Ulm, Kingdom of Württemberg, German Empire
| death_date = 18 April 1955
| fields = Physics
| nationality = German, American
}}`;
      } else if (type === 'cite') {
        this.templateInput = `{{Cite web
| url = https://example.com
| title = General Theory of Relativity
| author = Albert Einstein
| publisher = Annalen der Physik
| date = 1915
}}`;
      } else if (type === 'taxobox') {
        this.templateInput = `{{Taxobox
| name = Bengal tiger
| image = Panthera tigris tigris.jpg
| kingdom = Animalia
| phylum = Chordata
| class = Mammalia
| order = Carnivora
| family = Felidae
| genus = Panthera
| species = P. tigris
}}`;
      }
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
      this.showTemplateBox = false;

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

      if (this.translationService === 'openai' && !this.serviceInput.trim()) {
        this.showToast('OpenAI API key is required', 'warning');
        return;
      }
      if (this.translationService === 'deepl' && !this.serviceInput.trim()) {
        this.showToast('DeepL API key is required', 'warning');
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
          apiKey: this.serviceInput || undefined,
          apiEndpoint: this.serviceEndpoint || undefined,
          model: this.serviceModel || undefined,
        });
        
        // Backend returns { translatedText, stats }
        para.translation = response.data?.translatedText || response.data?.translation || response.data?.text || '';
        
        para.status = para.translation ? 'translated' : 'error';
        if (!para.translation) {
          this.showToast(this.$t('warnings.translationError'));
        } else if (response.data?.stats) {
          const s = response.data.stats;
          if (s.linksTranslated > 0 || s.templatesTranslated > 0 || s.categoriesTranslated > 0) {
            this.showToast(`Translated: ${s.linksTranslated} links, ${s.templatesTranslated} templates, ${s.categoriesTranslated || 0} categories`, 'success');
          }
        }
      } catch (err) {
        console.error('Translation error:', err);
        para.status = 'error';
        const errMsg = err.response?.data?.message || this.$t('warnings.translationError');
        this.showToast(errMsg);
      }
    },

    updateTranslation(index, value) {
      this.paragraphs[index].translation = value;
      if (value) this.paragraphs[index].status = 'translated';
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

      if (this.translationService === 'openai' && !this.serviceInput.trim()) {
        this.showToast('OpenAI API key is required', 'warning');
        return;
      }
      if (this.translationService === 'deepl' && !this.serviceInput.trim()) {
        this.showToast('DeepL API key is required', 'warning');
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
          apiKey: this.serviceInput || undefined,
          apiEndpoint: this.serviceEndpoint || undefined,
          model: this.serviceModel || undefined,
        });
        this.wikitextTranslated = response.data?.translatedText || response.data?.translation || response.data?.text || '';
      } catch (err) {
        console.error('Wikitext translation error:', err);
        this.showToast(this.$t('warnings.translationError'));
      } finally {
        this.wikitextTranslating = false;
      }
    },

    async translateTemplateMode() {
      if (this.fromLanguage === this.toLanguage) {
        this.showToast(this.$t('warnings.sameLanguage'), 'warning');
        return;
      }
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showToast(this.$t('warnings.selectTarget'), 'warning');
        return;
      }
      if (!this.templateInput.trim()) return;

      if (this.translationService === 'openai' && !this.serviceInput.trim()) {
        this.showToast('OpenAI API key is required', 'warning');
        return;
      }
      if (this.translationService === 'deepl' && !this.serviceInput.trim()) {
        this.showToast('DeepL API key is required', 'warning');
        return;
      }

      this.templateTranslating = true;
      this.templateTranslated = '';
      this.templateStats = null;
      try {
        const response = await axios.post('/translate/template', {
          template: this.templateInput,
          fromLanguage: this.fromLanguage,
          toLanguage: this.toLanguage,
          translationService: this.translationService,
          apiKey: this.serviceInput || undefined,
          apiEndpoint: this.serviceEndpoint || undefined,
          model: this.serviceModel || undefined,
        });
        this.templateTranslated = response.data?.translatedTemplate || '';
        this.templateStats = response.data?.stats || null;
        if (this.templateTranslated) {
          this.showToast('Template translated successfully!', 'success');
        }
      } catch (err) {
        console.error('Template translation error:', err);
        const msg = err.response?.data?.message || 'Error translating template';
        this.showToast(msg);
      } finally {
        this.templateTranslating = false;
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

    copyTemplateResult() {
      navigator.clipboard.writeText(this.templateTranslated)
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

    async publishArticle() {
      const rawTitle = this.publishTitle.trim() || this.articleInput.trim();
      if (!rawTitle) {
        this.showToast('Please provide an article name', 'warning');
        return;
      }
      if (!this.toLanguage) {
        this.showToast('Target language must be selected', 'warning');
        return;
      }

      let finalTitle = rawTitle;
      if (this.publishDestination === 'sandbox') {
        const username = this.user?.username || 'User';
        finalTitle = `User:${username}/${rawTitle}`;
      } else if (this.publishDestination === 'draft') {
        finalTitle = `Draft:${rawTitle}`;
      }

      this.isPublishing = true;
      try {
        // Step 1: Verify title does not exist on target wiki
        const url = `https://${this.toLanguage}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(finalTitle)}&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        
        const pages = data.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        
        // If pageId is NOT '-1', the article exists
        if (pageId && pageId !== '-1' && !pages[pageId].missing) {
          this.showToast(`Page "${finalTitle}" already exists on the target wiki.`, 'error');
          this.isPublishing = false;
          return;
        }

        // Step 2: Publish
        const response = await axios.post('/publish', {
          text: this.fullTranslatedText,
          language: this.toLanguage,
          title: finalTitle,
          destination: this.publishDestination,
        });

        if (response.data.success) {
          const articleUrl = `https://${this.toLanguage}.wikipedia.org/wiki/${encodeURIComponent(finalTitle)}`;
          this.showToast(`Successfully published: ${finalTitle}`, 'success');
          
          // Open the article in a new tab after a brief delay
          setTimeout(() => {
            window.open(articleUrl, '_blank');
          }, 1500);
        }

      } catch (error) {
        console.error('Publish error:', error);
        const errMsg = error.response?.data?.message || 'Failed to publish article. Are you logged in?';
        this.showToast(errMsg, 'error');
      } finally {
        this.isPublishing = false;
      }
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
