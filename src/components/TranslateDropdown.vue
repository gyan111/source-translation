<template>
  <div class="relative inline-block" ref="dropdownRef">
    <button
      @click="isOpen = !isOpen"
      class="btn-success flex items-center gap-2"
    >
      <span class="material-icons-round text-sm">translate</span>
      <span>{{ selectedLabel }}</span>
      <span class="material-icons-round text-sm transition-transform" :class="{ 'rotate-180': isOpen }">expand_more</span>
    </button>
    <transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute top-full left-0 mt-1 w-52 rounded-xl glass-strong shadow-xl z-30 overflow-hidden animate-slide-down"
      >
        <button
          @click="selectOption('article')"
          class="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2"
        >
          <span class="material-icons-round text-primary-500 text-lg">article</span>
          {{ $t('toolbar.translateArticle') }}
        </button>
        <div class="border-t border-slate-200/50 dark:border-slate-700/50"></div>
        <button
          @click="selectOption('template')"
          class="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors flex items-center gap-2"
        >
          <span class="material-icons-round text-emerald-500 text-lg">code</span>
          {{ $t('toolbar.translateTemplate') }}
        </button>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'TranslateDropdown',
  data() {
    return {
      isOpen: false,
      selected: 'article',
    };
  },
  computed: {
    selectedLabel() {
      return this.selected === 'article'
        ? this.$t('toolbar.translateArticle')
        : this.$t('toolbar.translateTemplate');
    },
  },
  methods: {
    selectOption(option) {
      this.selected = option;
      this.isOpen = false;
      this.$emit('translate', option);
    },
    handleClickOutside(e) {
      if (this.$refs.dropdownRef && !this.$refs.dropdownRef.contains(e.target)) {
        this.isOpen = false;
      }
    },
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
};
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
