<template>
  <div class="card-elevated p-4 sm:p-5 animate-fade-in" :style="{ animationDelay: `${index * 50}ms` }">
    <!-- Section header -->
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        §{{ index + 1 }}
      </span>
      <div class="flex items-center gap-2">
        <span v-if="status === 'translated'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
          <span class="material-icons-round text-xs">check_circle</span>
          {{ $t('paragraph.translated') }}
        </span>
        <span v-else-if="status === 'translating'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-medium animate-pulse-soft">
          <span class="material-icons-round text-xs">hourglass_empty</span>
          {{ $t('paragraph.translating') }}
        </span>
        <span v-else-if="status === 'error'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium">
          <span class="material-icons-round text-xs">error</span>
          Error
        </span>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      <!-- Source (left) -->
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-1.5">
          <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-800 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
              <span class="material-icons-round text-[12px] mr-0.5 opacity-70">visibility</span>
              {{ $t('paragraph.source') }}
            </span>
          </label>
          <span class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Read-Only</span>
        </div>
        <textarea
          :value="source"
          readonly
          class="textarea-field flex-1 bg-slate-100/70 dark:bg-zinc-950/60 text-slate-700 dark:text-zinc-300 min-h-[110px] border-slate-200 dark:border-white/[0.06] font-mono text-xs leading-relaxed focus:ring-0 focus:border-slate-300 dark:focus:border-white/10"
          rows="4"
        ></textarea>
      </div>

      <!-- Translation (right) -->
      <div class="flex flex-col">
        <div class="flex items-center justify-between mb-1.5">
          <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-primary-100/80 dark:bg-primary-950/80 text-[10px] font-bold text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60">
              <span class="material-icons-round text-[12px] mr-0.5">edit</span>
              {{ $t('paragraph.translation') }}
            </span>
          </label>
          <button
            v-if="status !== 'translating'"
            @click="$emit('translate-paragraph', index)"
            class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/40"
          >
            <span class="material-icons-round text-sm">translate</span>
            {{ $t('paragraph.translate') }}
          </button>
        </div>
        <textarea
          :value="translation"
          @input="$emit('update-translation', index, $event.target.value)"
          @click="handleTranslationClick"
          class="textarea-field flex-1 min-h-[110px] bg-white dark:bg-zinc-900/90 border-primary-200/90 dark:border-primary-500/25 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-zinc-100 font-sans text-sm shadow-sm"
          :class="{ 'cursor-pointer placeholder:text-primary-400/60 dark:placeholder:text-primary-400/40': !translation && status === 'pending' }"
          rows="4"
          :placeholder="$t('paragraph.pending')"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script>
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
  },
  methods: {
    handleTranslationClick() {
      if (!this.translation && this.status === 'pending') {
        this.$emit('translate-paragraph', this.index);
      }
    },
  },
};
</script>
