<template>
  <header class="sticky top-0 z-40 glass-strong shadow-sm border-b border-slate-200/80 dark:border-white/[0.06]">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
      <!-- Logo & Title -->
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/20">
          <span class="material-icons-round text-white text-lg">translate</span>
        </div>
        <div class="hidden sm:block">
          <h1 class="text-base font-bold text-slate-900 dark:text-zinc-100 leading-tight">{{ $t('app.title') }}</h1>
          <p class="text-xs text-slate-500 dark:text-zinc-400 leading-tight">{{ $t('app.subtitle') }}</p>
        </div>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- UI Language Switcher -->
        <div class="relative">
          <select
            :value="currentLocale"
            @change="changeLocale($event.target.value)"
            class="select-field text-xs py-1.5 pl-3 pr-7 min-w-[90px] bg-slate-100/90 dark:bg-zinc-900 border-slate-200 dark:border-white/[0.08]"
          >
            <option v-for="(name, code) in uiLanguageNames" :key="code" :value="code">
              {{ name }}
            </option>
          </select>
        </div>

        <!-- Dark Mode Toggle -->
        <button
          @click="toggleDarkMode"
          class="p-2 rounded-xl bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-transparent dark:border-white/[0.06] transition-all"
          :title="$t('header.darkMode')"
        >
          <span class="material-icons-round text-lg text-slate-600 dark:text-amber-400">
            {{ isDark ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- Login / User -->
        <button
          v-if="!user"
          @click="login"
          class="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5"
        >
          <span class="material-icons-round text-sm">login</span>
          <span class="hidden sm:inline">{{ $t('header.login') }}</span>
        </button>
        <div v-else class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {{ user.username ? user.username.charAt(0).toUpperCase() : 'U' }}
          </div>
          <span class="hidden sm:inline text-xs font-semibold text-slate-700 dark:text-zinc-200">{{ user.username }}</span>
          <button
            @click="logout"
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
            :title="$t('header.logout')"
          >
            <span class="material-icons-round text-sm">logout</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { uiLanguageNames } from '../i18n.js';

export default {
  name: 'HeaderBar',
  props: {
    isDark: Boolean,
    user: Object,
  },
  data() {
    return {
      uiLanguageNames,
    };
  },
  computed: {
    currentLocale() {
      return this.$i18n.locale;
    },
  },
  methods: {
    toggleDarkMode() {
      this.$emit('toggle-dark-mode');
    },
    changeLocale(locale) {
      this.$i18n.locale = locale;
      localStorage.setItem('ui-locale', locale);
    },
    login() {
      window.location.href = '/auth/login';
    },
    logout() {
      fetch('/auth/logout', { method: 'POST' })
        .then(() => {
          this.$emit('update:user', null);
        })
        .catch(err => console.error('Logout error:', err));
    },
  },
};
</script>
