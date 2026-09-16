<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in" @click.self="close">
    <div class="bg-gray-900 border border-gray-700/80 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-gray-100 animate-scale-up">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/95 sticky top-0 z-10">
        <div class="flex items-center space-x-3.5">
          <!-- Avatar / User Badge -->
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-black text-base shadow-sm">
            {{ userInitial }}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-lg font-bold text-white tracking-tight">
                {{ username }}
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Contributor
              </span>
            </div>
            <div class="flex items-center space-x-3 text-xs text-gray-400 mt-0.5">
              <span>Wikimedia Community Member</span>
              <span>•</span>
              <div class="flex items-center space-x-2">
                <a 
                  :href="`https://meta.wikimedia.org/wiki/User:${encodeURIComponent(username)}`" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center space-x-0.5"
                  title="View User Page on Meta-Wiki"
                >
                  <span>User Page</span>
                  <span class="material-icons text-[12px]">open_in_new</span>
                </a>
                <span>•</span>
                <a 
                  :href="`https://meta.wikimedia.org/wiki/Special:Contributions/${encodeURIComponent(username)}`" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center space-x-0.5"
                  title="View user contributions on Wikimedia"
                >
                  <span>Contributions</span>
                  <span class="material-icons text-[12px]">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button 
            @click="fetchUserDetails" 
            :disabled="loading"
            class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
            title="Refresh contributor records"
          >
            <span class="material-icons text-base" :class="{ 'animate-spin': loading }">refresh</span>
          </button>
          <button 
            @click="close" 
            class="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span class="material-icons text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Content Body -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
        
        <!-- Loading State -->
        <div v-if="loading && !details" class="py-20 text-center text-gray-400 flex flex-col items-center justify-center space-y-3">
          <span class="material-icons text-4xl animate-spin text-indigo-400">sync</span>
          <p class="text-sm">Loading contributor details for {{ username }}...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl text-red-300 flex items-center space-x-3">
          <span class="material-icons text-red-400">error_outline</span>
          <div class="text-sm">
            <p class="font-semibold">Unable to load contributor records</p>
            <p class="text-xs text-red-400/80">{{ error }}</p>
          </div>
        </div>

        <div v-else-if="details" class="space-y-6">
          
          <!-- Key Metric Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            
            <!-- Published -->
            <div class="p-4 bg-gray-850/90 border border-emerald-800/40 rounded-2xl flex flex-col justify-between">
              <div class="flex items-center justify-between text-emerald-400">
                <span class="text-[11px] font-semibold uppercase tracking-wider">Published</span>
                <span class="material-icons text-base">public</span>
              </div>
              <div class="mt-2.5">
                <div class="text-2xl font-black text-emerald-300 tracking-tight">
                  {{ formatNumber(details.totals?.publishes || 0) }}
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">Wikipedia articles</div>
              </div>
            </div>

            <!-- Words Translated -->
            <div class="p-4 bg-gray-850/90 border border-purple-800/40 rounded-2xl flex flex-col justify-between">
              <div class="flex items-center justify-between text-purple-400">
                <span class="text-[11px] font-semibold uppercase tracking-wider">Words Translated</span>
                <span class="material-icons text-base">spellcheck</span>
              </div>
              <div class="mt-2.5">
                <div class="text-2xl font-black text-purple-300 tracking-tight">
                  {{ formatNumber(details.totals?.totalWords || 0) }}
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">{{ formatNumber(details.totals?.totalChars || 0) }} characters</div>
              </div>
            </div>

            <!-- Translations -->
            <div class="p-4 bg-gray-850/90 border border-indigo-800/40 rounded-2xl flex flex-col justify-between">
              <div class="flex items-center justify-between text-indigo-400">
                <span class="text-[11px] font-semibold uppercase tracking-wider">Translations</span>
                <span class="material-icons text-base">translate</span>
              </div>
              <div class="mt-2.5">
                <div class="text-2xl font-black text-indigo-300 tracking-tight">
                  {{ formatNumber(details.totals?.translates || 0) }}
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">Drafted in tool</div>
              </div>
            </div>

            <!-- Publish Rate -->
            <div class="p-4 bg-gray-850/90 border border-blue-800/40 rounded-2xl flex flex-col justify-between">
              <div class="flex items-center justify-between text-blue-400">
                <span class="text-[11px] font-semibold uppercase tracking-wider">Publish Rate</span>
                <span class="material-icons text-base">insights</span>
              </div>
              <div class="mt-2.5">
                <div class="text-2xl font-black text-blue-300 tracking-tight">
                  {{ conversionRate }}%
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">Published / Translated</div>
              </div>
            </div>

          </div>

          <!-- Language Pairs & Engines Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Target Languages -->
            <div class="p-5 bg-gray-850/90 border border-gray-700/70 rounded-2xl">
              <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2 mb-3.5">
                <span class="material-icons text-sm text-indigo-400">language</span>
                <span>Language Pairs Translated</span>
              </h3>
              <div v-if="!details.languages?.length" class="text-xs text-gray-500 py-4 text-center">
                No language records found.
              </div>
              <div v-else class="space-y-3">
                <div v-for="lang in details.languages" :key="lang.pair" class="space-y-1">
                  <div class="flex justify-between text-xs font-medium">
                    <span class="text-gray-200 font-mono">{{ lang.pair }}</span>
                    <span class="text-gray-400">{{ lang.count }} actions ({{ formatNumber(lang.words) }} words)</span>
                  </div>
                  <div class="w-full bg-gray-750 rounded-full h-1.5 overflow-hidden">
                    <div 
                      class="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500" 
                      :style="{ width: `${calculatePercentage(lang.count, details.totals?.totalEvents)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Translation Engines & Activity Period -->
            <div class="p-5 bg-gray-850/90 border border-gray-700/70 rounded-2xl flex flex-col justify-between space-y-4">
              <div>
                <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2 mb-3.5">
                  <span class="material-icons text-sm text-pink-400">smart_toy</span>
                  <span>Translation Engines Used</span>
                </h3>
                <div v-if="!details.engines?.length" class="text-xs text-gray-500 py-3 text-center">
                  No engine records found.
                </div>
                <div v-else class="flex flex-wrap gap-2">
                  <div 
                    v-for="eng in details.engines" 
                    :key="eng.engine"
                    class="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700/80 text-xs flex items-center space-x-1.5"
                  >
                    <span class="capitalize text-gray-200 font-medium">{{ eng.engine }}</span>
                    <span class="px-1.5 py-0.2 rounded-md bg-gray-750 text-[10px] text-gray-400 font-mono">{{ eng.count }}</span>
                  </div>
                </div>
              </div>

              <!-- Activity Timeline -->
              <div class="p-3 bg-gray-800/80 border border-gray-750 rounded-xl text-xs space-y-1.5">
                <div class="flex justify-between text-gray-400">
                  <span>First active:</span>
                  <span class="text-gray-200 font-medium">{{ formatTime(details.totals?.firstActive) }}</span>
                </div>
                <div class="flex justify-between text-gray-400">
                  <span>Last active:</span>
                  <span class="text-gray-200 font-medium">{{ formatTime(details.totals?.lastActive) }}</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Recent Articles Table -->
          <div class="p-5 bg-gray-850/90 border border-gray-700/70 rounded-2xl space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-2">
                <span class="material-icons text-sm text-emerald-400">article</span>
                <span>Recent Translations & Publishes by {{ username }}</span>
              </h3>
              <span class="text-xs text-gray-500">{{ details.recentArticles?.length || 0 }} entries</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-gray-750 text-gray-400 font-medium uppercase text-[10px] tracking-wider">
                    <th class="py-2.5 px-3">Date</th>
                    <th class="py-2.5 px-3">Action</th>
                    <th class="py-2.5 px-3">Language</th>
                    <th class="py-2.5 px-3">Article Title</th>
                    <th class="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/80">
                  <tr v-if="!details.recentArticles?.length">
                    <td colspan="5" class="py-6 text-center text-gray-500 text-xs">
                      No recorded articles for this contributor.
                    </td>
                  </tr>
                  <tr v-for="art in details.recentArticles" :key="art.id || art.createdAt" class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {{ formatTime(art.createdAt) }}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      <span 
                        class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        :class="getActionBadgeClass(art.eventType)"
                      >
                        {{ art.eventType }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 font-mono text-gray-300 whitespace-nowrap">
                      {{ art.sourceLang }} → <span class="text-indigo-300 font-semibold">{{ art.targetLang }}</span>
                    </td>
                    <td class="py-2.5 px-3 max-w-[220px] truncate text-gray-200" :title="art.targetTitle || art.sourceTitle">
                      <a 
                        v-if="art.eventType === 'publish'"
                        :href="`https://${art.targetLang}.wikipedia.org/wiki/${encodeURIComponent(art.targetTitle || art.sourceTitle)}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="hover:text-indigo-300 hover:underline flex items-center space-x-1 truncate"
                      >
                        <span class="truncate">{{ art.targetTitle || art.sourceTitle }}</span>
                        <span class="material-icons text-[11px] opacity-60">open_in_new</span>
                      </a>
                      <span v-else>{{ art.targetTitle || art.sourceTitle }}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                      <a 
                        v-if="art.revisionId" 
                        :href="`https://${art.targetLang}.wikipedia.org/w/index.php?diff=${art.revisionId}`" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium text-[11px] underline"
                      >
                        <span>Diff (r{{ art.revisionId }})</span>
                        <span class="material-icons text-[10px]">open_in_new</span>
                      </a>
                      <span v-else-if="art.wordCount" class="text-gray-400 font-mono">
                        {{ formatNumber(art.wordCount) }} words
                      </span>
                      <span v-else class="text-gray-600">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-3.5 border-t border-gray-800 bg-gray-900/95 flex items-center justify-between text-xs">
        <button 
          @click="filterMainTable"
          class="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl transition-colors font-medium flex items-center space-x-1.5 cursor-pointer"
        >
          <span class="material-icons text-sm">filter_alt</span>
          <span>Filter Main Table by {{ username }}</span>
        </button>

        <button 
          @click="close" 
          class="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition-colors font-medium cursor-pointer"
        >
          Close
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  username: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['close', 'filter-by-user']);

const details = ref(null);
const loading = ref(false);
const error = ref(null);

const userInitial = computed(() => {
  return props.username ? props.username.charAt(0).toUpperCase() : '?';
});

const conversionRate = computed(() => {
  const pub = details.value?.totals?.publishes || 0;
  const trans = details.value?.totals?.translates || 0;
  if (!trans && !pub) return 0;
  return Math.min(100, Math.round((pub / Math.max(1, trans + pub)) * 100));
});

const fetchUserDetails = async () => {
  if (!props.username) return;
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/admin/user/${encodeURIComponent(props.username)}`);
    if (!res.ok) {
      throw new Error(`Failed to load user details (${res.status})`);
    }
    const data = await res.json();
    details.value = data.userDetails;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (open) => {
  if (open && props.username) {
    fetchUserDetails();
  }
});

watch(() => props.username, (newVal) => {
  if (props.isOpen && newVal) {
    fetchUserDetails();
  }
});

const close = () => {
  emit('close');
};

const filterMainTable = () => {
  emit('filter-by-user', props.username);
  close();
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString();
};

const calculatePercentage = (count, total) => {
  if (!total || total === 0 || !count) return 0;
  return Math.min(100, Math.round((count / total) * 100));
};

const formatTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActionBadgeClass = (eventType) => {
  switch (eventType) {
    case 'publish':
      return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
    case 'translate':
      return 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400';
    case 'copy':
      return 'bg-blue-500/10 border border-blue-500/30 text-blue-400';
    case 'export':
      return 'bg-pink-500/10 border border-pink-500/30 text-pink-400';
    default:
      return 'bg-gray-500/10 border border-gray-500/30 text-gray-400';
  }
};
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 1);
}
</style>
