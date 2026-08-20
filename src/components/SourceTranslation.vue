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

    <!-- ===================== MODE VIEWS CONTAINER ===================== -->
    <!-- Template-Only Mode -->
    <div v-if="currentMode === 'template'" key="mode-template" class="card-elevated p-4 sm:p-6 mb-5 border-t-4 border-amber-500">
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

        <!-- Upper Right Actions: Language Selector + Prominent Translate Button -->
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-end">
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

          <!-- Upper Action Button -->
          <button
            @click="translateTemplateMode"
            :disabled="templateTranslating || !templateInput.trim()"
            class="btn-success text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span class="material-icons-round text-sm" :class="{ 'animate-spin': templateTranslating }">{{ templateTranslating ? 'refresh' : 'translate' }}</span>
            <span>{{ templateTranslating ? 'Translating...' : 'Translate Template' }}</span>
          </button>
        </div>
      </div>

      <!-- Quick Samples -->
      <div class="flex items-center gap-2 mb-4 flex-wrap text-xs">
        <span class="text-slate-500 dark:text-zinc-400 font-medium">Quick Samples:</span>
        <button @click="loadSampleTemplate('infobox')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer font-medium">
          Infobox Person
        </button>
        <button @click="loadSampleTemplate('cite')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer font-medium">
          Cite Web
        </button>
        <button @click="loadSampleTemplate('taxobox')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer font-medium">
          Taxobox
        </button>
      </div>

      <!-- Side-by-Side Template Layout -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Source Column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Original Template</span>
            <button
              v-if="templateInput"
              @click="templateInput = ''; templateTranslated = ''; templateStats = null;"
              class="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <textarea
            v-model="templateInput"
            :dir="isSourceRtl ? 'rtl' : 'ltr'"
            class="textarea-field flex-1 font-mono text-xs leading-relaxed min-h-[240px] bg-slate-50/70 dark:bg-zinc-950/60 resize-y"
            placeholder="Paste template here, e.g. {{Infobox settlement | name = Kendrapara | population_total = 41404}}"
          ></textarea>
        </div>

        <!-- Translation Column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Translated Template</span>
            <div v-if="templateTranslated" class="flex items-center gap-1.5">
              <button @click="copyTemplateResult" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                <span class="material-icons-round text-xs">content_copy</span> Copy
              </button>
            </div>
          </div>
          <textarea
            v-model="templateTranslated"
            :dir="isTargetRtl ? 'rtl' : 'ltr'"
            class="textarea-field flex-1 font-mono text-xs leading-relaxed min-h-[240px] bg-white dark:bg-zinc-900 border-primary-300 dark:border-primary-500/30 resize-y shadow-inner"
            placeholder="Translated template will appear here..."
          ></textarea>
        </div>
      </div>

      <!-- Action & Stats Bar -->
      <div v-if="templateStats" class="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold">
            {{ templateStats.templateName }} → {{ templateStats.translatedName }}
          </span>
          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            {{ templateStats.paramsTranslated }}/{{ templateStats.paramsCount }} params translated ({{ templateStats.timingMs.total || 0 }}ms)
          </span>
        </div>
      </div>
    </div>

    <!-- Raw Wikitext Mode (Side-by-Side) -->
    <div v-else-if="currentMode === 'wikitext'" key="mode-wikitext" class="card-elevated p-4 sm:p-6 mb-5 border-t-4 border-emerald-500">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <span class="material-icons-round text-lg">code</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">{{ $t('toolbar.pasteWikitext') }}</h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400">Directly translate raw wikitext content in side-by-side view</p>
          </div>
        </div>

        <!-- Upper Right Actions: Language Selector + Prominent Translate Button -->
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-end">
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

          <!-- Upper Action Button -->
          <button
            @click="translateWikitextMode"
            :disabled="wikitextTranslating || !wikitextInput.trim()"
            class="btn-success text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <span class="material-icons-round text-sm" :class="{ 'animate-spin': wikitextTranslating }">{{ wikitextTranslating ? 'refresh' : 'translate' }}</span>
            <span>{{ wikitextTranslating ? 'Translating...' : 'Translate Wikitext' }}</span>
          </button>
        </div>
      </div>

      <!-- Side-by-Side Wikitext Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Source Column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Source Wikitext</span>
            <button
              v-if="wikitextInput"
              @click="wikitextInput = ''; wikitextTranslated = '';"
              class="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <textarea
            v-model="wikitextInput"
            :dir="isSourceRtl ? 'rtl' : 'ltr'"
            class="textarea-field flex-1 font-mono text-xs leading-relaxed min-h-[260px] bg-slate-50/70 dark:bg-zinc-950/60 resize-y"
            placeholder="Paste raw wikitext with headings, links, templates, and categories here..."
          ></textarea>
        </div>

        <!-- Translation Column -->
        <div class="flex flex-col">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Translated Wikitext</span>
            <div v-if="wikitextTranslated" class="flex items-center gap-2">
              <button @click="copyWikitextResult" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                <span class="material-icons-round text-xs">content_copy</span> Copy
              </button>
            </div>
          </div>
          <textarea
            v-model="wikitextTranslated"
            :dir="isTargetRtl ? 'rtl' : 'ltr'"
            class="textarea-field flex-1 font-mono text-xs leading-relaxed min-h-[260px] bg-white dark:bg-zinc-900 border-primary-300 dark:border-primary-500/30 resize-y shadow-inner"
            placeholder="Translated wikitext will appear here..."
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Article Sections & Mode Content -->
    <div v-else-if="currentMode === 'article'" key="mode-article">
      <!-- Interactive Animated Sticky Progress Card when Batch Translating -->
      <transition name="fade">
        <div v-if="isTranslatingAll" class="sticky top-14 z-30 mb-4 p-4 rounded-2xl border border-primary-200/90 dark:border-primary-800/80 bg-white/95 dark:bg-zinc-900/95 shadow-xl backdrop-blur-xl transition-all duration-300">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="relative flex h-3 w-3 shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
              </span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2 truncate">
                  <span>Translating Section {{ translatingCurrentIndex }} of {{ translatingTotalCount }}</span>
                  <span class="text-[11px] font-semibold text-primary-600 dark:text-primary-400">({{ batchProgressPercent }}%)</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                  {{ translatingStageText || 'Translating wikitext & resolving links...' }}
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
              <!-- Auto-scroll Toggle Switch -->
              <button
                type="button"
                @click="toggleAutoScroll"
                class="text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer"
                :class="[
                  autoScrollEnabled
                    ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                    : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
                ]"
                :title="autoScrollEnabled ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'"
              >
                <span class="material-icons-round text-xs">{{ autoScrollEnabled ? 'gps_fixed' : 'gps_off' }}</span>
                <span>Auto-scroll: {{ autoScrollEnabled ? 'ON' : 'OFF' }}</span>
              </button>

              <span class="text-[11px] font-mono text-slate-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-800/80 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-zinc-700/60 shadow-2xs">
                ⏱️ {{ translatingElapsedSeconds }}s
              </span>
              <button
                type="button"
                @click="cancelTranslateAll"
                class="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span class="material-icons-round text-xs">close</span>
                Cancel
              </button>
            </div>
          </div>

          <!-- Animated Gradient Shimmer Progress Bar -->
          <div class="w-full h-2 bg-slate-200/80 dark:bg-zinc-800/80 rounded-full overflow-hidden relative shadow-inner">
            <div
              class="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300 relative overflow-hidden"
              :style="{ width: batchProgressPercent + '%' }"
            >
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast"></div>
            </div>
          </div>
        </div>
      </transition>

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
        <div class="flex-1 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden relative min-w-[80px]">
          <div
            class="h-full bg-gradient-to-r from-primary-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500 relative overflow-hidden"
            :style="{ width: translationProgress + '%' }"
          >
            <div v-if="isTranslatingAll" class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-fast"></div>
          </div>
        </div>
        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ translationProgress }}%</span>

        <!-- Source Article Link -->
        <a
          v-if="articleInput"
          :href="`https://${fromLanguage}.wikipedia.org/wiki/${encodeURIComponent(articleInput)}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium transition-colors ml-auto text-[11px]"
          title="Open source article on Wikipedia in new tab"
        >
          <span class="material-icons-round text-xs text-primary-500">open_in_new</span>
          <span>{{ fromLanguage }}:{{ articleInput }}</span>
        </a>
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
            :isSourceRtl="isSourceRtl"
            :isTargetRtl="isTargetRtl"
            :targetLang="toLanguage"
            @translate-paragraph="translateParagraph"
            @update-translation="updateTranslation"
          />
        </div>

        <!-- Publish Section -->
        <div v-if="hasAnyTranslation" class="card-elevated p-5 sm:p-6 mb-12 border-t-4 border-primary-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
              <span class="material-icons-round text-primary-500">publish</span>
              Ready to Publish to Wikipedia?
            </h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400">Publish your translated article directly to {{ targetLanguageName }} Wikipedia (Mainspace, User Sandbox, or Draft).</p>
          </div>
          <div>
            <button
              v-if="user"
              @click="openPublishModal"
              class="btn-primary text-xs py-3 px-6 flex items-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
            >
              <span class="material-icons-round text-base">publish</span>
              <span class="font-bold">Publish to Wikipedia</span>
            </button>
            <a
              v-else
              href="/auth/login"
              class="btn-secondary text-xs py-3 px-6 flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap"
              title="Login with your Wikipedia account to publish"
            >
              <span class="material-icons-round text-base">lock</span>
              <span class="font-bold">Login to Publish</span>
            </a>
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

              <!-- Missing Wikilink Strategy -->
              <div class="pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                <label class="field-label flex items-center gap-1.5">
                  <span class="material-icons-round text-sm text-primary-500">link</span>
                  Missing Wikilink Handling
                </label>
                <p class="text-[11px] text-slate-400 dark:text-zinc-500 mb-2">When a linked article doesn't exist on target Wikipedia:</p>
                <select v-model="missingLinkStrategy" class="select-field">
                  <option value="translate">🔴 Native Red Link (Translate Title - Recommended)</option>
                  <option value="ill">🌐 Interlanguage Link Template ({{ill}} / {{Lien}})</option>
                  <option value="plain">📝 Plain Text (Strip [[ ]] Brackets)</option>
                  <option value="keep_source">🔤 Keep Original Source Link Title</option>
                </select>
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
      :isSourceRtl="isSourceRtl"
      :isTargetRtl="isTargetRtl"
      :user="user"
      @close-preview="closePreview"
      @publish-from-preview="openPublishModal"
    />

    <!-- Publish Dialog Modal -->
    <PublishModal
      :showModal="showPublishModal"
      :user="user"
      :defaultTitle="publishTitle || articleInput"
      :toLanguage="toLanguage"
      :targetLanguageName="targetLanguageName"
      :fullTranslatedText="fullTranslatedText"
      @close="showPublishModal = false"
      @published="handleArticlePublished"
    />
  </div>
</template>

<script>
import ParagraphSection from './ParagraphSection.vue';
import ProgressBar from './ProgressBar.vue';
import PreviewModal from './PreviewModal.vue';
import PublishModal from './PublishModal.vue';
import axios from 'axios';
import debounce from 'lodash/debounce';
import { isRtlLanguage } from '../i18n.js';

export default {
  name: 'SourceTranslation',
  components: { ParagraphSection, ProgressBar, PreviewModal, PublishModal },
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
      showPublishModal: false,

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

      // Translation service & options
      translationService: 'mint',
      serviceInput: '',
      serviceEndpoint: '',
      serviceModel: '',
      missingLinkStrategy: 'translate', // 'translate' | 'ill' | 'plain' | 'keep_source'

      // UI state
      showResetConfirm: false,

      // Progress & Batch Translation State
      showProgressBar: false,
      progressBarWidth: 0,
      isTranslatingAll: false,
      autoScrollEnabled: localStorage.getItem('source_translation_autoscroll') !== 'false',
      translatingCurrentIndex: 0,
      translatingTotalCount: 0,
      translatingDoneCount: 0,
      translatingStageText: '',
      translatingStartTime: null,
      translatingElapsedSeconds: 0,
      translatingTimer: null,
      translatingCancelRequested: false,

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
    isSourceRtl() {
      return isRtlLanguage(this.fromLanguage);
    },
    isTargetRtl() {
      return isRtlLanguage(this.toLanguage);
    },
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
    batchProgressPercent() {
      if (!this.translatingTotalCount) return 0;
      return Math.round((this.translatingDoneCount / this.translatingTotalCount) * 100);
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
    targetLanguageName() {
      const lang = this.languages.find(l => l.code === this.toLanguage);
      return lang ? lang.name : this.toLanguage;
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

      this.isTranslatingAll = true;
      this.translatingCancelRequested = false;
      this.translatingTotalCount = pendingIndices.length;
      this.translatingDoneCount = 0;
      this.translatingElapsedSeconds = 0;
      this.translatingStartTime = Date.now();

      if (this.translatingTimer) clearInterval(this.translatingTimer);
      this.translatingTimer = setInterval(() => {
        if (this.translatingStartTime) {
          this.translatingElapsedSeconds = Math.floor((Date.now() - this.translatingStartTime) / 1000);
        }
      }, 1000);

      this.showToast(`Translating ${pendingIndices.length} section(s)...`, 'warning');

      for (let i = 0; i < pendingIndices.length; i++) {
        if (this.translatingCancelRequested) {
          this.showToast('Batch translation paused.', 'warning');
          break;
        }
        const idx = pendingIndices[i];
        this.translatingCurrentIndex = i + 1;
        const sourceText = (this.paragraphs[idx].source || '').trim();
        const snippet = sourceText.replace(/^[=\s]+|[=\s]+$/g, '').slice(0, 45);
        this.translatingStageText = snippet ? `Translating: "${snippet}..."` : 'Translating section...';

        // Smoothly scroll active section into view if auto-scroll is enabled
        if (this.autoScrollEnabled) {
          this.$nextTick(() => {
            const el = document.getElementById(`paragraph-section-${idx}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }

        await this.translateParagraph(idx);
        this.translatingDoneCount = i + 1;
      }

      if (this.translatingTimer) clearInterval(this.translatingTimer);
      this.isTranslatingAll = false;
      if (!this.translatingCancelRequested) {
        this.showToast('All pending sections translated!', 'success');
      }
    },

    toggleAutoScroll() {
      this.autoScrollEnabled = !this.autoScrollEnabled;
      localStorage.setItem('source_translation_autoscroll', String(this.autoScrollEnabled));
      this.showToast(`Auto-scroll ${this.autoScrollEnabled ? 'enabled' : 'disabled'}`, 'info');
    },

    cancelTranslateAll() {
      this.translatingCancelRequested = true;
      if (this.translatingTimer) clearInterval(this.translatingTimer);
      this.isTranslatingAll = false;
      this.showToast('Translation cancelled.', 'warning');
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
        missingLinkStrategy: this.missingLinkStrategy,
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
          if (parsed.missingLinkStrategy) this.missingLinkStrategy = parsed.missingLinkStrategy;
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
      if (!wikitext || typeof wikitext !== 'string') {
        this.paragraphs = [];
        return;
      }
      // Ensure headings have clean section boundaries
      let cleaned = wikitext.replace(/([^\n])\n([ \t]*={2,}[^\n=]+={2,})/g, '$1\n\n$2');
      cleaned = cleaned.replace(/(={2,}[^\n=]+={2,}[ \t]*)\n([^\n=])/g, '$1\n\n$2');

      const parts = cleaned.split(/\n\n+/).filter(p => p.trim() !== '');
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
          missingLinkStrategy: this.missingLinkStrategy,
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
          missingLinkStrategy: this.missingLinkStrategy,
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

    openPublishModal() {
      if (!this.hasAnyTranslation) {
        this.showToast(this.$t('warnings.emptyTranslation'), 'warning');
        return;
      }
      if (!this.toLanguage) {
        this.toLanguageError = true;
        this.showToast(this.$t('warnings.selectTarget'), 'warning');
        return;
      }
      this.showPublishModal = true;
    },

    handleArticlePublished({ title, url }) {
      this.showToast(`Article "${title}" published successfully!`, 'success');
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
