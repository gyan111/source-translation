<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click.self="close">
    <div class="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-gray-100 animate-scale-up">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90 sticky top-0 z-10">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <span class="material-icons text-2xl">analytics</span>
          </div>
          <div>
            <h2 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300">
              Tool Usage & Activity Analytics
            </h2>
            <p class="text-xs text-gray-400">Real-time MariaDB telemetry & translation tracking dashboard (Admin Only)</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button 
            @click="fetchStats" 
            :disabled="loading"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex items-center space-x-1 border border-gray-700"
            title="Refresh statistics"
          >
            <span class="material-icons text-sm" :class="{ 'animate-spin': loading }">refresh</span>
            <span>Refresh</span>
          </button>
          <button 
            @click="close" 
            class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <span class="material-icons text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Content Body -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
        
        <!-- Loading State -->
        <div v-if="loading && !stats" class="py-16 text-center text-gray-400 flex flex-col items-center justify-center space-y-3">
          <span class="material-icons text-4xl animate-spin text-indigo-400">sync</span>
          <p class="text-sm">Fetching analytics data from database...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 flex items-center space-x-3">
          <span class="material-icons text-red-400">error_outline</span>
          <div class="text-sm">
            <p class="font-semibold">Unable to load statistics</p>
            <p class="text-xs text-red-400/80">{{ error }}</p>
          </div>
        </div>

        <div v-else-if="stats" class="space-y-6">
          
          <!-- Database status banner if in-memory fallback -->
          <div v-if="!stats.summary?.databaseConnected" class="px-4 py-2.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300/90 text-xs flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="material-icons text-sm text-amber-400">info</span>
              <span>Running in memory fallback mode. Connect MySQL/MariaDB for persistent history across restarts.</span>
            </div>
            <span class="px-2 py-0.5 bg-amber-900/60 rounded text-[10px] uppercase tracking-wider font-semibold">Memory Mode</span>
          </div>

          <!-- Top Metric Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <!-- Card 1: Total Translations Started -->
            <div class="p-4 bg-gradient-to-br from-gray-800/90 to-gray-850/90 border border-gray-700/60 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div class="flex items-center justify-between text-gray-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Translations</span>
                <span class="material-icons text-indigo-400 text-lg">translate</span>
              </div>
              <div class="mt-3">
                <div class="text-2xl font-black text-white tracking-tight">
                  {{ formatNumber(stats.summary?.totals?.translates || stats.summary?.totals?.totalEvents || 0) }}
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">Articles processed</div>
              </div>
            </div>

            <!-- Card 2: Published to Wikipedia -->
            <div class="p-4 bg-gradient-to-br from-emerald-950/30 to-gray-850/90 border border-emerald-800/40 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div class="flex items-center justify-between text-emerald-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Published</span>
                <span class="material-icons text-emerald-400 text-lg">public</span>
              </div>
              <div class="mt-3">
                <div class="text-2xl font-black text-emerald-300 tracking-tight">
                  {{ formatNumber(stats.summary?.totals?.publishes || 0) }}
                </div>
                <div class="text-[11px] text-emerald-400/80 mt-0.5">Direct on-wiki edits</div>
              </div>
            </div>

            <!-- Card 3: Direct Exports & Copies -->
            <div class="p-4 bg-gradient-to-br from-blue-950/30 to-gray-850/90 border border-blue-800/40 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div class="flex items-center justify-between text-blue-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Exports & Copies</span>
                <span class="material-icons text-blue-400 text-lg">content_copy</span>
              </div>
              <div class="mt-3">
                <div class="text-2xl font-black text-blue-300 tracking-tight">
                  {{ formatNumber(stats.summary?.totals?.exportsAndCopies || (stats.summary?.totals?.copies || 0) + (stats.summary?.totals?.exports || 0)) }}
                </div>
                <div class="text-[11px] text-blue-400/80 mt-0.5">Wikitext exports & clips</div>
              </div>
            </div>

            <!-- Card 4: Unique Editors -->
            <div class="p-4 bg-gradient-to-br from-purple-950/30 to-gray-850/90 border border-purple-800/40 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div class="flex items-center justify-between text-purple-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Editors</span>
                <span class="material-icons text-purple-400 text-lg">people</span>
              </div>
              <div class="mt-3">
                <div class="text-2xl font-black text-purple-300 tracking-tight">
                  {{ formatNumber(stats.summary?.totals?.uniqueUsers || 0) }}
                </div>
                <div class="text-[11px] text-purple-400/80 mt-0.5">Authenticated users</div>
              </div>
            </div>

          </div>

          <!-- Mid Section: Language Distribution & MT Engines -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <!-- Language Distribution -->
            <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl">
              <h3 class="text-sm font-semibold text-gray-200 flex items-center space-x-2 mb-4">
                <span class="material-icons text-base text-indigo-400">language</span>
                <span>Top Target Languages</span>
              </h3>
              <div v-if="!stats.summary?.languageDistribution?.length" class="text-xs text-gray-500 py-4 text-center">
                No language data recorded yet.
              </div>
              <div v-else class="space-y-3">
                <div v-for="item in stats.summary.languageDistribution" :key="item.language" class="space-y-1">
                  <div class="flex justify-between text-xs font-medium">
                    <span class="text-gray-300 uppercase tracking-wide font-mono">{{ item.language }}</span>
                    <span class="text-gray-400">{{ item.count }} actions</span>
                  </div>
                  <div class="w-full bg-gray-750 rounded-full h-1.5 overflow-hidden">
                    <div 
                      class="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500" 
                      :style="{ width: `${calculatePercentage(item.count, stats.summary.totals?.totalEvents)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- MT Engines & Destinations -->
            <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl flex flex-col justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-200 flex items-center space-x-2 mb-4">
                  <span class="material-icons text-base text-pink-400">smart_toy</span>
                  <span>Translation Engines Used</span>
                </h3>
                <div v-if="!stats.summary?.engineDistribution?.length" class="text-xs text-gray-500 py-4 text-center">
                  No engine data recorded yet.
                </div>
                <div v-else class="space-y-3">
                  <div v-for="item in stats.summary.engineDistribution" :key="item.engine" class="space-y-1">
                    <div class="flex justify-between text-xs font-medium">
                      <span class="text-gray-300 capitalize">{{ item.engine || 'Google Translate' }}</span>
                      <span class="text-gray-400">{{ item.count }} uses</span>
                    </div>
                    <div class="w-full bg-gray-750 rounded-full h-1.5 overflow-hidden">
                      <div 
                        class="bg-gradient-to-r from-pink-500 to-amber-500 h-1.5 rounded-full transition-all duration-500" 
                        :style="{ width: `${calculatePercentage(item.count, stats.summary.totals?.totalEvents)}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Conversion / Destination Summary -->
              <div class="mt-5 pt-4 border-t border-gray-750/80 flex items-center justify-between text-xs text-gray-400">
                <span>Words Translated: <strong class="text-gray-200 font-mono">{{ formatNumber(stats.summary?.totals?.totalWords || 0) }}</strong></span>
                <span>Articles Touched: <strong class="text-gray-200 font-mono">{{ formatNumber(stats.summary?.totals?.uniqueArticles || 0) }}</strong></span>
              </div>
            </div>

          </div>

          <!-- Bottom Section: Recent Activity Feed -->
          <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-gray-200 flex items-center space-x-2">
                <span class="material-icons text-base text-emerald-400">history</span>
                <span>Recent Translation & Publish Activity</span>
              </h3>
              
              <!-- Filter Tabs -->
              <div class="flex items-center space-x-1 bg-gray-800 p-1 rounded-lg text-[11px]">
                <button 
                  v-for="filter in ['all', 'publish', 'translate', 'export']" 
                  :key="filter"
                  @click="activeFilter = filter"
                  class="px-2.5 py-1 rounded capitalize transition-colors"
                  :class="activeFilter === filter ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'"
                >
                  {{ filter === 'export' ? 'Exports / Copies' : filter }}
                </button>
              </div>
            </div>

            <!-- Events Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-gray-750 text-gray-400 font-medium uppercase text-[10px] tracking-wider">
                    <th class="py-2.5 px-3">Time</th>
                    <th class="py-2.5 px-3">User</th>
                    <th class="py-2.5 px-3">Action</th>
                    <th class="py-2.5 px-3">Languages</th>
                    <th class="py-2.5 px-3">Article Title</th>
                    <th class="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/80">
                  <tr v-if="!filteredEvents.length">
                    <td colspan="6" class="py-8 text-center text-gray-500 text-xs">
                      No activity recorded matching this filter.
                    </td>
                  </tr>
                  <tr v-for="event in filteredEvents" :key="event.id || event.createdAt" class="hover:bg-gray-800/50 transition-colors">
                    <td class="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {{ formatTime(event.createdAt) }}
                    </td>
                    <td class="py-2.5 px-3 font-medium whitespace-nowrap">
                      <span v-if="event.wikiUser && event.wikiUser !== 'anonymous'" class="text-indigo-300 hover:underline cursor-pointer">
                        {{ event.wikiUser }}
                      </span>
                      <span v-else class="text-gray-500 italic">Anonymous</span>
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap">
                      <span 
                        class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center space-x-1"
                        :class="getActionBadgeClass(event.eventType)"
                      >
                        <span>{{ event.eventType }}</span>
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-gray-300 font-mono whitespace-nowrap">
                      <span class="text-gray-400">{{ event.sourceLang }}</span>
                      <span class="text-gray-600 mx-1">→</span>
                      <span class="text-indigo-300 font-semibold">{{ event.targetLang }}</span>
                    </td>
                    <td class="py-2.5 px-3 max-w-[200px] truncate text-gray-200" :title="event.targetTitle || event.sourceTitle">
                      {{ event.targetTitle || event.sourceTitle }}
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap">
                      <a 
                        v-if="event.revisionId" 
                        :href="`https://${event.targetLang}.wikipedia.org/w/index.php?diff=${event.revisionId}`" 
                        target="_blank" 
                        class="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium text-[11px] underline ml-2"
                      >
                        <span>Diff (r{{ event.revisionId }})</span>
                        <span class="material-icons text-[10px]">open_in_new</span>
                      </a>
                      <span v-else-if="event.wordCount" class="text-gray-500 text-[11px]">
                        {{ event.wordCount }} words
                      </span>
                      <span v-else class="text-gray-600 text-[11px]">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-3 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between text-xs text-gray-500">
        <div class="flex items-center space-x-2">
          <span class="inline-block w-2 h-2 rounded-full" :class="stats?.summary?.databaseConnected ? 'bg-emerald-500' : 'bg-amber-500'"></span>
          <span>{{ stats?.summary?.databaseConnected ? 'MariaDB Live' : 'In-Memory Telemetry' }}</span>
        </div>
        <button @click="close" class="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors font-medium">
          Close
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close']);

const stats = ref(null);
const loading = ref(false);
const error = ref(null);
const activeFilter = ref('all');

const fetchStats = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('You do not have administrative privileges to view analytics.');
      }
      throw new Error(`Failed to load stats (${res.status})`);
    }
    const data = await res.json();
    stats.value = data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (open) => {
  if (open) {
    fetchStats();
  }
});

const close = () => {
  emit('close');
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString();
};

const calculatePercentage = (count, total) => {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((count / total) * 100));
};

const formatTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  
  // Format as short date and time e.g. "Aug 25, 14:32"
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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
    case 'start':
    default:
      return 'bg-gray-500/10 border border-gray-500/30 text-gray-400';
  }
};

const filteredEvents = computed(() => {
  const events = stats.value?.recentEvents || [];
  if (activeFilter.value === 'all') return events;
  if (activeFilter.value === 'export') {
    return events.filter(e => e.eventType === 'copy' || e.eventType === 'export');
  }
  return events.filter(e => e.eventType === activeFilter.value);
});
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
