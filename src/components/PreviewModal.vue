<template>
    <div v-if="showPreview" class="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-opacity-50 bg-gray-500">
      <div class="bg-white p-4 rounded-lg shadow-lg max-w-3xl w-full">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Article Preview</h2>
          <button @click="closePreview" class="text-gray-700">&times;</button>
        </div>
        <div v-if="previewLoading" class="flex justify-center items-center h-64">
          <div class="loader"></div>
        </div>
        <div v-else v-html="previewHtml" class="overflow-y-auto" style="max-height: 70vh;"></div>
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
  