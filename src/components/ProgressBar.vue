<template>
    <div v-if="showProgressBar" class="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-opacity-50 bg-gray-500 dark:bg-opacity-70 dark:bg-gray-900 backdrop-blur-sm transition-all duration-300">
      <div class="w-1/2 bg-gray-300 dark:bg-gray-700 rounded-extra-large overflow-hidden shadow-md">
        <div class="bg-gradient-to-r from-blue-start to-blue-end text-xs leading-none py-2 text-center text-white rounded-extra-large" :style="{ width: progressBarWidth + '%' }">Translating...</div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      showProgressBar: Boolean,
      progressBarWidth: Number
    }
  };
  </script>
  