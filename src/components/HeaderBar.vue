<template>
  <header class="sticky top-0 z-40 glass-strong shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
      <!-- Logo & Title -->
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/30">
          <span class="material-icons-round text-white text-lg">translate</span>
        </div>
        <div class="hidden sm:block">
          <h1 class="text-lg font-bold text-slate-800 dark:text-white leading-tight">{{ $t('app.title') }}</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-tight">{{ $t('app.subtitle') }}</p>
        </div>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- UI Language Switcher -->
        <div class="relative">
          <select
            :value="currentLocale"
            @change="changeLocale($event.target.value)"
            class="select-field text-xs py-2 pl-3 pr-8 min-w-[90px]"
          >
            <option v-for="(name, code) in uiLanguageNames" :key="code" :value="code">
              {{ name }}
            </option>
          </select>
        </div>

        <!-- Dark Mode Toggle -->
        <button
          @click="toggleDarkMode"
          class="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
          :title="$t('header.darkMode')"
        >
          <span class="material-icons-round text-lg text-slate-600 dark:text-yellow-400">
            {{ isDark ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- Login / User -->
        <button
          v-if="!user"
          @click="login"
          class="btn-primary text-xs flex items-center gap-1.5"
        >
          <span class="material-icons-round text-sm">login</span>
          <span class="hidden sm:inline">{{ $t('header.login') }}</span>
        </button>
        <div v-else class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
            {{ user.username ? user.username.charAt(0).toUpperCase() : 'U' }}
          </div>
          <span class="hidden sm:inline text-sm font-medium text-slate-700 dark:text-slate-300">{{ user.username }}</span>
          <button
            @click="logout"
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            :title="$t('header.logout')"
          >
            <span class="material-icons-round text-sm text-slate-500">logout</span>
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
