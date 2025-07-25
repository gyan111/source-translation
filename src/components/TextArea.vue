<template>
    <div :class="{'border-red-500': textareaError}" class="w-full md:w-1/2 bg-gray-200 p-4 rounded-lg shadow">
      <textarea :value="textareaValue" @input="$emit('update:textareaValue', $event.target.value)" class="w-full p-4 border border-gray-300 rounded" rows="8" placeholder="Type something..."></textarea>
    </div>
  </template>
  
  <script>
  export default {
    props: {
      textareaValue: String,
      textareaError: Boolean
    }
  };
  </script>
  