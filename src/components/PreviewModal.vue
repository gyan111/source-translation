<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="showPreview" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closePreview">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-4xl max-h-[85vh] glass-strong rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span class="material-icons-round text-primary-500">preview</span>
              {{ $t('preview.title') }}
            </h2>
            <button @click="closePreview" class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <span class="material-icons-round text-slate-500">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto" style="max-height: calc(85vh - 65px);">
            <div v-if="previewLoading" class="flex flex-col items-center justify-center h-64 gap-4">
              <div class="w-10 h-10 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ $t('preview.loading') }}</p>
            </div>
            <div v-else v-html="previewHtml" class="prose prose-slate dark:prose-invert max-w-none"></div>
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