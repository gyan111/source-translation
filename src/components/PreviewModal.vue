<template>
    <div v-if="showPreview" class="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-opacity-50 bg-gray-500 dark:bg-opacity-70 dark:bg-gray-900 backdrop-blur-sm transition-all duration-300">
      <div class="bg-white dark:bg-gray-800 p-4 rounded-extra-large shadow-lg max-w-3xl w-full border border-gray-200 dark:border-gray-700 transform transition-all duration-300">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">Article Preview</h2>
          <button @click="closePreview" class="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">&times;</button>
        </div>
        <div v-if="previewLoading" class="flex justify-center items-center h-64">
          <div class="loader"></div>
        </div>
        <div v-else v-html="previewHtml" class="overflow-y-auto dark:text-gray-200" style="max-height: 70vh;"></div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      showPreview: Boolean,
      previewLoading: Boolean,
      previewHtml: String
    },
    methods: {
      closePreview() {
        this.$emit('close-preview');
      }
    }
  };
  </script>
  