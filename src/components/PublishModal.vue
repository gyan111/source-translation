<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-md"></div>

        <!-- Modal Container -->
        <div class="relative w-full max-w-lg glass-strong rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-white/[0.1] flex flex-col animate-fade-in overflow-hidden">
          
          <!-- Header -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.08] mb-5">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <span class="material-icons-round text-xl">publish</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">Publish to Wikipedia</h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400">Publish your translated article to {{ targetLanguageName }} ({{ toLanguage }}.wikipedia.org)</p>
              </div>
            </div>
            <button @click="close" class="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
              <span class="material-icons-round text-lg">close</span>
            </button>
          </div>

          <!-- Success State -->
          <div v-if="publishSuccess" class="py-6 text-center">
            <div class="w-14 h-14 mx-auto mb-3.5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span class="material-icons-round text-3xl">check_circle</span>
            </div>
            <h4 class="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1">Published Successfully!</h4>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mb-5">Your article is now live on {{ toLanguage }}.wikipedia.org</p>
            
            <a
              :href="publishedUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-5 shadow-md mb-3"
            >
              <span>View Article on Wikipedia</span>
              <span class="material-icons-round text-xs">open_in_new</span>
            </a>
            
            <div>
              <button @click="close" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 mt-2">
                Done
              </button>
            </div>
          </div>

          <!-- Main Publishing Form -->
          <div v-else class="space-y-4 text-xs">
            <!-- Article Name Input -->
            <div>
              <label class="field-label mb-1.5 flex items-center justify-between">
                <span>Article Title on Target Wiki</span>
                <span v-if="titleChecking" class="text-[11px] text-slate-400 flex items-center gap-1">
                  <span class="w-3 h-3 border border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                  Checking wiki...
                </span>
              </label>
              
              <div class="relative">
                <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">edit</span>
                <input
                  v-model="targetTitle"
                  @input="onTitleInput"
                  type="text"
                  class="input-field pl-9 py-2.5 text-xs font-semibold bg-white dark:bg-zinc-900 shadow-inner"
                  placeholder="Enter target article title (e.g. Kendrapara)"
                  :disabled="isPublishing"
                  autofocus
                />
              </div>

              <!-- Page Existence Status Indicator -->
              <div v-if="targetTitle.trim()" class="mt-2 text-[11px]">
                <div v-if="pageExists === true" class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <span class="material-icons-round text-xs">warning</span>
                  <span>Page already exists on {{ toLanguage }}.wikipedia.org (Publishing will update/edit it).</span>
                </div>
                <div v-else-if="pageExists === false" class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span class="material-icons-round text-xs">check_circle</span>
                  <span>New page (ready to create on {{ toLanguage }}.wikipedia.org).</span>
                </div>
              </div>
            </div>

            <!-- Error Banner -->
            <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <span class="material-icons-round text-base">error_outline</span>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- Destination Selection Header -->
            <div class="pt-2">
              <label class="field-label mb-2 text-slate-600 dark:text-zinc-300 font-bold uppercase tracking-wider text-[11px]">
                Choose Destination to Publish:
              </label>

              <!-- 3 Destination Action Buttons -->
              <div class="space-y-2.5">
                <!-- 1. Mainspace -->
                <button
                  type="button"
                  @click="executePublish('mainspace')"
                  :disabled="isPublishing || !targetTitle.trim()"
                  class="w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  :class="[
                    targetTitle.trim()
                      ? 'bg-white hover:bg-primary-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] hover:border-primary-400'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/[0.04]'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                      <span class="material-icons-round text-base">public</span>
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>Mainspace (Live Article)</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-semibold">Direct</span>
                      </div>
                      <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {{ toLanguage }}.wikipedia.org/wiki/{{ encodeURIComponent(targetTitle.trim() || 'Title') }}
                      </p>
                    </div>
                  </div>
                  <span v-if="publishingDest === 'mainspace'" class="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                  <span v-else class="material-icons-round text-slate-400 group-hover:text-primary-500 transition-colors">arrow_forward</span>
                </button>

                <!-- 2. User Sandbox -->
                <button
                  type="button"
                  @click="executePublish('sandbox')"
                  :disabled="isPublishing || !targetTitle.trim()"
                  class="w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  :class="[
                    targetTitle.trim()
                      ? 'bg-white hover:bg-amber-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] hover:border-amber-400'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/[0.04]'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <span class="material-icons-round text-base">science</span>
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>User Sandbox (Draft)</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold">Safe</span>
                      </div>
                      <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {{ toLanguage }}.wikipedia.org/wiki/User:{{ user?.username || 'User' }}/{{ encodeURIComponent(targetTitle.trim() || 'Title') }}
                      </p>
                    </div>
                  </div>
                  <span v-if="publishingDest === 'sandbox'" class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                  <span v-else class="material-icons-round text-slate-400 group-hover:text-amber-500 transition-colors">arrow_forward</span>
                </button>

                <!-- 3. Draft Namespace -->
                <button
                  type="button"
                  @click="executePublish('draft')"
                  :disabled="isPublishing || !targetTitle.trim()"
                  class="w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  :class="[
                    targetTitle.trim()
                      ? 'bg-white hover:bg-indigo-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] hover:border-indigo-400'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/[0.04]'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                      <span class="material-icons-round text-base">edit_note</span>
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-zinc-100">Draft: Namespace</div>
                      <p class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {{ toLanguage }}.wikipedia.org/wiki/Draft:{{ encodeURIComponent(targetTitle.trim() || 'Title') }}
                      </p>
                    </div>
                  </div>
                  <span v-if="publishingDest === 'draft'" class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></span>
                  <span v-else class="material-icons-round text-slate-400 group-hover:text-indigo-500 transition-colors">arrow_forward</span>
                </button>
              </div>
            </div>

            <!-- Footer / Disclaimers -->
            <div class="pt-3 border-t border-slate-200/60 dark:border-white/[0.08] text-[11px] text-slate-400 dark:text-zinc-500 flex items-center justify-between">
              <span>Logged in as <strong>{{ user?.username }}</strong></span>
              <button @click="close" class="hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
import axios from 'axios';
import debounce from 'lodash/debounce';

export default {
  name: 'PublishModal',
  props: {
    showModal: Boolean,
    user: Object,
    defaultTitle: {
      type: String,
      default: '',
    },
    toLanguage: {
      type: String,
      default: 'en',
    },
    targetLanguageName: {
      type: String,
      default: 'Target Wiki',
    },
    fullTranslatedText: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      targetTitle: '',
      isPublishing: false,
      publishingDest: null,
      publishSuccess: false,
      publishedUrl: '',
      errorMessage: '',
      titleChecking: false,
      pageExists: null,
    };
  },
  watch: {
    showModal(val) {
      if (val) {
        this.targetTitle = this.defaultTitle || '';
        this.publishSuccess = false;
        this.errorMessage = '';
        if (this.targetTitle.trim()) {
          this.checkPageExistence(this.targetTitle.trim());
        }
      }
    },
    defaultTitle(val) {
      if (val && !this.targetTitle) {
        this.targetTitle = val;
        this.checkPageExistence(val.trim());
      }
    },
  },
  created() {
    this.debouncedCheck = debounce((title) => {
      this.checkPageExistence(title);
    }, 400);
  },
  methods: {
    close() {
      this.isPublishing = false;
      this.publishingDest = null;
      this.$emit('close');
    },

    onTitleInput() {
      this.pageExists = null;
      if (this.targetTitle.trim()) {
        this.titleChecking = true;
        this.debouncedCheck(this.targetTitle.trim());
      } else {
        this.titleChecking = false;
      }
    },

    async checkPageExistence(title) {
      if (!title || !this.toLanguage) {
        this.titleChecking = false;
        this.pageExists = null;
        return;
      }

      this.titleChecking = true;
      try {
        const url = `https://${this.toLanguage}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query?.pages || {};
        const pageId = Object.keys(pages)[0];

        if (pageId && pageId !== '-1' && !pages[pageId].missing) {
          this.pageExists = true;
        } else {
          this.pageExists = false;
        }
      } catch {
        this.pageExists = null;
      } finally {
        this.titleChecking = false;
      }
    },

    async executePublish(dest) {
      const rawTitle = this.targetTitle.trim();
      if (!rawTitle) {
        this.errorMessage = 'Please enter an article title';
        return;
      }

      let finalTitle = rawTitle;
      if (dest === 'sandbox') {
        const username = this.user?.username || 'User';
        finalTitle = `User:${username}/${rawTitle}`;
      } else if (dest === 'draft') {
        finalTitle = `Draft:${rawTitle}`;
      }

      this.isPublishing = true;
      this.publishingDest = dest;
      this.errorMessage = '';

      try {
        const response = await axios.post('/publish', {
          text: this.fullTranslatedText,
          language: this.toLanguage,
          title: finalTitle,
        });

        if (response.data && response.data.success) {
          this.publishSuccess = true;
          this.publishedUrl = `https://${this.toLanguage}.wikipedia.org/wiki/${encodeURIComponent(finalTitle)}`;
          this.$emit('published', { title: finalTitle, url: this.publishedUrl });
        } else {
          this.errorMessage = 'Publishing failed. Please try again.';
        }
      } catch (err) {
        console.error('Publish error:', err);
        this.errorMessage = err.response?.data?.message || err.message || 'An error occurred during publishing.';
      } finally {
        this.isPublishing = false;
        this.publishingDest = null;
      }
    },
  },
};
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
