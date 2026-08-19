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

            <!-- Rendered HTML Tab -->
            <div v-else-if="activeTab === 'rendered'" v-html="previewHtml" :dir="isTargetRtl ? 'rtl' : 'ltr'" class="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm"></div>

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

<style scoped>
.border-3 {
  border-width: 3px;
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