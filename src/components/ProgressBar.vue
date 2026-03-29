<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="showProgressBar" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

        <!-- Progress Card -->
        <div class="relative glass-strong rounded-2xl shadow-2xl p-8 w-80 animate-fade-in">
          <div class="text-center mb-4">
            <span class="material-icons-round text-4xl text-primary-500 animate-pulse-soft">translate</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500 ease-out"
              :style="{ width: progressBarWidth + '%' }"
            ></div>
          </div>
          <p class="text-center text-sm text-slate-600 dark:text-slate-300 mt-3 font-medium">
            {{ progressBarWidth }}% — Translating...
          </p>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'ProgressBar',
  props: {
    showProgressBar: Boolean,
    progressBarWidth: Number,
  },
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>