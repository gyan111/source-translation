import { describe, it, expect, vi } from 'vitest';
import PreviewModal from '../src/components/PreviewModal.vue';
import i18n from '../src/i18n.js';

describe('Preview i18n keys', () => {
  const requiredPreviewKeys = [
    'title',
    'close',
    'loading',
    'rendered',
    'diff',
    'sourceHeading',
    'targetHeading',
    'sourcePreview',
    'sideBySidePreview',
    'sideBySideDiff',
    'targetPreview',
    'originalWikitext',
    'translatedWikitext',
    'loginAndPublish',
  ];

  const messagesObj = i18n.global.messages.value || i18n.global.messages;
  const locales = Object.keys(messagesObj);

  it('all supported locales contain all required preview keys', () => {
    expect(locales.length).toBeGreaterThanOrEqual(20);
    for (const locale of locales) {
      const messages = messagesObj[locale];
      expect(messages).toBeDefined();
      expect(messages.preview).toBeDefined();
      for (const key of requiredPreviewKeys) {
        expect(messages.preview[key], `Missing preview.${key} in locale ${locale}`).toBeTruthy();
      }
    }
  });

  it('all 20 language codes are registered in i18n', () => {
    const expectedLanguages = [
      'en', 'fr', 'es', 'pt', 'it', 'de', 'sat', 'or', 'hi',
      'pa', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'zh', 'ja', 'ar'
    ];
    for (const lang of expectedLanguages) {
      expect(locales).toContain(lang);
    }
  });
});

describe('PreviewModal.vue Component Logic', () => {
  it('has correct default data and props', () => {
    expect(PreviewModal.data().activeTab).toBe('rendered');
    expect(PreviewModal.props.showPreview).toBeDefined();
    expect(PreviewModal.props.previewLoading).toBeDefined();
    expect(PreviewModal.props.sourcePreviewHtml).toBeDefined();
    expect(PreviewModal.props.previewHtml).toBeDefined();
  });

  it('updates activeTab when initialTab prop changes', () => {
    const vm = {
      activeTab: 'rendered',
    };
    PreviewModal.watch.initialTab.call(vm, 'side_by_side_preview');
    expect(vm.activeTab).toBe('side_by_side_preview');

    PreviewModal.watch.initialTab.call(vm, 'diff');
    expect(vm.activeTab).toBe('diff');
  });

  it('resets activeTab when showPreview becomes true', () => {
    const vm = {
      activeTab: 'diff',
      initialTab: 'side_by_side_preview',
    };
    PreviewModal.watch.showPreview.call(vm, true);
    expect(vm.activeTab).toBe('side_by_side_preview');
  });

  it('emits close-preview on closePreview()', () => {
    const emit = vi.fn();
    const vm = {
      $emit: emit,
    };
    PreviewModal.methods.closePreview.call(vm);
    expect(emit).toHaveBeenCalledWith('close-preview');
  });

  it('handles Escape key to close preview', () => {
    const closePreview = vi.fn();
    const vm = {
      showPreview: true,
      closePreview,
    };
    PreviewModal.methods.handleEscape.call(vm, { key: 'Escape' });
    expect(closePreview).toHaveBeenCalledTimes(1);

    // When showPreview is false, should not close
    vm.showPreview = false;
    PreviewModal.methods.handleEscape.call(vm, { key: 'Escape' });
    expect(closePreview).toHaveBeenCalledTimes(1);
  });
});
