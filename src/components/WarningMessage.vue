<template>
    <transition name="fade">
      <div v-if="message" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
        <span class="block sm:inline">{{ message }}</span>
      </div>
    </transition>
  </template>
  
  <script>
  export default {
    props: {
      message: String
    }
  };
  </script>
  
  <style scoped>
  .transition-opacity {
    transition: opacity 0.5s ease-in-out;
  }
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.5s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }
  </style>
  