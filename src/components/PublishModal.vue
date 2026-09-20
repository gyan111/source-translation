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
                <span class="material-icons-round text-xl">{{ publishMode === 'section' ? 'view_agenda' : 'publish' }}</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
                  {{ publishMode === 'section' ? $t('publishModal.publishSectionTitle') : $t('publishModal.publishArticleTitle') }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400">
                  <span v-if="publishMode === 'section' && sectionTitle">
                    {{ $t('publishModal.publishSectionSubtitle', { section: sectionTitle, lang: targetLanguageName, domain: `${toLanguage}.wikipedia.org` }) }}
                  </span>
                  <span v-else>
                    {{ $t('publishModal.publishArticleSubtitle', { lang: targetLanguageName, domain: `${toLanguage}.wikipedia.org` }) }}
                  </span>
                </p>
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
              <button @click="close" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 mt-2 cursor-pointer">
                Done
              </button>
            </div>
          </div>

          <!-- Confirmation State -->
          <div v-else-if="confirmingPublish" class="space-y-4 text-xs animate-fade-in">
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-800 dark:text-zinc-200">
              <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold mb-2">
                <span class="material-icons-round text-lg">help_outline</span>
                <span>Are you sure you want to publish?</span>
              </div>
              <p class="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">
                Please double check the destination and title before publishing to Wikipedia:
              </p>
            </div>

            <!-- Summary Details Card -->
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/[0.08] space-y-2.5">
              <div v-if="publishMode === 'section' && (localSectionTitle || sectionTitle)" class="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                <span class="text-slate-400 font-medium">Section:</span>
                <span class="font-bold text-primary-600 dark:text-primary-400">{{ localSectionTitle || sectionTitle }}</span>
              </div>
              <div v-if="publishMode === 'section'" class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-medium">Placement:</span>
                <span class="font-semibold text-slate-800 dark:text-zinc-200">
                  {{ placementPreviewText }}
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-medium">Destination:</span>
                <span class="font-bold text-slate-800 dark:text-zinc-100 capitalize">{{ selectedDestLabel }}</span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 font-medium">Target Wiki:</span>
                <span class="font-mono text-primary-600 dark:text-primary-400">{{ toLanguage }}.wikipedia.org</span>
              </div>
              <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                <span class="text-slate-400 font-medium">Review Health:</span>
                <span v-if="isFullyReviewed" class="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span class="material-icons-round text-xs">verified</span>
                  100% Reviewed ({{ reviewedCount }}/{{ totalSectionsCount }})
                </span>
                <span v-else class="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span class="material-icons-round text-xs">fact_check</span>
                  {{ reviewedCount }}/{{ totalSectionsCount }} Reviewed
                </span>
              </div>
              <div v-if="modificationPercent > 0" class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                <span class="text-slate-400 font-medium">Human Modification:</span>
                <span class="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span class="material-icons-round text-xs">edit</span>
                  {{ modificationPercent }}% edited
                </span>
              </div>
              <div class="flex flex-col gap-1 text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                <span class="text-slate-400 font-medium">Full Page Title:</span>
                <span class="font-mono font-bold text-slate-800 dark:text-zinc-100 break-all bg-white dark:bg-zinc-950 p-2 rounded-xl border border-slate-200 dark:border-white/[0.06]">
                  {{ finalFormattedTitle }}
                </span>
              </div>
              <!-- Untranslated Skipped Warning Badge in Confirmation -->
              <div v-if="publishMode === 'section' && untranslatedSkippedCount > 0" class="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                <span class="material-icons-round text-xs text-amber-600">shield</span>
                <span>{{ $t('publishModal.untranslatedOmittedBadge', { count: untranslatedSkippedCount }) }}</span>
              </div>
            </div>

            <!-- Mainspace Review Confirmation Checkbox (Anti-Spam / Anti-Vandalism) -->
            <div v-if="selectedDest === 'mainspace' && !isFullyReviewed">
              <label class="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="userAcknowledgedReview"
                  class="mt-0.5 rounded border-amber-400 text-primary-600 focus:ring-primary-500"
                />
                <span>I have read the translated text and confirm it meets Wikipedia's encyclopedic quality standards.</span>
              </label>
            </div>

            <!-- Mainspace Guideline Alert -->
            <div v-else-if="selectedDest === 'mainspace'" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-start gap-2">
              <span class="material-icons-round text-sm mt-0.5">verified</span>
              <span>All sections have been human-reviewed! Your article is ready for live publishing on Wikipedia.</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                @click="confirmingPublish = false"
                class="btn-secondary text-xs py-2 px-4 cursor-pointer"
                :disabled="isPublishing"
              >
                Back
              </button>
              <button
                type="button"
                @click="performFinalPublish"
                :disabled="isPublishing || (selectedDest === 'mainspace' && !isFullyReviewed && !userAcknowledgedReview)"
                class="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="isPublishing" class="material-icons-round text-sm animate-spin">refresh</span>
                <span v-else class="material-icons-round text-sm">check</span>
                <span>{{ isPublishing ? 'Publishing...' : 'Confirm & Publish' }}</span>
              </button>
            </div>
          </div>

          <!-- Main Selection Body -->
          <div v-else class="space-y-4">
            <!-- Article Title Input -->
            <div>
              <label class="field-label mb-1.5 flex items-center justify-between">
                <span>Article Title on Target Wiki</span>
                <span class="text-[11px] text-slate-400 font-normal">
                  <span v-if="titleChecking" class="text-primary-500 flex items-center gap-1">
                    <span class="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                    Checking...
                  </span>
                  <span v-else>Target: {{ toLanguage }}.wikipedia.org</span>
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

            <!-- Section Title Input (when in Section Mode) -->
            <div v-if="publishMode === 'section'">
              <label class="field-label mb-1.5 flex items-center justify-between">
                <span>Section Heading on Target Wiki</span>
                <span class="text-[11px] text-slate-400 font-normal">Heading in {{ targetLanguageName }}</span>
              </label>
              <div class="relative">
                <span class="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">title</span>
                <input
                  v-model="localSectionTitle"
                  type="text"
                  class="input-field pl-9 py-2.5 text-xs font-semibold bg-white dark:bg-zinc-900 shadow-inner"
                  placeholder="Enter section heading in target language (e.g. प्रारंभिक जीवन)"
                  :disabled="isPublishing"
                />
              </div>
            </div>

            <!-- Error Banner -->
            <div v-if="errorMessage" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex flex-col gap-2">
              <div class="flex items-start gap-2">
                <span class="material-icons-round text-base shrink-0 mt-0.5">error_outline</span>
                <span class="flex-1 leading-relaxed">{{ errorMessage }}</span>
              </div>
              <div v-if="isSessionExpired" class="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                <span class="text-[11px] opacity-90">Your draft translation is saved and won't be lost.</span>
                <button
                  type="button"
                  @click="relogin"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <span class="material-icons-round text-sm">login</span>
                  <span>Log In Again</span>
                </button>
              </div>
            </div>

            <!-- Section Placement / New Page Info (when in Section Mode) -->
            <div v-if="publishMode === 'section'" class="pt-1">
              <!-- Case A: Target article does NOT exist on target wiki -> Publish directly as new page -->
              <div v-if="pageExists === false" class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-4 space-y-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                <div class="flex items-center gap-2 font-bold">
                  <span class="material-icons-round text-emerald-600 dark:text-emerald-400 text-base">add_circle_outline</span>
                  <span>New Article Creation</span>
                </div>
                <p class="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  This article does not exist on <strong>{{ toLanguage }}.wikipedia.org</strong> yet. It will be published as a new article.
                </p>
              </div>

              <!-- Case B: Target article DOES exist on target wiki -> Show placement options directly -->
              <div v-else class="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/[0.08] mb-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200">
                    <span class="material-icons-round text-sm text-primary-500">format_indent_increase</span>
                    <span>{{ $t('publishModal.placementTitle') }}</span>
                  </div>
                  <div v-if="fetchingTargetSections" class="flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400">
                    <span class="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                    <span>Fetching sections...</span>
                  </div>
                  <span v-else-if="availableTargetSections.length" class="text-[11px] text-slate-400">
                    {{ availableTargetSections.length }} sections found
                  </span>
                </div>
                
                <div class="space-y-2.5 text-xs">
                  <!-- 1. Append at bottom (Default) -->
                  <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-zinc-300">
                    <input type="radio" value="append_bottom" v-model="sectionPlacement" class="text-primary-600 focus:ring-primary-500" />
                    <span class="font-semibold text-slate-900 dark:text-zinc-100">{{ $t('publishModal.appendNew') }}</span>
                  </label>

                  <!-- 2. Insert After Section -->
                  <div class="space-y-1">
                    <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-zinc-300">
                      <input type="radio" value="insert_after" v-model="sectionPlacement" class="text-primary-600 focus:ring-primary-500" />
                      <span class="font-medium">{{ $t('publishModal.insertAfter') }}</span>
                    </label>
                    <div v-if="sectionPlacement === 'insert_after'" class="pl-6 animate-fade-in">
                      <select
                        v-model="selectedInsertAfterSectionIndex"
                        class="select-field text-xs w-full bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700"
                      >
                        <option value="0">{{ $t('publishModal.leadSectionOption') }}</option>
                        <option v-for="sec in availableTargetSections" :key="`after-${sec.index}`" :value="String(sec.index)">
                          §{{ sec.index }}: {{ sec.line || sec.title }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- 3. Insert Before Section -->
                  <div v-if="availableTargetSections.length" class="space-y-1">
                    <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-zinc-300">
                      <input type="radio" value="insert_before" v-model="sectionPlacement" class="text-primary-600 focus:ring-primary-500" />
                      <span class="font-medium">{{ $t('publishModal.insertBefore') }}</span>
                    </label>
                    <div v-if="sectionPlacement === 'insert_before'" class="pl-6 animate-fade-in">
                      <select
                        v-model="selectedInsertBeforeSectionIndex"
                        class="select-field text-xs w-full bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700"
                      >
                        <option value="" disabled>{{ $t('publishModal.selectReplacePlaceholder') }}</option>
                        <option v-for="sec in availableTargetSections" :key="`before-${sec.index}`" :value="String(sec.index)">
                          §{{ sec.index }}: {{ sec.line || sec.title }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- 4. Replace an existing section -->
                  <div v-if="availableTargetSections.length" class="space-y-1">
                    <label class="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-zinc-300">
                      <input type="radio" value="replace" v-model="sectionPlacement" class="text-primary-600 focus:ring-primary-500" />
                      <span class="font-medium text-amber-700 dark:text-amber-400">{{ $t('publishModal.replaceExisting') }}</span>
                    </label>
                    <div v-if="sectionPlacement === 'replace'" class="pl-6 space-y-1.5 animate-fade-in">
                      <select
                        v-model="selectedReplaceSectionIndex"
                        class="select-field text-xs w-full bg-white dark:bg-zinc-800 border-amber-300 dark:border-amber-700/60"
                      >
                        <option value="" disabled>{{ $t('publishModal.selectReplacePlaceholder') }}</option>
                        <option v-for="sec in availableTargetSections" :key="`replace-${sec.index}`" :value="String(sec.index)">
                          §{{ sec.index }}: {{ sec.line || sec.title }}
                        </option>
                      </select>
                      <p class="text-[11px] text-amber-600 dark:text-amber-400">
                        ⚠️ {{ $t('publishModal.replaceWarning') }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Live Placement Preview Badge -->
                <div class="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06] flex items-center gap-1.5 text-[11px] text-primary-700 dark:text-primary-300 bg-primary-50/50 dark:bg-primary-950/30 p-2 rounded-xl border border-primary-200/50 dark:border-primary-800/30">
                  <span class="material-icons-round text-xs">place</span>
                  <span class="font-semibold">{{ placementPreviewText }}</span>
                </div>

                <!-- Untranslated Paragraphs Skipped Notice -->
                <div v-if="untranslatedSkippedCount > 0" class="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                  <span class="material-icons-round text-xs text-amber-600">shield</span>
                  <span>{{ $t('publishModal.untranslatedOmittedBadge', { count: untranslatedSkippedCount }) }}</span>
                </div>
              </div>
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
                  @click="canPublishMainspace ? promptPublishConfirmation('mainspace') : showMainspaceRestrictedInfo()"
                  :disabled="isPublishing || !targetTitle.trim() || !isPlacementValid"
                  class="w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  :class="[
                    !canPublishMainspace
                      ? 'bg-slate-50/80 dark:bg-zinc-950/80 border-dashed border-slate-300 dark:border-zinc-700/60 opacity-80'
                      : targetTitle.trim()
                        ? 'bg-white hover:bg-primary-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border-slate-200 dark:border-white/[0.08] hover:border-primary-400'
                        : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/[0.04]'
                  ]"
                  :title="!canPublishMainspace ? 'Currently only available to verified users (Phase 1 beta).' : 'Publish directly to live Wikipedia'"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                      :class="canPublishMainspace ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'"
                    >
                      <span class="material-icons-round text-base">{{ canPublishMainspace ? 'public' : 'lock' }}</span>
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>Mainspace (Live Article)</span>
                        <span
                          v-if="canPublishMainspace"
                          class="text-[10px] px-1.5 py-0.2 rounded bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-semibold"
                        >Direct</span>
                        <span
                          v-else
                          class="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-0.5"
                        >
                          <span class="material-icons-round text-[10px]">lock</span>
                          Verified Only (Phase 1)
                        </span>
                      </div>
                      <p v-if="canPublishMainspace" class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        {{ toLanguage }}.wikipedia.org/wiki/{{ encodeURIComponent(targetTitle.trim() || 'Title') }}
                      </p>
                      <p v-else class="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        Currently only available to verified users. Please use Sandbox or Draft below.
                      </p>
                    </div>
                  </div>
                  <span v-if="canPublishMainspace" class="material-icons-round text-slate-400 group-hover:text-primary-500 transition-colors">arrow_forward</span>
                  <span v-else class="material-icons-round text-amber-500 text-sm">lock</span>
                </button>

                <!-- 2. User Sandbox -->
                <button
                  type="button"
                  @click="promptPublishConfirmation('sandbox')"
                  :disabled="isPublishing || !targetTitle.trim() || !isPlacementValid"
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
                  <span class="material-icons-round text-slate-400 group-hover:text-amber-500 transition-colors">arrow_forward</span>
                </button>

                <!-- 3. Draft Namespace -->
                <button
                  type="button"
                  @click="promptPublishConfirmation('draft')"
                  :disabled="isPublishing || !targetTitle.trim() || !isPlacementValid"
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
                  <span class="material-icons-round text-slate-400 group-hover:text-indigo-500 transition-colors">arrow_forward</span>
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
    fromLanguage: {
      type: String,
      default: '',
    },
    sourceTitle: {
      type: String,
      default: '',
    },
    targetLanguageName: {
      type: String,
      default: 'Target Wiki',
    },
    fullTranslatedText: {
      type: String,
      default: '',
    },
    reviewedCount: {
      type: Number,
      default: 0,
    },
    totalSectionsCount: {
      type: Number,
      default: 0,
    },
    isFullyReviewed: {
      type: Boolean,
      default: false,
    },
    modificationPercent: {
      type: Number,
      default: 0,
    },
    mtEngine: {
      type: String,
      default: 'google',
    },
    publishMode: {
      type: String,
      default: 'full', // 'full' or 'section'
    },
    sectionTitle: {
      type: String,
      default: '',
    },
    targetArticleSections: {
      type: Array,
      default: () => [],
    },
    untranslatedSkippedCount: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      targetTitle: '',
      isPublishing: false,
      publishingDest: null,
      selectedDest: null,
      confirmingPublish: false,
      userAcknowledgedReview: false,
      publishSuccess: false,
      publishedUrl: '',
      errorMessage: '',
      isSessionExpired: false,
      titleChecking: false,
      pageExists: null,
      localSectionTitle: '',
      sectionPlacement: 'append_bottom',
      selectedInsertAfterSectionIndex: '0',
      selectedInsertBeforeSectionIndex: '',
      selectedReplaceSectionIndex: '',
      localTargetArticleSections: [],
      fetchingTargetSections: false,
    };
  },
  computed: {
    canPublishMainspace() {
      return this.user?.canPublishMainspace === true;
    },
    availableTargetSections() {
      if (this.localTargetArticleSections && this.localTargetArticleSections.length > 0) {
        return this.localTargetArticleSections;
      }
      return this.targetArticleSections || [];
    },
    selectedDestLabel() {
      if (this.selectedDest === 'mainspace') return 'Mainspace (Live Article)';
      if (this.selectedDest === 'sandbox') return 'User Sandbox (Draft)';
      if (this.selectedDest === 'draft') return 'Draft Namespace';
      return '';
    },
    finalFormattedTitle() {
      const rawTitle = this.targetTitle.trim();
      if (!rawTitle) return '';
      if (this.selectedDest === 'sandbox') {
        const username = this.user?.username || 'User';
        return `User:${username}/${rawTitle}`;
      }
      if (this.selectedDest === 'draft') {
        return `Draft:${rawTitle}`;
      }
      return rawTitle;
    },
    placementPreviewText() {
      if (this.publishMode !== 'section') return '';
      if (this.pageExists === false) {
        return `Will create a new article on ${this.toLanguage}.wikipedia.org`;
      }
      if (this.sectionPlacement === 'append_bottom') {
        return this.$t ? this.$t('publishModal.placementPreviewBottom') : 'Will be appended at the end of the article';
      }
      if (this.sectionPlacement === 'insert_after') {
        if (this.selectedInsertAfterSectionIndex === '0') {
          return this.$t ? this.$t('publishModal.placementPreviewLead') : 'Will be inserted right after the Lead section (before §1)';
        }
        const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedInsertAfterSectionIndex));
        const name = sec ? `§${sec.index}: ${sec.line || sec.title}` : `§${this.selectedInsertAfterSectionIndex}`;
        return this.$t ? this.$t('publishModal.placementPreviewAfter', { section: name }) : `Will be inserted after ${name}`;
      }
      if (this.sectionPlacement === 'insert_before') {
        const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedInsertBeforeSectionIndex));
        const name = sec ? `§${sec.index}: ${sec.line || sec.title}` : `§${this.selectedInsertBeforeSectionIndex}`;
        return this.$t ? this.$t('publishModal.placementPreviewBefore', { section: name }) : `Will be inserted before ${name}`;
      }
      if (this.sectionPlacement === 'replace') {
        const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedReplaceSectionIndex));
        const name = sec ? `§${sec.index}: ${sec.line || sec.title}` : `§${this.selectedReplaceSectionIndex}`;
        return this.$t ? this.$t('publishModal.placementPreviewReplace', { section: name }) : `Will replace section: ${name}`;
      }
      return '';
    },
    isPlacementValid() {
      if (this.publishMode !== 'section') return true;
      if (this.pageExists === false) return true;
      if (this.sectionPlacement === 'append_bottom') return true;
      if (this.sectionPlacement === 'insert_after') {
        return this.selectedInsertAfterSectionIndex !== '' && this.selectedInsertAfterSectionIndex !== null;
      }
      if (this.sectionPlacement === 'insert_before') {
        return Boolean(this.selectedInsertBeforeSectionIndex);
      }
      if (this.sectionPlacement === 'replace') {
        return Boolean(this.selectedReplaceSectionIndex);
      }
      return true;
    },
  },
  watch: {
    showModal(val) {
      if (val) {
        this.targetTitle = this.defaultTitle || '';
        this.confirmingPublish = false;
        this.userAcknowledgedReview = false;
        this.selectedDest = null;
        this.publishSuccess = false;
        this.errorMessage = '';
        this.isSessionExpired = false;
        this.localSectionTitle = this.sectionTitle || '';
        this.sectionPlacement = 'append_bottom';
        this.selectedInsertAfterSectionIndex = '0';
        this.localTargetArticleSections = [];
        if (this.availableTargetSections && this.availableTargetSections.length > 0) {
          this.selectedInsertBeforeSectionIndex = String(this.availableTargetSections[0].index);
          this.selectedReplaceSectionIndex = String(this.availableTargetSections[0].index);
        } else {
          this.selectedInsertBeforeSectionIndex = '';
          this.selectedReplaceSectionIndex = '';
        }
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
    sectionTitle(val) {
      this.localSectionTitle = val || '';
    },
    targetArticleSections(newSections) {
      if (newSections && newSections.length > 0) {
        if (!this.selectedInsertBeforeSectionIndex) {
          this.selectedInsertBeforeSectionIndex = String(newSections[0].index);
        }
        if (!this.selectedReplaceSectionIndex) {
          this.selectedReplaceSectionIndex = String(newSections[0].index);
        }
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
      this.confirmingPublish = false;
      this.$emit('close');
    },

    onTitleInput() {
      this.pageExists = null;
      this.localTargetArticleSections = [];
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
        this.localTargetArticleSections = [];
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
          if (this.publishMode === 'section') {
            this.fetchTargetWikiSections(title);
          }
        } else {
          this.pageExists = false;
          this.localTargetArticleSections = [];
        }
      } catch {
        this.pageExists = null;
        this.localTargetArticleSections = [];
      } finally {
        this.titleChecking = false;
      }
    },

    async fetchTargetWikiSections(title) {
      if (!title || !this.toLanguage) return;
      this.fetchingTargetSections = true;
      try {
        const url = `https://${this.toLanguage}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.parse?.sections && Array.isArray(data.parse.sections)) {
          this.localTargetArticleSections = data.parse.sections.map(s => ({
            index: s.index,
            line: s.line,
            level: s.level,
            number: s.number,
            anchor: s.anchor,
            title: s.line,
          }));
          if (this.localTargetArticleSections.length > 0) {
            if (!this.selectedInsertBeforeSectionIndex) {
              this.selectedInsertBeforeSectionIndex = String(this.localTargetArticleSections[0].index);
            }
            if (!this.selectedReplaceSectionIndex) {
              this.selectedReplaceSectionIndex = String(this.localTargetArticleSections[0].index);
            }
          }
        } else {
          this.localTargetArticleSections = [];
        }
      } catch (err) {
        console.error('Failed to fetch target sections:', err);
        this.localTargetArticleSections = [];
      } finally {
        this.fetchingTargetSections = false;
      }
    },

    showMainspaceRestrictedInfo() {
      this.errorMessage = 'Direct Mainspace publishing is currently restricted to verified users during Phase 1 beta. Please choose User Sandbox (Draft) or Draft namespace below.';
    },

    promptPublishConfirmation(dest) {
      const rawTitle = this.targetTitle.trim();
      if (!rawTitle) {
        this.errorMessage = 'Please enter an article title';
        return;
      }
      this.selectedDest = dest;
      this.confirmingPublish = true;
      this.errorMessage = '';
    },

    async performFinalPublish() {
      const finalTitle = this.finalFormattedTitle;
      if (!finalTitle) {
        this.errorMessage = 'Article title is required';
        return;
      }

      this.isPublishing = true;
      this.publishingDest = this.selectedDest;
      this.errorMessage = '';

      try {
        const payload = {
          text: this.fullTranslatedText,
          language: this.toLanguage,
          title: finalTitle,
          sourceLanguage: this.fromLanguage,
          sourceTitle: this.sourceTitle,
          mtEngine: this.mtEngine || 'google',
        };

        if (this.publishMode === 'section') {
          if (this.pageExists === false) {
            let textToPublish = this.fullTranslatedText;
            const heading = (this.localSectionTitle && this.localSectionTitle.trim()) || this.sectionTitle;
            if (heading && !textToPublish.trim().startsWith('=')) {
              textToPublish = `== ${heading.trim()} ==\n\n` + textToPublish.trim();
            }
            payload.text = textToPublish;
          } else {
            payload.publishMode = 'section';
            payload.placementMode = this.sectionPlacement;
            if (this.sectionPlacement === 'append_bottom') {
              payload.section = 'new';
            } else if (this.sectionPlacement === 'insert_after') {
              payload.targetSectionIndex = this.selectedInsertAfterSectionIndex;
              const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedInsertAfterSectionIndex));
              payload.targetSectionTitle = sec ? (sec.line || sec.title) : (this.selectedInsertAfterSectionIndex === '0' ? 'Lead' : '');
            } else if (this.sectionPlacement === 'insert_before') {
              payload.targetSectionIndex = this.selectedInsertBeforeSectionIndex;
              const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedInsertBeforeSectionIndex));
              payload.targetSectionTitle = sec ? (sec.line || sec.title) : '';
            } else if (this.sectionPlacement === 'replace') {
              payload.section = this.selectedReplaceSectionIndex;
              payload.targetSectionIndex = this.selectedReplaceSectionIndex;
              const sec = this.availableTargetSections.find(s => String(s.index) === String(this.selectedReplaceSectionIndex));
              payload.targetSectionTitle = sec ? (sec.line || sec.title) : '';
            }
            if (this.localSectionTitle && this.localSectionTitle.trim()) {
              payload.sectiontitle = this.localSectionTitle.trim();
            } else if (this.sectionTitle) {
              payload.sectiontitle = this.sectionTitle;
            }
          }
        }

        const response = await axios.post('/publish', payload);

        if (response.data && response.data.success) {
          this.publishSuccess = true;
          this.confirmingPublish = false;
          this.publishedUrl = `https://${this.toLanguage}.wikipedia.org/wiki/${encodeURIComponent(finalTitle)}`;
          this.$emit('published', { title: finalTitle, url: this.publishedUrl });
        } else {
          this.errorMessage = 'Publishing failed. Please try again.';
        }
      } catch (err) {
        console.error('Publish error:', err);
        const data = err.response?.data;
        if (err.response?.status === 401 || data?.sessionExpired) {
          this.isSessionExpired = true;
          this.errorMessage = data?.message || 'Your Wikimedia session has expired. Please log in again.';
          this.$emit('session-expired');
        } else {
          this.errorMessage = data?.message || err.message || 'An error occurred during publishing.';
        }
      } finally {
        this.isPublishing = false;
        this.publishingDest = null;
      }
    },

    relogin() {
      window.location.href = '/auth/login';
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
