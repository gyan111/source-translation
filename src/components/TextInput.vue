<template>
    <div class="relative w-full md:w-auto">
      <input v-model="localInputValue" @input="onInput" :class="{'border-red-500': inputError}" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200" placeholder="Article/Template">
      <ul v-if="suggestions.length" class="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 w-full max-h-60 overflow-y-auto shadow-lg z-10">
        <li v-for="suggestion in suggestions" :key="suggestion" @click="selectSuggestion(suggestion)" class="px-2 py-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors duration-150">{{ suggestion }}</li>
      </ul>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      inputValue: String,
      inputError: Boolean,
      suggestions: Array
    },
    data() {
      return {
        localInputValue: this.inputValue
      };
    },
    watch: {
      inputValue(newVal) {
        this.localInputValue = newVal;
      }
    },
    methods: {
      onInput(event) {
        this.$emit('update:inputValue', event.target.value);
        this.$emit('fetch-suggestions');  // Emit event to fetch suggestions
      },
      selectSuggestion(suggestion) {
        this.$emit('update:inputValue', suggestion);
        this.$emit('select-suggestion', suggestion);
      }
    }
  };
  </script>
  