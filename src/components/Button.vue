<template>
    <button @click="action" :class="['w-full md:w-auto px-4 py-2 font-semibold rounded', customClass]">{{ buttonText }}</button>
  </template>
  
  <script>
  export default {
    props: {
      buttonText: String,
      action: Function,
      customClass: String
    }
  };
  </script>
  