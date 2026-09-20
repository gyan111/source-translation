import { describe, it, expect, vi, beforeEach } from 'vitest';

const localStorageStore = {};
global.localStorage = {
  getItem: vi.fn((key) => localStorageStore[key] || null),
  setItem: vi.fn((key, val) => { localStorageStore[key] = String(val); }),
  removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => {
    for (const k in localStorageStore) delete localStorageStore[k];
  }),
};

import PublishModal from '../src/components/PublishModal.vue';
import SourceTranslation from '../src/components/SourceTranslation.vue';
import axios from 'axios';

vi.mock('axios');

describe('PublishModal Section Placement & Page Existence Logic', () => {
  it('computes availableTargetSections from localTargetArticleSections first', () => {
    const vm = {
      localTargetArticleSections: [{ index: 1, line: 'Early life' }],
      targetArticleSections: [{ index: 2, line: 'Career' }],
    };
    const result = PublishModal.computed.availableTargetSections.call(vm);
    expect(result).toEqual([{ index: 1, line: 'Early life' }]);
  });

  it('falls back to targetArticleSections when localTargetArticleSections is empty', () => {
    const vm = {
      localTargetArticleSections: [],
      targetArticleSections: [{ index: 2, line: 'Career' }],
    };
    const result = PublishModal.computed.availableTargetSections.call(vm);
    expect(result).toEqual([{ index: 2, line: 'Career' }]);
  });

  it('validates placement as true when pageExists is false (new article creation)', () => {
    const vm = {
      publishMode: 'section',
      pageExists: false,
      sectionPlacement: 'insert_after',
      selectedInsertAfterSectionIndex: '',
    };
    expect(PublishModal.computed.isPlacementValid.call(vm)).toBe(true);
  });

  it('validates placement based on selected index when pageExists is true', () => {
    const vm = {
      publishMode: 'section',
      pageExists: true,
      sectionPlacement: 'insert_after',
      selectedInsertAfterSectionIndex: '0',
    };
    expect(PublishModal.computed.isPlacementValid.call(vm)).toBe(true);

    vm.selectedInsertAfterSectionIndex = '';
    expect(PublishModal.computed.isPlacementValid.call(vm)).toBe(false);
  });

  it('generates correct placementPreviewText for new article vs existing article', () => {
    const newPageVm = {
      publishMode: 'section',
      pageExists: false,
      toLanguage: 'or',
    };
    expect(PublishModal.computed.placementPreviewText.call(newPageVm)).toBe('Will create a new article on or.wikipedia.org');

    const existingPageVm = {
      publishMode: 'section',
      pageExists: true,
      toLanguage: 'or',
      sectionPlacement: 'append_bottom',
      $t: () => 'Will be appended at the end of the article',
    };
    expect(PublishModal.computed.placementPreviewText.call(existingPageVm)).toBe('Will be appended at the end of the article');
  });

  it('publishes as new page with prepended heading when pageExists is false in section mode', async () => {
    let capturedPayload = null;
    vi.mocked(axios.post).mockImplementationOnce((url, payload) => {
      capturedPayload = payload;
      return Promise.resolve({ data: { success: true } });
    });

    const vm = {
      publishMode: 'section',
      pageExists: false,
      toLanguage: 'or',
      fromLanguage: 'en',
      sourceTitle: 'A Single Shot',
      finalFormattedTitle: 'A Single Shot',
      fullTranslatedText: 'Translated paragraph content.',
      localSectionTitle: 'ପୃଷ୍ଠଭୂମି',
      sectionTitle: '',
      mtEngine: 'mint',
      isPublishing: false,
      publishingDest: null,
      selectedDest: 'mainspace',
      errorMessage: '',
      publishSuccess: false,
      confirmingPublish: true,
      publishedUrl: '',
      $emit: vi.fn(),
    };

    await PublishModal.methods.performFinalPublish.call(vm);

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.title).toBe('A Single Shot');
    expect(capturedPayload.text).toContain('== ପୃଷ୍ଠଭୂମି ==');
    expect(capturedPayload.text).toContain('Translated paragraph content.');
    // Should NOT have section: 'new' or placementMode
    expect(capturedPayload.publishMode).toBeUndefined();
    expect(capturedPayload.placementMode).toBeUndefined();
    expect(vm.publishSuccess).toBe(true);
  });
});

describe('SourceTranslation All-Section Default & Preview-Publish Transition', () => {
  it('defaults activeSectionFilter to "all"', () => {
    const data = SourceTranslation.data();
    expect(data.activeSectionFilter).toBe('all');
    expect(data.activeSectionIndex).toBe(0);
  });

  it('visibleParagraphs returns all paragraphs when activeSectionFilter is "all"', () => {
    const paragraphs = [
      { source: 'P1', sectionIndex: 0 },
      { source: 'P2', sectionIndex: 1 },
      { source: 'P3', sectionIndex: 2 },
    ];
    const vm = {
      activeSectionFilter: 'all',
      sectionsSummary: [{ index: 0 }, { index: 1 }, { index: 2 }],
      paragraphs,
    };
    const result = SourceTranslation.computed.visibleParagraphs.call(vm);
    expect(result).toEqual(paragraphs);
  });

  it('visibleParagraphs filters to specific section paragraphs when activeSectionFilter is a number', () => {
    const paragraphs = [
      { source: 'P1', sectionIndex: 0 },
      { source: 'P2', sectionIndex: 1 },
      { source: 'P3', sectionIndex: 2 },
    ];
    const vm = {
      activeSectionFilter: 1,
      sectionsSummary: [{ index: 0 }, { index: 1 }, { index: 2 }],
      paragraphs,
      activeSectionParagraphs: [{ source: 'P2', sectionIndex: 1 }],
    };
    const result = SourceTranslation.computed.visibleParagraphs.call(vm);
    expect(result).toEqual([{ source: 'P2', sectionIndex: 1 }]);
  });

  it('activeSectionPercent returns overall translationProgress when activeSectionFilter is "all"', () => {
    const vm = {
      activeSectionFilter: 'all',
      translationProgress: 75,
      activeSectionTotalCount: 4,
      activeSectionTranslatedCount: 1,
    };
    expect(SourceTranslation.computed.activeSectionPercent.call(vm)).toBe(75);
  });

  it('openPublishModal calls openFullPublishModal when activeSectionFilter is "all"', () => {
    const vm = {
      activeSectionFilter: 'all',
      currentMode: 'article',
      openFullPublishModal: vi.fn(),
      openSectionPublishModal: vi.fn(),
    };
    SourceTranslation.methods.openPublishModal.call(vm);
    expect(vm.openFullPublishModal).toHaveBeenCalledTimes(1);
    expect(vm.openSectionPublishModal).not.toHaveBeenCalled();
  });

  it('openPublishModal calls openSectionPublishModal when a specific section is selected', () => {
    const sectionObj = { index: 2, title: 'Career' };
    const vm = {
      activeSectionFilter: 2,
      currentMode: 'article',
      currentActiveSection: sectionObj,
      openFullPublishModal: vi.fn(),
      openSectionPublishModal: vi.fn(),
    };
    SourceTranslation.methods.openPublishModal.call(vm);
    expect(vm.openSectionPublishModal).toHaveBeenCalledWith(sectionObj);
    expect(vm.openFullPublishModal).not.toHaveBeenCalled();
  });

  it('handlePublishFromPreview closes showPreview and calls openPublishModal on nextTick', async () => {
    const vm = {
      showPreview: true,
      openPublishModal: vi.fn(),
      $nextTick: vi.fn((cb) => cb()),
    };
    SourceTranslation.methods.handlePublishFromPreview.call(vm);
    expect(vm.showPreview).toBe(false);
    expect(vm.openPublishModal).toHaveBeenCalledTimes(1);
  });
});
