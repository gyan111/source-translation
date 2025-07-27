<template>
  <div>
    <div v-if="isDisplayMode" class="wiki-text-display w-full">
      <div class="paragraph-grid">
        <div v-for="(paragraph, index) in formattedParagraphs" :key="index" class="p-3 bg-white rounded-md shadow-md border border-gray-300 card-paragraph" :id="`${areaType}-para-${index}`" :class="{'source-paragraph': areaType === 'source', 'translated-paragraph': areaType === 'translated'}">
          <div v-html="paragraph" class="paragraph-content"></div>
          <div class="text-xs text-gray-500 mt-2 text-right">{{ areaType === 'source' ? 'para' : 'translated' }}{{index + 1}}</div>
        </div>
      </div>
    </div>
    <textarea v-else :value="textareaValue" @input="$emit('update:textareaValue', $event.target.value)" :class="{'border-red-500': textareaError}" class="w-full p-4 border border-gray-300 rounded" rows="8" placeholder="Type something..."></textarea>
  </div>
</template>

<script>
export default {
  props: {
    textareaValue: String,
    textareaError: Boolean,
    isDisplayMode: {
      type: Boolean,
      default: false
    },
    areaType: {
      type: String,
      default: 'source',
      validator: function(value) {
        return ['source', 'translated'].includes(value);
      }
    }
  },
  computed: {
    formattedParagraphs() {
      if (!this.textareaValue) return [];
      
      // Split the text by double newlines to get paragraphs
      const paragraphs = this.textareaValue.split(/\n\n+/);
      
      return paragraphs.map(paragraph => {
        // Replace single newlines with <br> for line breaks within paragraphs
        return paragraph.replace(/\n/g, '<br>');
      });
    }
  }
};
</script>

<style scoped>
.wiki-text-display {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.paragraph-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.card-paragraph {
  transition: all 0.2s ease-in-out;
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background-color: #f0f0f0;
}

.source-paragraph {
  grid-column: 1;
}

.translated-paragraph {
  grid-column: 1;
}

.card-paragraph:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.paragraph-content {
  line-height: 1.5;
  flex-grow: 1;
}

@media (max-width: 768px) {
  .paragraph-grid {
    grid-template-columns: 1fr;
  }
  
  .source-paragraph,
  .translated-paragraph {
    grid-column: 1;
  }
}
</style>
  