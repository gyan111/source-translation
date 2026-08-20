<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="showPreview" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" @click.self="closePreview">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-5xl max-h-[90vh] sm:max-h-[85vh] glass-strong rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-white/[0.1] animate-fade-in">
          <!-- Header with Tabs -->
          <div class="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06] flex-shrink-0">
            <div class="flex items-center gap-3">
              <span class="material-icons-round text-primary-500 text-xl">preview</span>
              <!-- Tab Pills -->
              <div class="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl gap-1 text-xs font-semibold border border-slate-200/60 dark:border-white/[0.06]">
                <button
                  @click="activeTab = 'rendered'"
                  :class="[
                    'px-3 py-1.5 rounded-lg transition-all',
                    activeTab === 'rendered'
                      ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  ]"
                >
                  {{ $t('preview.title') }}
                </button>
                <button
                  @click="activeTab = 'diff'"
                  :class="[
                    'px-3 py-1.5 rounded-lg transition-all',
                    activeTab === 'diff'
                      ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  ]"
                >
                  Side-by-Side Diff
                </button>
              </div>
            </div>

            <button @click="closePreview" class="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
              <span class="material-icons-round text-lg">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 sm:p-6 overflow-y-auto flex-1">
            <!-- Loading -->
            <div v-if="previewLoading" class="flex flex-col items-center justify-center h-64 gap-4">
              <div class="w-10 h-10 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
              <p class="text-xs text-slate-500 dark:text-zinc-400">{{ $t('preview.loading') }}</p>
            </div>

            <!-- Rendered HTML Tab (Styled to match target Wikipedia / Vector skin) -->
            <div v-else-if="activeTab === 'rendered'" v-html="previewHtml" :dir="isTargetRtl ? 'rtl' : 'ltr'" class="wiki-preview prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed"></div>

            <!-- Side-by-Side Diff Tab -->
            <div v-else-if="activeTab === 'diff'" class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              <!-- Source -->
              <div class="flex flex-col h-full">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Original Wikitext</span>
                </div>
                <pre :dir="isSourceRtl ? 'rtl' : 'ltr'" class="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-white/[0.06] text-xs font-mono text-slate-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap flex-1 max-h-[60vh]">{{ sourceWikitext || 'No source content' }}</pre>
              </div>

              <!-- Translated -->
              <div class="flex flex-col h-full">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Translated Wikitext</span>
                </div>
                <pre :dir="isTargetRtl ? 'rtl' : 'ltr'" class="p-3.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs font-mono text-slate-700 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap flex-1 max-h-[60vh]">{{ translatedWikitext || 'No translated content' }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'PreviewModal',
  props: {
    showPreview: Boolean,
    previewLoading: Boolean,
    previewHtml: String,
    sourceWikitext: {
      type: String,
      default: '',
    },
    translatedWikitext: {
      type: String,
      default: '',
    },
    isSourceRtl: {
      type: Boolean,
      default: false,
    },
    isTargetRtl: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      activeTab: 'rendered',
    };
  },
  methods: {
    closePreview() {
      this.$emit('close-preview');
    },
    handleEscape(e) {
      if (e.key === 'Escape' && this.showPreview) {
        this.closePreview();
      }
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
  },
};
</script>

<style>
/* Vector 2022 / MediaWiki Authenticity Styles Scoped to Preview */
.wiki-preview {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Liberation Sans", Arial, sans-serif;
  color: #202122;
}
.dark .wiki-preview {
  color: #f4f4f5;
}

/* Headings with standard MediaWiki underlines */
.wiki-preview h1,
.wiki-preview h2 {
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 0.25em;
  margin-top: 1.4em;
  margin-bottom: 0.5em;
  font-weight: 500;
}
.dark .wiki-preview h1,
.dark .wiki-preview h2 {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.wiki-preview h3,
.wiki-preview h4 {
  font-weight: 600;
  margin-top: 1.2em;
  margin-bottom: 0.3em;
}

/* Links & Red Links */
.wiki-preview a {
  color: #3366cc;
  text-decoration: none;
}
.dark .wiki-preview a {
  color: #60a5fa;
}
.wiki-preview a:hover {
  text-decoration: underline;
}
.wiki-preview a.new,
.wiki-preview a.redlink {
  color: #ba0000;
}
.dark .wiki-preview a.new,
.dark .wiki-preview a.redlink {
  color: #f87171;
}

/* Floating Infobox Card */
.wiki-preview .infobox,
.wiki-preview table.infobox,
.wiki-preview .infobox_v2,
.wiki-preview .infobox_v3 {
  float: right;
  clear: right;
  margin: 0 0 1.2em 1.5em;
  width: 23em;
  max-width: 100%;
  border: 1px solid #c8ccd1;
  background-color: #f8f9fa;
  color: #202122;
  padding: 0.35em;
  font-size: 0.85em;
  line-height: 1.5em;
  border-collapse: collapse;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
[dir="rtl"] .wiki-preview .infobox,
[dir="rtl"] .wiki-preview table.infobox,
[dir="rtl"] .wiki-preview .infobox_v2,
[dir="rtl"] .wiki-preview .infobox_v3 {
  float: left;
  clear: left;
  margin: 0 1.5em 1.2em 0;
}
.dark .wiki-preview .infobox,
.dark .wiki-preview table.infobox,
.dark .wiki-preview .infobox_v2,
.dark .wiki-preview .infobox_v3 {
  background-color: #18181b;
  border-color: #3f3f46;
  color: #f4f4f5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.wiki-preview .infobox th,
.wiki-preview .infobox td {
  vertical-align: top;
  padding: 0.3em 0.5em;
  border: 1px solid #eaecf0;
}
.dark .wiki-preview .infobox th,
.dark .wiki-preview .infobox td {
  border-color: #27272a;
}
.wiki-preview .infobox th {
  text-align: left;
  background-color: #eaecf0;
  font-weight: 600;
}
[dir="rtl"] .wiki-preview .infobox th {
  text-align: right;
}
.dark .wiki-preview .infobox th {
  background-color: #27272a;
  color: #fafafa;
}

/* Floating Image Thumbnails */
.wiki-preview .thumb,
.wiki-preview .tright {
  float: right;
  clear: right;
  margin-bottom: 0.8em;
  margin-left: 1.4em;
  background-color: #f8f9fa;
  border: 1px solid #c8ccd1;
  padding: 4px;
  font-size: 0.85em;
  border-radius: 6px;
}
[dir="rtl"] .wiki-preview .thumb,
[dir="rtl"] .wiki-preview .tright {
  float: left;
  clear: left;
  margin-right: 1.4em;
  margin-left: 0;
}
.dark .wiki-preview .thumb,
.dark .wiki-preview .tright {
  background-color: #18181b;
  border-color: #3f3f46;
}
.wiki-preview .tleft {
  float: left;
  clear: left;
  margin-bottom: 0.8em;
  margin-right: 1.4em;
  background-color: #f8f9fa;
  border: 1px solid #c8ccd1;
  padding: 4px;
  font-size: 0.85em;
  border-radius: 6px;
}
[dir="rtl"] .wiki-preview .tleft {
  float: right;
  clear: right;
  margin-left: 1.4em;
  margin-right: 0;
}
.dark .wiki-preview .tleft {
  background-color: #18181b;
  border-color: #3f3f46;
}
.wiki-preview .thumbcaption {
  border: none;
  text-align: left;
  line-height: 1.4em;
  padding: 4px 2px 2px 2px;
  color: #54595d;
}
.dark .wiki-preview .thumbcaption {
  color: #a1a1aa;
}

/* Wikitables */
.wiki-preview table.wikitable {
  background-color: #f8f9fa;
  color: #202122;
  margin: 1em 0;
  border: 1px solid #a2a9b1;
  border-collapse: collapse;
  font-size: 0.9em;
  width: 100%;
}
.dark .wiki-preview table.wikitable {
  background-color: #18181b;
  border-color: #3f3f46;
  color: #f4f4f5;
}
.wiki-preview table.wikitable > tr > th,
.wiki-preview table.wikitable > * > tr > th {
  background-color: #eaecf0;
  text-align: center;
  padding: 0.4em 0.6em;
  border: 1px solid #a2a9b1;
  font-weight: 600;
}
.dark .wiki-preview table.wikitable > tr > th,
.dark .wiki-preview table.wikitable > * > tr > th {
  background-color: #27272a;
  border-color: #3f3f46;
}
.wiki-preview table.wikitable > tr > td,
.wiki-preview table.wikitable > * > tr > td {
  padding: 0.4em 0.6em;
  border: 1px solid #a2a9b1;
}
.dark .wiki-preview table.wikitable > tr > td,
.dark .wiki-preview table.wikitable > * > tr > td {
  border-color: #3f3f46;
}

/* Disambiguation & Hatnotes */
.wiki-preview .hatnote,
.wiki-preview .dablink,
.wiki-preview .rellink {
  font-style: italic;
  padding: 0.35em 0.7em 0.35em 1.6em;
  margin-bottom: 0.6em;
  color: #54595d;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}
.dark .wiki-preview .hatnote,
.dark .wiki-preview .dablink,
.dark .wiki-preview .rellink {
  color: #a1a1aa;
  background-color: rgba(255, 255, 255, 0.03);
}

/* Citations & Reference Lists */
.wiki-preview .reference {
  font-size: 0.8em;
  line-height: 1;
  vertical-align: super;
  padding-left: 1px;
}
.wiki-preview .mw-references-wrap,
.wiki-preview .references {
  font-size: 0.85em;
  line-height: 1.5;
  column-count: 2;
  column-gap: 2em;
}
@media (max-width: 640px) {
  .wiki-preview .mw-references-wrap,
  .wiki-preview .references {
    column-count: 1;
  }
  .wiki-preview .infobox,
  .wiki-preview table.infobox {
    float: none;
    width: 100%;
    margin-left: 0;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>