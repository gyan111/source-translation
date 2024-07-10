<template>
  <div id="app">
    <SourceTranslation />
  </div>
</template>

<script>
import SourceTranslation from './components/SourceTranslation.vue';

export default {
  name: 'App',
  components: {
    SourceTranslation
  }
}
</script>

<style>
@import './assets/tailwind.css';
</style>
