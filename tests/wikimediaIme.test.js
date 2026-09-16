import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupWikimediaIme, initIme } from '../src/utils/wikimediaIme.js';

describe('wikimediaIme bridge and preferences', () => {
  let elementDataMap = new Map();
  let eventHandlersMap = new Map();

  beforeEach(() => {
    elementDataMap = new Map();
    eventHandlersMap = new Map();

    const localStorageStore = {};
    global.localStorage = {
      getItem: vi.fn((key) => localStorageStore[key] || null),
      setItem: vi.fn((key, val) => { localStorageStore[key] = String(val); }),
      removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
      clear: vi.fn(() => {
        for (const k in localStorageStore) delete localStorageStore[k];
      }),
    };

    global.window = {
      localStorage: global.localStorage,
      $: function (selector) {
        if (typeof selector === 'string') {
          return {
            addClass: vi.fn().mockReturnThis(),
            attr: vi.fn().mockReturnThis(),
            text: vi.fn().mockReturnThis(),
            append: vi.fn().mockReturnThis(),
            uls: vi.fn().mockReturnThis(),
          };
        }

        const el = selector;
        if (!elementDataMap.has(el)) {
          elementDataMap.set(el, {
            ime: {
              isActive: vi.fn(() => true),
              getLanguage: vi.fn(() => 'sat'),
              getIM: vi.fn(() => ({ id: 'sat-inscript2-ol-chiki' })),
              setLanguage: vi.fn(),
              setIM: vi.fn(),
              enable: vi.fn(),
              disable: vi.fn(),
            },
            imeselector: {
              selectLanguage: vi.fn(),
              selectIM: vi.fn(),
              disableIM: vi.fn(),
              toggle: vi.fn(),
              $imeSetting: {
                remove: vi.fn(),
              },
            },
          });
        }

        if (!eventHandlersMap.has(el)) {
          eventHandlersMap.set(el, {});
        }

        const elData = elementDataMap.get(el);
        const elHandlers = eventHandlersMap.get(el);

        const wrapper = {
          data: vi.fn((key) => {
            if (key === 'ime') return elData.ime;
            if (key === 'imeselector') return elData.imeselector;
            return undefined;
          }),
          removeData: vi.fn((key) => {
            delete elData[key];
            return wrapper;
          }),
          attr: vi.fn((attrName, val) => {
            if (val !== undefined && el && el.setAttribute) {
              el.setAttribute(attrName, val);
            }
            return val;
          }),
          on: vi.fn((events, handler) => {
            events.split(' ').forEach((ev) => {
              elHandlers[ev] = handler;
            });
            return wrapper;
          }),
          off: vi.fn(() => wrapper),
          trigger: vi.fn((event, ...args) => {
            if (elHandlers[event]) {
              elHandlers[event]({ target: el }, ...args);
            }
            return wrapper;
          }),
          ime: vi.fn(() => {
            elData.ime = {
              isActive: vi.fn(() => true),
              getLanguage: vi.fn(() => 'sat'),
              getIM: vi.fn(() => ({ id: 'sat-inscript2-ol-chiki' })),
              setLanguage: vi.fn(),
              setIM: vi.fn(),
              enable: vi.fn(),
              disable: vi.fn(),
            };
            elData.imeselector = {
              selectLanguage: vi.fn(),
              selectIM: vi.fn(),
              disableIM: vi.fn(),
              toggle: vi.fn(),
              $imeSetting: {
                remove: vi.fn(),
              },
            };
            return wrapper;
          }),
        };
        return wrapper;
      },
    };

    global.window.$.fn = {
      ime: vi.fn(),
      uls: vi.fn(),
    };

    global.window.$.ime = {
      path: '',
      preferences: {
        registry: {
          language: null,
          previousLanguages: ['sat', 'or'],
          previousInputMethods: ['sat-inscript2-ol-chiki'],
        },
        getLanguage: vi.fn(() => 'sat'),
        getPreviousLanguages: vi.fn(() => ['sat', 'or']),
        getIM: vi.fn((lang) => (lang === 'sat' ? 'sat-inscript2-ol-chiki' : 'system')),
        setLanguage: vi.fn(),
        setIM: vi.fn(),
        save: vi.fn(),
        load: vi.fn(),
      },
      languages: {
        sat: { autonym: 'ᱥᱟᱱᱛᱟᱞᱤ (संताली)', inputmethods: ['sat-inscript2-ol-chiki'] },
        or: { autonym: 'ଓଡ଼ିଆ', inputmethods: ['or-lekhani'] },
        hi: { autonym: 'हिन्दी', inputmethods: ['hi-bolnagri'] },
      },
    };

    global.$ = global.window.$;
  });

  it('configures $.ime.path to local /libs/jquery.ime/', () => {
    setupWikimediaIme(true);
    expect(global.window.$.ime.path).toBe('/libs/jquery.ime/');
  });

  it('persists preferences to and from localStorage', () => {
    setupWikimediaIme(true);

    global.window.$.ime.preferences.registry.language = 'sat';
    global.window.$.ime.preferences.save();

    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      'wikipedia_uls_ime_preferences',
      expect.stringContaining('"language":"sat"')
    );

    // Test load
    global.window.$.ime.preferences.registry = {};
    global.window.$.ime.preferences.load();
    expect(global.window.$.ime.preferences.registry.language).toBe('sat');
  });

  it('initializes IME on target element and sets language', () => {
    const mockElement = {
      value: 'hello',
      setAttribute: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    const controller = initIme(mockElement, 'sat');
    expect(controller).toBeDefined();
    expect(typeof controller.updateLanguage).toBe('function');
    expect(typeof controller.destroy).toBe('function');

    controller.updateLanguage('or');
    controller.destroy();
  });

  it('does not dispatch input event when input method changes without text modification', () => {
    const mockElement = {
      value: 'Original Translation',
      setAttribute: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    initIme(mockElement, 'sat');

    // Trigger IME method change
    const $mock = global.window.$(mockElement);
    $mock.trigger('imeMethodChange.syncBridge');

    // dispatchEvent should NOT have been called because textarea text value did not change
    expect(mockElement.dispatchEvent).not.toHaveBeenCalled();
  });

  it('synchronizes input method changes across multiple active textareas', () => {
    const field1 = { value: 'Field 1', setAttribute: vi.fn(), dispatchEvent: vi.fn() };
    const field2 = { value: 'Field 2', setAttribute: vi.fn(), dispatchEvent: vi.fn() };

    const ctrl1 = initIme(field1, 'sat');
    const ctrl2 = initIme(field2, 'sat');

    const field2ImeSelector = elementDataMap.get(field2).imeselector;

    // Change input method on field 1 via setim.ime event
    const $field1 = global.window.$(field1);
    $field1.trigger('setim.ime.syncBridge', 'sat-sarjom-baha');

    // Field 2 should automatically have selectIM called with 'sat-sarjom-baha'
    expect(field2ImeSelector.selectIM).toHaveBeenCalledWith('sat-sarjom-baha');

    // Now switch to system input method on field 1
    $field1.trigger('setim.ime.syncBridge', 'system');
    expect(field2ImeSelector.disableIM).toHaveBeenCalled();

    ctrl1.destroy();
    ctrl2.destroy();
  });
});
