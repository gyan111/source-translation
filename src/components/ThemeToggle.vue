<template>
  <button @click="toggleTheme" class="theme-toggle-btn rounded-full p-2 transition-all duration-300 transform hover:scale-110 shadow-md hover:shadow-lg">
    <svg v-if="isDarkMode" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  </button>
</template>

<script>
export default {
  data() {
    return {
      isDarkMode: false
    };
  },
  mounted() {
    // Check if user has a theme preference stored
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
      this.applyTheme();
    } else {
      // Check if user prefers dark mode
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode = prefersDark;
      this.applyTheme();
    }
  },
  methods: {
    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      this.applyTheme();
    },
    applyTheme() {
      // Apply theme to document
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }
};
</script>

<style scoped>
.theme-toggle-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 9999px;
  color: white;
}

.theme-toggle-btn:hover {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
}

.dark .theme-toggle-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.dark .theme-toggle-btn:hover {
  background: linear-gradient(135deg, #f97316, #ea580c);
}
</style>