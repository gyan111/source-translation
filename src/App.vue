<template>
  <div id="app">
    <TranslationTool />
  </div>
</template>

<script>
import TranslationTool from './components/SourceTranslation.vue';

export default {
  name: 'App',
  components: {
    TranslationTool
  }
}
</script>

<style>
@import './assets/tailwind.css';
</style>
