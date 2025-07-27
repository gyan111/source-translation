<template>
  <div id="app" class="relative">
    <div class="absolute top-4 right-4 z-10">
      <ThemeToggle />
    </div>
    <SourceTranslation />
  </div>
</template>

<script>
import SourceTranslation from './components/SourceTranslation.vue';
import ThemeToggle from './components/ThemeToggle.vue';

export default {
  name: 'App',
  components: {
    SourceTranslation,
    ThemeToggle
  }
}
</script>

<style>
@import './assets/tailwind.css';
</style>
