<template>
  <div
    :id="`paragraph-section-${index}`"
    class="card-elevated p-4 sm:p-5 transition-all duration-300 relative group overflow-hidden"
    :class="[
      status === 'translating'
        ? 'ring-2 ring-primary-500 shadow-xl shadow-primary-500/20 border-primary-500 bg-primary-50/20 dark:bg-primary-950/20'
        : status === 'translated'
          ? 'border-slate-200 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-700/50'
          : 'border-slate-200 dark:border-white/[0.06]'
    ]"
    :style="{ animationDelay: `${index * 40}ms` }"
  >
    <!-- Moving Traveling Light Beam on Translating -->
    <div
      v-if="status === 'translating'"
      class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 overflow-hidden rounded-t-2xl z-10"
    >
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/90 to-transparent animate-shimmer-fast"></div>
    </div>
    <!-- Section Header & Toolbar -->
    <div class="flex items-center justify-between gap-2 mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-500 dark:text-zinc-400 font-mono bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-white/[0.06]">
          §{{ index + 1 }}
        </span>
        
        <!-- Status Badges -->
        <span v-if="status === 'translated'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60">
          <span class="material-icons-round text-xs">check_circle</span>
          {{ $t('paragraph.translated') }}
        </span>
        <span v-else-if="status === 'translating'" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-800/60 animate-pulse">
          <span class="material-icons-round text-xs animate-spin">refresh</span>
          {{ $t('paragraph.translating') }}
        </span>
        <span v-else-if="status === 'error'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800/60">
          <span class="material-icons-round text-xs">error</span>
          Error
        </span>
      </div>

      <!-- Right Action Controls -->
      <div class="flex items-center gap-1.5">
        <!-- View Mode Switcher: Edit vs Preview -->
        <div v-if="translation" class="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-white/[0.06] text-[11px] font-medium mr-1">
          <button
            type="button"
            @click="activeView = 'edit'"
            :class="[
              'px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer',
              activeView === 'edit'
                ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-300 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
            ]"
          >
            <span class="material-icons-round text-[12px]">edit</span>
            Edit
          </button>
          <button
            type="button"
            @click="activeView = 'preview'"
            :class="[
              'px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer',
              activeView === 'preview'
                ? 'bg-white dark:bg-zinc-700 text-primary-600 dark:text-primary-300 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400'
            ]"
          >
            <span class="material-icons-round text-[12px]">visibility</span>
            Preview
          </button>
        </div>

        <!-- Focus / Fullscreen Mode -->
        <button
          type="button"
          @click="openFocusModal"
          class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          title="Open Focus Editor"
        >
          <span class="material-icons-round text-sm">open_in_full</span>
        </button>

        <!-- Re-translate Single Section Button -->
        <button
          v-if="status !== 'translating'"
          type="button"
          @click="$emit('translate-paragraph', index)"
          class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/40 cursor-pointer"
          :title="translation ? 'Re-translate section' : 'Translate section'"
        >
          <span class="material-icons-round text-sm">translate</span>
          <span class="hidden sm:inline">{{ translation ? 'Re-translate' : $t('paragraph.translate') }}</span>
        </button>
      </div>
    </div>

    <!-- Two-Column Side-by-Side Layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      <!-- Source Column (Left) -->
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-1.5">
          <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
              <span class="material-icons-round text-[12px] mr-0.5 opacity-70">visibility</span>
              {{ $t('paragraph.source') }}
            </span>
          </label>
          <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{{ $t('paragraph.readOnly') }}</span>
        </div>
        <textarea
          :value="source"
          readonly
          :dir="isSourceRtl ? 'rtl' : 'ltr'"
          class="textarea-field flex-1 bg-slate-100/70 dark:bg-zinc-950/60 text-slate-700 dark:text-zinc-300 min-h-[130px] border-slate-200 dark:border-white/[0.06] font-mono text-xs leading-relaxed focus:ring-0 focus:border-slate-300 dark:focus:border-white/10 resize-y"
          rows="5"
        ></textarea>
      </div>

      <!-- Translation Column (Right) -->
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-1.5">
          <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-100 dark:bg-primary-900/90 text-[11px] font-bold text-primary-800 dark:text-primary-100 border border-primary-300 dark:border-primary-500/60 shadow-2xs">
              <span class="material-icons-round text-[13px] mr-1 text-primary-600 dark:text-primary-300">edit</span>
              {{ $t('paragraph.translation') }}
            </span>
          </label>
          
          <!-- Wikipedia Quick-Format Toolbar (Header Row) -->
          <div v-if="activeView === 'edit'" class="flex items-center gap-1 bg-slate-100/90 dark:bg-zinc-800/90 px-1.5 py-0.5 rounded-lg border border-slate-200/60 dark:border-white/[0.06]">
            <button
              type="button"
              @click="insertFormat('bold')"
              class="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Bold ('''bold''')"
            >
              B
            </button>
            <button
              type="button"
              @click="insertFormat('italic')"
              class="w-5 h-5 flex items-center justify-center rounded text-xs italic font-serif text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Italic (''italic'')"
            >
              I
            </button>
            <button
              type="button"
              @click="insertFormat('link')"
              class="w-5 h-5 flex items-center justify-center rounded text-xs text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Wikilink ([[Target|Display]])"
            >
              <span class="material-icons-round text-xs">link</span>
            </button>
            <button
              type="button"
              @click="insertFormat('ref')"
              class="w-5 h-5 flex items-center justify-center rounded text-xs text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Reference tag (<ref>...</ref>)"
            >
              <span class="material-icons-round text-xs">format_quote</span>
            </button>
            <button
              type="button"
              @click="insertFormat('heading')"
              class="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Heading (== Title ==)"
            >
              H2
            </button>
          </div>
        </div>

        <!-- Edit Mode: Auto-Expanding Textarea -->
        <div v-if="activeView === 'edit'" class="flex-1 flex flex-col">
          <textarea
            ref="translationTextarea"
            :value="translation"
            @input="handleInput"
            @click="handleTranslationClick"
            :dir="isTargetRtl ? 'rtl' : 'ltr'"
            class="textarea-field flex-1 min-h-[130px] bg-white dark:bg-zinc-900/90 border-primary-200/90 dark:border-primary-500/25 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-zinc-100 font-sans text-sm shadow-sm leading-relaxed"
            :class="{ 'cursor-pointer placeholder:text-primary-400/60 dark:placeholder:text-primary-400/40': !translation && status === 'pending' }"
            rows="5"
            :placeholder="$t('paragraph.pending')"
          ></textarea>
        </div>

        <!-- Preview Mode: True MediaWiki Rendered HTML -->
        <div
          v-else
          :dir="isTargetRtl ? 'rtl' : 'ltr'"
          class="wiki-preview min-h-[130px] p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/[0.08] text-xs sm:text-sm text-slate-800 dark:text-zinc-200 leading-relaxed overflow-y-auto max-h-[400px]"
        >
          <div v-if="previewLoading" class="flex items-center justify-center py-6 gap-2 text-xs text-slate-400">
            <span class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
            <span>Rendering Wikipedia preview...</span>
          </div>
          <div v-else v-html="previewHtml || renderedPreviewHtml"></div>
        </div>
      </div>
    </div>

    <!-- Section Focus / Fullscreen Modal -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="isFocusModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" @click.self="isFocusModalOpen = false">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
          <div class="relative w-full max-w-4xl max-h-[90vh] glass-strong rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-white/[0.1] flex flex-col animate-fade-in overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.08] mb-4">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-mono font-bold text-xs">
                  §{{ index + 1 }}
                </span>
                <div>
                  <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Section Editor</h3>
                  <p class="text-xs text-slate-400 dark:text-zinc-500">Distraction-free editing with instant preview</p>
                </div>
              </div>

              <!-- Quick Format Tools -->
              <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
                <button @click="insertFormat('bold', true)" class="px-2 py-1 rounded-lg text-xs font-bold hover:bg-white dark:hover:bg-zinc-700 transition-colors">B</button>
                <button @click="insertFormat('italic', true)" class="px-2 py-1 rounded-lg text-xs italic font-serif hover:bg-white dark:hover:bg-zinc-700 transition-colors">I</button>
                <button @click="insertFormat('link', true)" class="px-2 py-1 rounded-lg text-xs hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-0.5">
                  <span class="material-icons-round text-xs">link</span> Link
                </button>
                <button @click="insertFormat('ref', true)" class="px-2 py-1 rounded-lg text-xs hover:bg-white dark:hover:bg-zinc-700 transition-colors flex items-center gap-0.5">
                  <span class="material-icons-round text-xs">format_quote</span> Ref
                </button>
              </div>

              <button @click="isFocusModalOpen = false" class="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
                <span class="material-icons-round text-lg">close</span>
              </button>
            </div>

            <!-- Side-by-Side Focus Content -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[350px]">
              <!-- Source -->
              <div class="flex flex-col h-full">
                <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Original Wikitext</span>
                <div class="flex-1 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-white/[0.06] max-h-[55vh] overflow-y-auto">
                  <pre :dir="isSourceRtl ? 'rtl' : 'ltr'" class="text-xs font-mono text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">{{ source }}</pre>
                </div>
              </div>

              <!-- Translation Editor -->
              <div class="flex flex-col h-full">
                <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">Translated Text</span>
                <textarea
                  ref="focusModalTextarea"
                  :value="translation"
                  @input="handleInput"
                  :dir="isTargetRtl ? 'rtl' : 'ltr'"
                  class="textarea-field flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border-primary-300 dark:border-primary-500/40 text-slate-900 dark:text-zinc-100 font-sans text-sm leading-relaxed resize-none shadow-inner max-h-[55vh] overflow-y-auto"
                  placeholder="Enter or edit translation..."
                ></textarea>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.08] flex items-center justify-between">
              <span class="text-xs text-slate-400 dark:text-zinc-500">Press Esc or click Done to return</span>
              <button @click="isFocusModalOpen = false" class="btn-primary text-xs px-5 py-2">
                Done Editing
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'ParagraphSection',
  props: {
    index: Number,
    source: String,
    translation: String,
    status: {
      type: String,
      default: 'pending', // 'pending' | 'translating' | 'translated' | 'error'
    },
    isSourceRtl: {
      type: Boolean,
      default: false,
    },
    isTargetRtl: {
      type: Boolean,
      default: false,
    },
    targetLang: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      activeView: 'edit', // 'edit' | 'preview'
      isFocusModalOpen: false,
      previewHtml: '',
      previewLoading: false,
    };
  },
  computed: {
    renderedPreviewHtml() {
      if (!this.translation) return '<p class="text-slate-400 italic">No translation to preview</p>';
      return this.renderSimpleWikitext(this.translation);
    },
  },
  methods: {
    handleInput(e) {
      this.$emit('update-translation', this.index, e.target.value);
      this.adjustHeight();
    },

    async fetchPreview() {
      if (!this.translation) {
        this.previewHtml = '<p class="text-slate-400 italic">No translation to preview</p>';
        return;
      }

      this.previewLoading = true;
      try {
        const lang = this.targetLang || 'en';
        const res = await axios.post('/preview', {
          text: this.translation,
          language: lang,
        });
        this.previewHtml = res.data?.html || this.renderSimpleWikitext(this.translation);
      } catch {
        this.previewHtml = this.renderSimpleWikitext(this.translation);
      } finally {
        this.previewLoading = false;
      }
    },

    handleTranslationClick() {
      if (!this.translation && this.status === 'pending') {
        this.$emit('translate-paragraph', this.index);
      }
    },

    openFocusModal() {
      this.isFocusModalOpen = true;
    },

    adjustHeight() {
      this.$nextTick(() => {
        const textarea = this.$refs.translationTextarea;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.max(130, textarea.scrollHeight)}px`;
        }
      });
    },

    insertFormat(type, isModal = false) {
      const textarea = isModal ? this.$refs.focusModalTextarea : this.$refs.translationTextarea;
      if (!textarea) return;

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const val = textarea.value || '';
      const selected = val.substring(start, end);

      let before = '';
      let after = '';
      let defaultText = '';

      switch (type) {
        case 'bold':
          before = "'''";
          after = "'''";
          defaultText = 'bold text';
          break;
        case 'italic':
          before = "''";
          after = "''";
          defaultText = 'italic text';
          break;
        case 'link':
          before = '[[';
          after = ']]';
          defaultText = 'Page title';
          break;
        case 'ref':
          before = '<ref>';
          after = '</ref>';
          defaultText = 'Reference source';
          break;
        case 'heading':
          before = '== ';
          after = ' ==\n';
          defaultText = 'Heading';
          break;
      }

      const replacement = selected ? `${before}${selected}${after}` : `${before}${defaultText}${after}`;

      textarea.focus();
      let execSuccess = false;
      try {
        execSuccess = document.execCommand('insertText', false, replacement);
      } catch {
        execSuccess = false;
      }

      if (!execSuccess) {
        const newVal = val.substring(0, start) + replacement + val.substring(end);
        this.$emit('update-translation', this.index, newVal);
      } else {
        this.$emit('update-translation', this.index, textarea.value);
      }

      this.$nextTick(() => {
        textarea.focus();
        const cursor = start + before.length + (selected ? selected.length : defaultText.length);
        textarea.setSelectionRange(cursor, cursor);
        this.adjustHeight();
      });
    },

    renderSimpleWikitext(text) {
      if (!text) return '';
      let html = text
        // Headings
        .replace(/^=== (.+?) ===$/gm, '<h3 class="text-base font-bold text-slate-900 dark:text-zinc-100 my-2">$1</h3>')
        .replace(/^== (.+?) ==$/gm, '<h2 class="text-lg font-bold text-slate-900 dark:text-zinc-100 border-b border-slate-200 dark:border-zinc-800 pb-1 my-2">$1</h2>')
        // Bold & Italic
        .replace(/'''''(.+?)'''''/g, '<strong><em>$1</em></strong>')
        .replace(/'''(.+?)'''/g, '<strong>$1</strong>')
        .replace(/''(.+?)''/g, '<em>$1</em>')
        // Wikilinks [[Target|Label]] & [[Target]]
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">$2</a>')
        .replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">$1</a>')
        // Templates {{...}}
        .replace(/\{\{([^\}]+)\}\}/g, '<span class="inline-block px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 font-mono text-[11px] text-slate-700 dark:text-zinc-300 my-0.5 font-normal">❴❴$1❵❵</span>')
        // Ref tags <ref>...</ref>
        .replace(/<ref[^>]*>([\s\S]*?)<\/ref>/g, '<sup class="text-primary-600 dark:text-primary-400 font-bold px-0.5 cursor-pointer" title="$1">[ref]</sup>')
        .replace(/<ref[^>]*\/>/g, '<sup class="text-primary-600 dark:text-primary-400 font-bold px-0.5">[ref]</sup>')
        // Line breaks
        .replace(/\n\n+/g, '</p><p class="my-2">')
        .replace(/\n/g, '<br>');

      return `<p class="my-1">${html}</p>`;
    },
  },
  mounted() {
    this.adjustHeight();
  },
  watch: {
    translation() {
      this.adjustHeight();
      if (this.activeView === 'preview') {
        this.fetchPreview();
      }
    },
    activeView(newVal) {
      if (newVal === 'preview') {
        this.fetchPreview();
      }
    },
    targetLang() {
      if (this.activeView === 'preview') {
        this.fetchPreview();
      }
    },
  },
};
</script>

<style scoped>
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
