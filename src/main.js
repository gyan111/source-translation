import { createApp } from 'vue';
import App from './App.vue';
import i18n from './i18n.js';
import './assets/tailwind.css';

// Automatically reload if a new deployment changed Vite asset chunk hashes
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

const app = createApp(App);
app.use(i18n);
app.mount('#app');