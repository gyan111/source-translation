<template>
  <div :class="{ dark: isDark }" class="min-h-screen flex flex-col bg-surface-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors duration-300">
    <HeaderBar 
      :isDark="isDark" 
      :user="user" 
      @toggle-dark-mode="toggleDarkMode" 
      @update:user="user = $event" 
      @open-analytics="showAdminStats = true"
    />
    <main class="flex-1 w-full">
      <SourceTranslation :user="user" @session-expired="handleSessionExpired" />
    </main>
    <FooterBar />

    <!-- Admin Analytics Modal -->
    <AdminStatsModal 
      :isOpen="showAdminStats" 
      @close="showAdminStats = false" 
    />
  </div>
</template>

<script>
import HeaderBar from './components/HeaderBar.vue';
import SourceTranslation from './components/SourceTranslation.vue';
import FooterBar from './components/FooterBar.vue';
import AdminStatsModal from './components/AdminStatsModal.vue';
import { isRtlLanguage } from './i18n.js';

export default {
  name: 'App',
  components: {
    HeaderBar,
    SourceTranslation,
    FooterBar,
    AdminStatsModal,
  },
  data() {
    return {
      isDark: false,
      user: null,
      showAdminStats: false,
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
    lastUserFetchTime: 0,
    async fetchUser(force = false) {
      const now = Date.now();
      if (!force && now - this.lastUserFetchTime < 10000) {
        return; // Throttle to at most once per 10 seconds
      }
      this.lastUserFetchTime = now;

      try {
        const response = await fetch('/auth/user', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data && data.username) {
            this.user = data;
            try {
              localStorage.setItem('wiki_user', JSON.stringify(data));
            } catch (e) {}
            return;
          }
        }
        // Explicitly unauthenticated response from server
        this.user = null;
        try {
          localStorage.removeItem('wiki_user');
        } catch (e) {}
      } catch (e) {
        // Transient network error - preserve existing cached user if available
      }
    },
    handleVisibilityOrFocus() {
      if (document.visibilityState === 'visible') {
        this.fetchUser();
      }
    },
    handleSessionExpired() {
      this.user = null;
      try {
        localStorage.removeItem('wiki_user');
      } catch (e) {}
    },
  },
  created() {
    // Apply UI RTL / LTR direction based on current locale
    this.updateDocumentDirection(this.$i18n.locale);

    // Restore cached user optimistically to prevent UI flashing
    try {
      const cachedUser = localStorage.getItem('wiki_user');
      if (cachedUser) {
        this.user = JSON.parse(cachedUser);
      }
    } catch (e) {}

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
    this.fetchUser(true);
  },
  mounted() {
    // Re-validate session when user switches back to this tab
    document.addEventListener('visibilitychange', this.handleVisibilityOrFocus);
  },
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.handleVisibilityOrFocus);
  },
};
</script>

<style>
@import './assets/tailwind.css';
</style>
