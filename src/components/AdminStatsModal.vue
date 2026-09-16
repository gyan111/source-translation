<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" @click.self="close">
    <div class="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-gray-100 animate-scale-up">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/95 sticky top-0 z-10">
        <div class="flex items-center space-x-3">
          <div class="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <span class="material-icons text-2xl">leaderboard</span>
          </div>
          <div>
            <h2 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300">
              Tool Usage & Contributor Analytics
            </h2>
            <p class="text-xs text-gray-400">Telemetry, editor leaderboard, conversion rates & translation activity (Admin)</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <button 
            @click="fetchStats" 
            :disabled="loading"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex items-center space-x-1 border border-gray-700 cursor-pointer"
            title="Refresh statistics"
          >
            <span class="material-icons text-sm" :class="{ 'animate-spin': loading }">refresh</span>
            <span>Refresh</span>
          </button>
          <button 
            @click="close" 
            class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span class="material-icons text-lg">close</span>
          </button>
        </div>
      </div>

      <!-- Content Body -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
        
        <!-- Loading State -->
        <div v-if="loading && !stats" class="py-20 text-center text-gray-400 flex flex-col items-center justify-center space-y-3">
          <span class="material-icons text-4xl animate-spin text-indigo-400">sync</span>
          <p class="text-sm">Fetching analytics and contributor records...</p>
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
              <span>Running in memory fallback mode. Configure MariaDB envvars to persist data across tool restarts.</span>
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
                <div class="text-[11px] text-emerald-400/80 mt-0.5">
                  {{ calculatePercentage(stats.summary?.totals?.publishes, stats.summary?.totals?.translates) }}% publish rate
                </div>
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
                  {{ formatNumber(stats.summary?.totals?.exportsAndCopies || 0) }}
                </div>
                <div class="text-[11px] text-blue-400/80 mt-0.5">Wikitext exported or copied</div>
              </div>
            </div>

            <!-- Card 4: Unique Editors -->
            <div class="p-4 bg-gradient-to-br from-purple-950/30 to-gray-850/90 border border-purple-800/40 rounded-xl flex flex-col justify-between relative overflow-hidden">
              <div class="flex items-center justify-between text-purple-400">
                <span class="text-xs font-semibold uppercase tracking-wider">Active Editors</span>
                <span class="material-icons text-purple-400 text-lg">people</span>
              </div>
              <div class="mt-3">
                <div class="text-2xl font-black text-purple-300 tracking-tight">
                  {{ formatNumber(stats.summary?.totals?.uniqueUsers || stats.summary?.topContributors?.length || 0) }}
                </div>
                <div class="text-[11px] text-purple-400/80 mt-0.5">Logged-in Wikimedia users</div>
              </div>
            </div>

          </div>

          <!-- Section: Top Contributors Leaderboard -->
          <div class="p-5 bg-gray-850/90 border border-gray-700/70 rounded-xl space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="material-icons text-amber-400 text-lg">military_tech</span>
                <h3 class="text-sm font-bold text-gray-200">Top Contributors Leaderboard</h3>
              </div>
              <span class="text-xs text-gray-400">Click any user card to view detailed contributor profile</span>
            </div>

            <div v-if="!stats.summary?.topContributors?.length" class="text-xs text-gray-500 py-6 text-center">
              No authenticated user contributions recorded yet. (Guest edits are marked as Anonymous).
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div 
                v-for="(editor, index) in stats.summary.topContributors" 
                :key="editor.wikiUser"
                @click="openUserDetails(editor.wikiUser)"
                class="p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/5"
                :class="selectedUser === editor.wikiUser ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-gray-800/70 hover:bg-gray-800 border-gray-750'"
              >
                <div class="flex items-center space-x-3 truncate">
                  <!-- Rank Badge -->
                  <div 
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                    :class="[
                      index === 0 ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' :
                      index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40' :
                      index === 2 ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40' :
                      'bg-gray-750 text-gray-400'
                    ]"
                  >
                    {{ index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}` }}
                  </div>
                  <div class="truncate">
                    <div class="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 truncate flex items-center space-x-1.5">
                      <span>{{ editor.wikiUser }}</span>
                      <span class="material-icons text-[12px] opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity">account_circle</span>
                    </div>
                    <div class="text-[10px] text-gray-400 flex items-center space-x-2 mt-0.5">
                      <span>{{ editor.publishes }} published</span>
                      <span>•</span>
                      <span>{{ formatNumber(editor.totalWords) }} words</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center space-x-1 shrink-0">
                  <button
                    @click.stop="filterByUser(editor.wikiUser)"
                    class="p-1 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-gray-700/60 transition-colors"
                    :class="{ 'text-indigo-400 bg-indigo-500/20': selectedUser === editor.wikiUser }"
                    title="Filter activity table by this editor"
                  >
                    <span class="material-icons text-sm">filter_alt</span>
                  </button>
                  <a 
                    :href="`https://meta.wikimedia.org/wiki/Special:Contributions/${encodeURIComponent(editor.wikiUser)}`" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    @click.stop 
                    class="p-1 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-gray-700/60 transition-colors"
                    title="View user's Wikimedia contributions"
                  >
                    <span class="material-icons text-sm">open_in_new</span>
                  </a>
                  <span class="material-icons text-gray-500 text-sm group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">chevron_right</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Languages, Engines, & Efficiency Insights -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            
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

            <!-- MT Engines -->
            <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl">
              <h3 class="text-sm font-semibold text-gray-200 flex items-center space-x-2 mb-4">
                <span class="material-icons text-base text-pink-400">smart_toy</span>
                <span>Translation Engines</span>
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

            <!-- Efficiency & Volume Metrics -->
            <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl flex flex-col justify-between space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-gray-200 flex items-center space-x-2 mb-3">
                  <span class="material-icons text-base text-emerald-400">insights</span>
                  <span>Volume & Conversion</span>
                </h3>
                
                <div class="space-y-3 text-xs">
                  <div class="flex justify-between py-1.5 border-b border-gray-750">
                    <span class="text-gray-400">Total Words Translated:</span>
                    <strong class="text-gray-200 font-mono">{{ formatNumber(stats.summary?.totals?.totalWords || 0) }}</strong>
                  </div>
                  <div class="flex justify-between py-1.5 border-b border-gray-750">
                    <span class="text-gray-400">Unique Articles:</span>
                    <strong class="text-gray-200 font-mono">{{ formatNumber(stats.summary?.totals?.uniqueArticles || 0) }}</strong>
                  </div>
                  <div class="flex justify-between py-1.5 border-b border-gray-750">
                    <span class="text-gray-400">Avg Words / Article:</span>
                    <strong class="text-gray-200 font-mono">
                      {{ stats.summary?.totals?.uniqueArticles ? Math.round((stats.summary?.totals?.totalWords || 0) / stats.summary.totals.uniqueArticles) : 0 }}
                    </strong>
                  </div>
                  <div class="flex justify-between py-1.5">
                    <span class="text-gray-400">Mainspace vs Sandbox:</span>
                    <strong class="text-emerald-400 font-mono">
                      {{ stats.summary?.namespaceDistribution?.find(n => n.namespace === 'mainspace')?.count || 0 }} live / {{ stats.summary?.namespaceDistribution?.find(n => n.namespace === 'sandbox')?.count || 0 }} draft
                    </strong>
                  </div>
                </div>
              </div>

              <div class="p-2.5 bg-gray-800 rounded-lg text-[11px] text-gray-400 flex items-center space-x-2">
                <span class="material-icons text-indigo-400 text-sm">verified_user</span>
                <span>All edits link to verified Wikimedia accounts</span>
              </div>
            </div>

          </div>

          <!-- Section: Activity Feed with User Filter, Search, Language Filter, Sorting & Pagination -->
          <div class="p-5 bg-gray-850/80 border border-gray-700/60 rounded-xl space-y-4">
            
            <!-- Controls Header: Title, Search, Language, Action Tabs -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div class="flex items-center space-x-2 shrink-0">
                <span class="material-icons text-base text-emerald-400">history</span>
                <h3 class="text-sm font-semibold text-gray-200">Recent Translation & Publish Activity</h3>
              </div>
              
              <div class="flex flex-wrap items-center gap-2">
                <!-- Search Input -->
                <div class="relative min-w-[200px] flex-1 sm:flex-initial">
                  <span class="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
                  <input 
                    v-model="searchQuery" 
                    @input="onSearchInput"
                    type="text" 
                    placeholder="Search title or user..." 
                    class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button 
                    v-if="searchQuery" 
                    @click="clearSearch"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    <span class="material-icons text-xs">close</span>
                  </button>
                </div>

                <!-- Target Language Filter Dropdown -->
                <div class="relative">
                  <select 
                    v-model="selectedLanguage" 
                    @change="onLanguageChange"
                    class="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500 cursor-pointer appearance-none pr-7"
                  >
                    <option value="all">All Target Languages</option>
                    <option v-for="lang in availableLanguages" :key="lang" :value="lang">
                      {{ lang.toUpperCase() }}
                    </option>
                  </select>
                  <span class="material-icons absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">arrow_drop_down</span>
                </div>

                <!-- Filter Tabs -->
                <div class="flex items-center space-x-1 bg-gray-800 p-1 rounded-lg text-[11px]">
                  <button 
                    v-for="filter in ['all', 'publish', 'translate', 'export']" 
                    :key="filter"
                    @click="setActiveFilter(filter)"
                    class="px-2.5 py-1 rounded capitalize transition-colors cursor-pointer"
                    :class="activeFilter === filter ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'"
                  >
                    {{ filter === 'export' ? 'Exports / Copies' : filter }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Active Filters Chips -->
            <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-800/60">
              <span class="text-[11px] text-gray-500">Active filters:</span>
              
              <!-- User Filter Chip -->
              <span v-if="selectedUser" class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium">
                <span>User: {{ selectedUser }}</span>
                <button @click="clearUserFilter" class="hover:text-white ml-1 cursor-pointer">✕</button>
              </span>

              <!-- Action Filter Chip -->
              <span v-if="activeFilter !== 'all'" class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium capitalize">
                <span>Action: {{ activeFilter }}</span>
                <button @click="setActiveFilter('all')" class="hover:text-white ml-1 cursor-pointer">✕</button>
              </span>

              <!-- Target Language Chip -->
              <span v-if="selectedLanguage !== 'all'" class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium">
                <span>Target: {{ selectedLanguage.toUpperCase() }}</span>
                <button @click="clearLanguageFilter" class="hover:text-white ml-1 cursor-pointer">✕</button>
              </span>

              <!-- Search Query Chip -->
              <span v-if="searchQuery" class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-medium">
                <span>"{{ searchQuery }}"</span>
                <button @click="clearSearch" class="hover:text-white ml-1 cursor-pointer">✕</button>
              </span>

              <!-- Reset All Filters -->
              <button 
                @click="resetAllFilters" 
                class="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer ml-1"
              >
                Reset all
              </button>
            </div>

            <!-- Events Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="border-b border-gray-750 text-gray-400 font-medium uppercase text-[10px] tracking-wider select-none">
                    <!-- Column: Time -->
                    <th 
                      @click="toggleSort('createdAt')" 
                      class="py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      title="Sort by time"
                    >
                      <div class="flex items-center space-x-1">
                        <span>Time</span>
                        <span class="material-icons text-xs" :class="sortBy === 'createdAt' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>

                    <!-- Column: User -->
                    <th 
                      @click="toggleSort('wikiUser')" 
                      class="py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      title="Sort by user"
                    >
                      <div class="flex items-center space-x-1">
                        <span>User</span>
                        <span class="material-icons text-xs" :class="sortBy === 'wikiUser' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'wikiUser' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>

                    <!-- Column: Action -->
                    <th 
                      @click="toggleSort('eventType')" 
                      class="py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      title="Sort by action"
                    >
                      <div class="flex items-center space-x-1">
                        <span>Action</span>
                        <span class="material-icons text-xs" :class="sortBy === 'eventType' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'eventType' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>

                    <!-- Column: Languages -->
                    <th 
                      @click="toggleSort('sourceLang')" 
                      class="py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      title="Sort by languages"
                    >
                      <div class="flex items-center space-x-1">
                        <span>Languages</span>
                        <span class="material-icons text-xs" :class="sortBy === 'sourceLang' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'sourceLang' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>

                    <!-- Column: Article Title -->
                    <th 
                      @click="toggleSort('targetTitle')" 
                      class="py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      title="Sort by article title"
                    >
                      <div class="flex items-center space-x-1">
                        <span>Article Title</span>
                        <span class="material-icons text-xs" :class="sortBy === 'targetTitle' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'targetTitle' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>

                    <!-- Column: Details / Words -->
                    <th 
                      @click="toggleSort('wordCount')" 
                      class="py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors group"
                      title="Sort by word count"
                    >
                      <div class="flex items-center justify-end space-x-1">
                        <span>Details</span>
                        <span class="material-icons text-xs" :class="sortBy === 'wordCount' ? 'text-indigo-400' : 'text-gray-600 opacity-40 group-hover:opacity-100'">
                          {{ sortBy === 'wordCount' ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/80">
                  <tr v-if="!eventsList.length">
                    <td colspan="6" class="py-10 text-center text-gray-500 text-xs">
                      No activity recorded matching your filters.
                    </td>
                  </tr>
                  <tr v-for="event in eventsList" :key="event.id || (event.createdAt + (event.wikiUser || '') + (event.targetTitle || ''))" class="hover:bg-gray-800/50 transition-colors">
                    <td class="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {{ formatTime(event.createdAt) }}
                    </td>
                    <td class="py-2.5 px-3 font-medium whitespace-nowrap">
                      <div v-if="event.wikiUser && event.wikiUser !== 'anonymous'" class="inline-flex items-center space-x-1.5">
                        <span 
                          @click="openUserDetails(event.wikiUser)"
                          class="text-indigo-300 hover:text-indigo-200 hover:underline cursor-pointer inline-flex items-center space-x-1"
                          title="View contributor profile details"
                        >
                          <span>{{ event.wikiUser }}</span>
                          <span class="material-icons text-[12px] opacity-70">account_circle</span>
                        </span>
                        <button 
                          @click.stop="filterByUser(event.wikiUser)"
                          class="p-0.5 rounded text-gray-500 hover:text-indigo-300 hover:bg-gray-700/60 transition-colors cursor-pointer"
                          :class="{ 'text-indigo-400': selectedUser === event.wikiUser }"
                          title="Filter activity by this editor"
                        >
                          <span class="material-icons text-[11px]">filter_alt</span>
                        </button>
                        <a 
                          :href="`https://${event.targetLang || 'meta'}.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(event.wikiUser)}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          @click.stop
                          class="text-gray-500 hover:text-indigo-300 transition-colors inline-flex items-center"
                          title="View user contributions on Wikipedia"
                        >
                          <span class="material-icons text-[12px]">open_in_new</span>
                        </a>
                      </div>
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
                    <td class="py-2.5 px-3 max-w-[220px] truncate text-gray-200" :title="event.targetTitle || event.sourceTitle">
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
                        {{ formatNumber(event.wordCount) }} words
                      </span>
                      <span v-else class="text-gray-600 text-[11px]">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination Bar -->
            <div class="pt-4 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
              <!-- Info & Page Size -->
              <div class="flex items-center space-x-3">
                <span>
                  Showing 
                  <strong class="text-gray-200 font-semibold">{{ paginationStart }}</strong>
                  to 
                  <strong class="text-gray-200 font-semibold">{{ paginationEnd }}</strong>
                  of 
                  <strong class="text-gray-200 font-semibold">{{ formatNumber(pagination.total) }}</strong>
                  events
                </span>
                <div class="flex items-center space-x-1.5 border-l border-gray-700 pl-3">
                  <span>Rows per page:</span>
                  <select 
                    v-model="pageSize" 
                    @change="onPageSizeChange(pageSize)"
                    class="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option :value="10">10</option>
                    <option :value="25">25</option>
                    <option :value="50">50</option>
                    <option :value="100">100</option>
                  </select>
                </div>
              </div>

              <!-- Pagination Controls -->
              <div class="flex items-center space-x-1 self-center sm:self-auto">
                <button 
                  @click="changePage(1)" 
                  :disabled="currentPage === 1"
                  class="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="First Page"
                >
                  <span class="material-icons text-sm">first_page</span>
                </button>
                <button 
                  @click="changePage(currentPage - 1)" 
                  :disabled="currentPage === 1"
                  class="px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center space-x-1"
                  title="Previous Page"
                >
                  <span class="material-icons text-sm">chevron_left</span>
                  <span>Prev</span>
                </button>

                <!-- Page Buttons -->
                <div class="flex items-center space-x-1 px-1">
                  <button 
                    v-for="(p, i) in visiblePages" 
                    :key="i"
                    @click="typeof p === 'number' && changePage(p)"
                    :disabled="typeof p !== 'number'"
                    class="min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
                    :class="p === currentPage ? 'bg-indigo-600 text-white shadow-sm' : typeof p === 'number' ? 'border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer' : 'text-gray-600 cursor-default'"
                  >
                    {{ p }}
                  </button>
                </div>

                <button 
                  @click="changePage(currentPage + 1)" 
                  :disabled="currentPage >= pagination.totalPages"
                  class="px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center space-x-1"
                  title="Next Page"
                >
                  <span>Next</span>
                  <span class="material-icons text-sm">chevron_right</span>
                </button>
                <button 
                  @click="changePage(pagination.totalPages)" 
                  :disabled="currentPage >= pagination.totalPages"
                  class="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Last Page"
                >
                  <span class="material-icons text-sm">last_page</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-3 border-t border-gray-800 bg-gray-900/95 flex items-center justify-between text-xs text-gray-500">
        <div class="flex items-center space-x-2">
          <span class="inline-block w-2 h-2 rounded-full" :class="stats?.summary?.databaseConnected ? 'bg-emerald-500' : 'bg-amber-500'"></span>
          <span>{{ stats?.summary?.databaseConnected ? 'MariaDB Telemetry Connected' : 'In-Memory Telemetry' }}</span>
        </div>
        <button @click="close" class="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors font-medium cursor-pointer">
          Close
        </button>
      </div>

    </div>

    <!-- Contributor Profile Details Modal -->
    <ContributorDetailsModal
      :isOpen="showUserModal"
      :username="selectedDetailUser"
      @close="showUserModal = false"
      @filter-by-user="handleFilterByUserFromModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import ContributorDetailsModal from './ContributorDetailsModal.vue';

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

// Filtering & Sorting State
const activeFilter = ref('all');
const selectedUser = ref(null);
const selectedLanguage = ref('all');
const searchQuery = ref('');
const sortBy = ref('createdAt');
const sortOrder = ref('desc');

// Pagination State
const currentPage = ref(1);
const pageSize = ref(25);
const pagination = ref({
  total: 0,
  totalPages: 1,
  page: 1,
  limit: 25,
});

// Contributor Details Modal State
const selectedDetailUser = ref(null);
const showUserModal = ref(false);

const openUserDetails = (username) => {
  if (!username || username === 'anonymous') return;
  selectedDetailUser.value = username;
  showUserModal.value = true;
};

const handleFilterByUserFromModal = (username) => {
  showUserModal.value = false;
  filterByUser(username);
};

// Available target languages for the filter dropdown
const availableLanguages = computed(() => {
  const set = new Set();
  if (stats.value?.summary?.languageDistribution) {
    stats.value.summary.languageDistribution.forEach(l => {
      if (l.language) set.add(l.language.toLowerCase());
    });
  }
  if (stats.value?.recentEvents) {
    stats.value.recentEvents.forEach(e => {
      if (e.targetLang) set.add(e.targetLang.toLowerCase());
    });
  }
  return Array.from(set).sort();
});

const hasActiveFilters = computed(() => {
  return (
    !!selectedUser.value ||
    activeFilter.value !== 'all' ||
    selectedLanguage.value !== 'all' ||
    !!searchQuery.value.trim()
  );
});

const eventsList = computed(() => {
  return stats.value?.recentEvents || [];
});

const paginationStart = computed(() => {
  if (!pagination.value.total) return 0;
  return (currentPage.value - 1) * pageSize.value + 1;
});

const paginationEnd = computed(() => {
  if (!pagination.value.total) return 0;
  return Math.min(currentPage.value * pageSize.value, pagination.value.total);
});

const visiblePages = computed(() => {
  const total = pagination.value.totalPages || 1;
  const current = currentPage.value;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [];
  pages.push(1);
  if (current > 3) {
    pages.push('...');
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) {
    pages.push('...');
  }
  pages.push(total);
  return pages;
});

const fetchStats = async () => {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    params.set('page', currentPage.value.toString());
    params.set('limit', pageSize.value.toString());
    params.set('sortBy', sortBy.value);
    params.set('sortOrder', sortOrder.value);

    if (selectedUser.value) params.set('user', selectedUser.value);
    if (activeFilter.value !== 'all') params.set('eventType', activeFilter.value);
    if (selectedLanguage.value && selectedLanguage.value !== 'all') params.set('targetLang', selectedLanguage.value);
    if (searchQuery.value && searchQuery.value.trim()) params.set('search', searchQuery.value.trim());

    const res = await fetch(`/api/admin/stats?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('You do not have administrative privileges to view analytics.');
      }
      throw new Error(`Failed to load stats (${res.status})`);
    }
    const data = await res.json();
    stats.value = data;
    
    if (data.pagination) {
      pagination.value = data.pagination;
    } else {
      pagination.value = {
        total: data.recentEvents?.length || 0,
        page: currentPage.value,
        limit: pageSize.value,
        totalPages: Math.max(1, Math.ceil((data.recentEvents?.length || 0) / pageSize.value)),
      };
    }
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

const filterByUser = (username) => {
  if (!username || username === 'anonymous') return;
  selectedUser.value = username;
  currentPage.value = 1;
  fetchStats();
};

const clearUserFilter = () => {
  selectedUser.value = null;
  currentPage.value = 1;
  fetchStats();
};

const setActiveFilter = (filter) => {
  activeFilter.value = filter;
  currentPage.value = 1;
  fetchStats();
};

const onLanguageChange = () => {
  currentPage.value = 1;
  fetchStats();
};

const clearLanguageFilter = () => {
  selectedLanguage.value = 'all';
  currentPage.value = 1;
  fetchStats();
};

let searchDebounceTimer = null;
const onSearchInput = () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1;
    fetchStats();
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  currentPage.value = 1;
  fetchStats();
};

const resetAllFilters = () => {
  selectedUser.value = null;
  activeFilter.value = 'all';
  selectedLanguage.value = 'all';
  searchQuery.value = '';
  currentPage.value = 1;
  fetchStats();
};

const toggleSort = (column) => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = column;
    sortOrder.value = column === 'createdAt' || column === 'wordCount' ? 'desc' : 'asc';
  }
  currentPage.value = 1;
  fetchStats();
};

const changePage = (page) => {
  if (page < 1 || page > (pagination.value.totalPages || 1) || page === currentPage.value) return;
  currentPage.value = page;
  fetchStats();
};

const onPageSizeChange = (size) => {
  pageSize.value = Number(size);
  currentPage.value = 1;
  fetchStats();
};

const close = () => {
  emit('close');
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
