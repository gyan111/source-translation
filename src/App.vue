<template>
  <div :class="{ dark: isDark }" class="min-h-screen flex flex-col bg-surface-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors duration-300">
    <HeaderBar :isDark="isDark" :user="user" @toggle-dark-mode="toggleDarkMode" @update:user="user = $event" />
    <main class="flex-1 w-full">
      <SourceTranslation :user="user" />
    </main>
    <FooterBar />
  </div>
</template>

<script>
import HeaderBar from './components/HeaderBar.vue';
import SourceTranslation from './components/SourceTranslation.vue';
import FooterBar from './components/FooterBar.vue';
import { isRtlLanguage } from './i18n.js';

export default {
  name: 'App',
  components: {
    HeaderBar,
    SourceTranslation,
    FooterBar,
  },
  data() {
    return {
      isDark: false,
      user: null,
    };
  },
  watch: {
    '$i18n.locale'(newLocale) {
      this.updateDocumentDirection(newLocale);
    },
  },
  methods: {
    toggleDarkMode() {
      this.isDark = !this.isDark;
      localStorage.setItem('dark-mode', this.isDark ? 'true' : 'false');
      this.applyDarkMode();
    },
    applyDarkMode() {
      if (this.isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },
    updateDocumentDirection(locale) {
      const isRtl = isRtlLanguage(locale);
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', locale || 'en');
    },
    async fetchUser() {
      try {
        const response = await fetch('/auth/user');
        if (response.ok) {
          const data = await response.json();
          if (data && data.username) {
            this.user = data;
          }
        }
      } catch (e) {
        // Not logged in, that's fine
      }
    },
  },
  created() {
    // Apply UI RTL / LTR direction based on current locale
    this.updateDocumentDirection(this.$i18n.locale);

    // Restore dark mode preference
    const saved = localStorage.getItem('dark-mode');
    if (saved === 'true') {
      this.isDark = true;
    } else if (saved === null) {
      // Check system preference
      this.isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.applyDarkMode();

    // Check if user is logged in
    this.fetchUser();
  },
};
</script>

<style>
@import './assets/tailwind.css';
</style>
