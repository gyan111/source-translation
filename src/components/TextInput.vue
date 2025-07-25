<template>
    <div class="relative w-full md:w-auto">
      <input v-model="localInputValue" @input="onInput" :class="{'border-red-500': inputError}" type="text" class="w-full md:w-auto px-2 py-2 border border-gray-300 rounded" placeholder="Article/Template">
      <ul v-if="suggestions.length" class="absolute bg-white border border-gray-300 rounded mt-1 w-full max-h-60 overflow-y-auto">
        <li v-for="suggestion in suggestions" :key="suggestion" @click="selectSuggestion(suggestion)" class="px-2 py-1 cursor-pointer hover:bg-gray-200">{{ suggestion }}</li>
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
  