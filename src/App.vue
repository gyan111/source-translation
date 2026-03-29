<template>
  <div :class="{ dark: isDark }" class="min-h-screen">
    <HeaderBar :isDark="isDark" :user="user" @toggle-dark-mode="toggleDarkMode" @update:user="user = $event" />
    <SourceTranslation />
    <FooterBar />
  </div>
</template>

<script>
import HeaderBar from './components/HeaderBar.vue';
import SourceTranslation from './components/SourceTranslation.vue';
import FooterBar from './components/FooterBar.vue';

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
