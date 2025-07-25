<template>
    <div v-if="showProgressBar" class="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-opacity-50 bg-gray-500">
      <div class="w-1/2 bg-gray-300 rounded-full">
        <div class="bg-blue-500 text-xs leading-none py-1 text-center text-white rounded-full" :style="{ width: progressBarWidth + '%' }">Translating...</div>
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
  