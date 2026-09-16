/**
 * Wikimedia Universal Language Selector (ULS) & Input Method Editor (jquery.ime) Integration
 * 
 * Provides native typing and keyboard transliteration for 120+ languages
 * (e.g. Santali Ol Chiki InScript2, Odia Lekhani/InScript, Hindi Bolnagri,
 * Bengali Avro, Russian Cyrillic, etc.)
 * 
 * Complies 100% with Wikimedia Toolforge privacy policy (no external CDNs, self-hosted).
 */

const PREFS_STORAGE_KEY = 'wikipedia_uls_ime_preferences';

let preferencesInitialized = false;

// Global set of all active IME controllers across all textareas on the page
const activeImeControllers = new Set();
let isSyncing = false;

/**
 * Broadcast an input method change to all other active IME textareas on the page.
 * Ensures changing input method on one field updates all fields immediately.
 */
function broadcastInputMethod(sourceElement, imId) {
  if (isSyncing || !imId) return;
  isSyncing = true;
  try {
    for (const ctrl of activeImeControllers) {
      if (ctrl.element !== sourceElement) {
        ctrl.applyInputMethod(imId);
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Broadcast a language change to all other active IME textareas on the page.
 */
function broadcastLanguage(sourceElement, langCode) {
  if (isSyncing || !langCode) return;
  isSyncing = true;
  try {
    for (const ctrl of activeImeControllers) {
      if (ctrl.element !== sourceElement) {
        ctrl.applyLanguage(langCode);
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Configure global $.ime paths and localStorage preferences persistence
 */
export function setupWikimediaIme(force = false) {
  if (typeof window === 'undefined' || !window.$ || !window.$.ime) {
    return false;
  }

  // Set base path to local rules directory for AJAX on-demand rule loading
  window.$.ime.path = '/libs/jquery.ime/';

  if (preferencesInitialized && !force) return true;

  if (window.$.ime.preferences) {
    // Override load to read from localStorage
    window.$.ime.preferences.load = function () {
      try {
        const saved = localStorage.getItem(PREFS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            window.$.ime.preferences.registry = Object.assign(
              window.$.ime.preferences.registry || {},
              parsed
            );
          }
        }
      } catch (e) {
        console.warn('Failed to load IME preferences from localStorage:', e);
      }
    };

    // Override save to persist to localStorage
    window.$.ime.preferences.save = function () {
      try {
        if (window.$.ime.preferences.registry) {
          localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(window.$.ime.preferences.registry));
        }
      } catch (e) {
        console.warn('Failed to save IME preferences to localStorage:', e);
      }
    };

    // Initial load
    window.$.ime.preferences.load();
    preferencesInitialized = true;
  }

  return true;
}

/**
 * Initialize Wikimedia IME on a target editable element (textarea or input).
 * 
 * @param {HTMLElement} element - DOM element to attach IME to
 * @param {string} targetLang - Target language code (e.g. 'sat', 'or', 'hi', 'bn')
 * @param {Object} [options] - Optional configuration overrides
 * @returns {Object} Controller with updateLanguage(lang), toggle(), and destroy()
 */
export function initIme(element, targetLang, options = {}) {
  if (!element || typeof window === 'undefined') {
    return {
      element: null,
      updateLanguage: () => {},
      applyInputMethod: () => {},
      applyLanguage: () => {},
      toggle: () => {},
      destroy: () => {}
    };
  }

  setupWikimediaIme();

  const $ = window.$;
  if (!$ || !$.fn.ime) {
    console.warn('jquery.ime is not loaded yet');
    return {
      element,
      updateLanguage: () => {},
      applyInputMethod: () => {},
      applyLanguage: () => {},
      toggle: () => {},
      destroy: () => {}
    };
  }

  const $el = $(element);

  // If already initialized on this element, destroy previous instance cleanly
  if ($el.data('ime')) {
    const prevSelector = $el.data('imeselector');
    if (prevSelector && prevSelector.$imeSetting) {
      prevSelector.$imeSetting.remove();
    }
    $el.off('.ime').off('.vueBridge').off('.syncBridge').removeData('ime').removeData('imeselector');
  }

  // Set the DOM lang attribute for semantic correctness and IME hint
  if (targetLang) {
    $el.attr('lang', targetLang);
  }

  // Configure IME options with ULS button
  const imeOptions = {
    showSelector: true,
    selectorInside: false,
    languages: function () {
      const prefs = ($.ime && $.ime.preferences && $.ime.preferences.getPreviousLanguages()) || [];
      const list = [...prefs];
      const lang = targetLang || ($.ime && $.ime.preferences && $.ime.preferences.getLanguage()) || 'en';
      if (lang && !list.includes(lang) && $.ime && $.ime.languages && $.ime.languages[lang]) {
        list.unshift(lang);
      }
      return list.length ? list : ['en'];
    },
    languageSelector: function () {
      const $moreLink = $('<a>')
        .addClass('ime-more-languages-btn selectable-row-item')
        .attr('href', '#')
        .text('⋯ Other languages (Universal Language Selector)...');

      const $wrapper = $('<div>')
        .addClass('ime-more-languages-wrapper selectable-row')
        .append($moreLink);

      // Attach ULS modal trigger if $.fn.uls is available
      if ($.fn.uls) {
        $moreLink.uls({
          onSelect: function (langCode) {
            const imeselector = $el.data('imeselector');
            if (imeselector) {
              imeselector.selectLanguage(langCode);
            }
          },
          quickList: function () {
            return ($.ime && $.ime.preferences && $.ime.preferences.getPreviousLanguages()) || [];
          }
        });
      }

      return $wrapper;
    },
    ...options
  };

  // Initialize jQuery.ime
  $el.ime(imeOptions);

  const imeselector = $el.data('imeselector');
  const ime = $el.data('ime');

  // Determine initial language & input method from preferences (so all textareas match)
  const currentLanguage = targetLang || ($.ime && $.ime.preferences && $.ime.preferences.getLanguage()) || 'en';
  if (imeselector && currentLanguage && $.ime && $.ime.languages && $.ime.languages[currentLanguage]) {
    imeselector.selectLanguage(currentLanguage);

    const preferredIM = $.ime.preferences ? $.ime.preferences.getIM(currentLanguage) : null;
    if (preferredIM === 'system') {
      imeselector.disableIM();
    } else if (preferredIM) {
      imeselector.selectIM(preferredIM);
    }
  }

  // 1. Vue 3 reactivity bridge: ONLY dispatch native input event when textarea value ACTUALLY changes
  // Crucial: Changing input method or toggling IME does NOT change text, so it must NEVER trigger input
  let lastValue = element.value;
  const onTextChange = () => {
    if (element.value !== lastValue) {
      lastValue = element.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  $el.on('input.vueBridge compositionend.vueBridge keyup.vueBridge', onTextChange);

  // 2. Global Synchronization across all fields:
  // When input method changes (e.g. via menu, Ctrl+M, disable/enable), broadcast to all other fields
  $el.on('setim.ime.syncBridge', (e, inputMethodId) => {
    broadcastInputMethod(element, inputMethodId);
  });

  $el.on('imeMethodChange.syncBridge', () => {
    if (isSyncing) return;
    const activeIme = $el.data('ime');
    if (!activeIme) return;
    const currentLang = activeIme.getLanguage();
    const imId = activeIme.isActive()
      ? (activeIme.getIM()?.id || ($.ime?.preferences?.getIM(currentLang)))
      : 'system';
    broadcastInputMethod(element, imId);
  });

  // When language changes (e.g. via ULS or language selector), broadcast to all other fields
  $el.on('imeLanguageChange.syncBridge', () => {
    if (isSyncing) return;
    const activeIme = $el.data('ime');
    if (!activeIme) return;
    const currentLang = activeIme.getLanguage();
    if (currentLang) {
      broadcastLanguage(element, currentLang);
    }
  });

  const controller = {
    element,
    updateLanguage(newLang) {
      if (!newLang || !$ || !$.ime) return;
      $el.attr('lang', newLang);
      const sel = $el.data('imeselector');
      const activeIme = $el.data('ime');
      if (sel && $.ime.languages && $.ime.languages[newLang]) {
        sel.selectLanguage(newLang);
      } else if (activeIme && $.ime.languages && $.ime.languages[newLang]) {
        activeIme.setLanguage(newLang);
      }
    },
    applyInputMethod(imId) {
      const sel = $el.data('imeselector');
      if (!sel) return;
      if (imId === 'system') {
        sel.disableIM();
      } else if (imId) {
        sel.selectIM(imId);
      }
    },
    applyLanguage(langCode) {
      const sel = $el.data('imeselector');
      if (!sel || !langCode) return;
      $el.attr('lang', langCode);
      sel.selectLanguage(langCode);
    },
    toggle() {
      const sel = $el.data('imeselector');
      if (sel) {
        sel.toggle();
      }
    },
    destroy() {
      activeImeControllers.delete(controller);
      $el.off('.vueBridge').off('.syncBridge');
      const sel = $el.data('imeselector');
      if (sel && sel.$imeSetting) {
        sel.$imeSetting.remove();
      }
      $el.off('.ime');
      $el.removeData('ime');
      $el.removeData('imeselector');
    }
  };

  activeImeControllers.add(controller);
  return controller;
}
