<template>
  <footer class="w-full mt-auto py-4 px-4 text-center text-xs sm:text-sm transition-colors duration-300 border-t border-slate-200/60 dark:border-slate-800/60 glass-subtle text-slate-500 dark:text-slate-400">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
      <!-- Left attribution -->
      <div class="flex items-center gap-1.5 font-medium flex-wrap justify-center">
        <span>Source Translation</span>
        <span class="opacity-40">•</span>
        <span>Created by</span>
        <a
          href="https://meta.wikimedia.org/wiki/User:Jnanaranjan_sahu"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 dark:text-primary-400 hover:underline font-semibold transition-colors duration-200"
        >
          Gyana (Jnanaranjan Sahu)
        </a>
      </div>

      <!-- Right links -->
      <div class="flex items-center flex-wrap justify-center gap-3 sm:gap-4 text-xs">
        <a
          href="https://toolforge.org"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-slate-800 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1"
        >
          <span>⚡ Hosted on Wikimedia Toolforge</span>
        </a>
        <span class="opacity-30 hidden sm:inline">•</span>
        <a
          href="https://github.com/gyan111/source-translation"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          GitHub
        </a>
        <span class="opacity-30 hidden sm:inline">•</span>
        <a
          href="https://github.com/gyan111/source-translation/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          Report Issue
        </a>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: 'FooterBar',
};
</script>
