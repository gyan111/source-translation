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
      <div>
        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
          {{ $t('paragraph.source') }}
        </label>
        <textarea
          :value="source"
          readonly
          class="textarea-field bg-slate-50 dark:bg-slate-800/50 min-h-[100px]"
          rows="4"
        ></textarea>
      </div>

      <!-- Translation (right) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {{ $t('paragraph.translation') }}
          </label>
          <button
            v-if="status !== 'translating'"
            @click="$emit('translate-paragraph', index)"
            class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center gap-1"
          >
            <span class="material-icons-round text-sm">translate</span>
            {{ $t('paragraph.translate') }}
          </button>
        </div>
        <textarea
          :value="translation"
          @input="$emit('update-translation', index, $event.target.value)"
          @click="handleTranslationClick"
          class="textarea-field min-h-[100px]"
          :class="{ 'cursor-pointer': !translation && status === 'pending' }"
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
