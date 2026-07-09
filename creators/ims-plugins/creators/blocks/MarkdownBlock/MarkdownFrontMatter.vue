<template>
  <div class="MarkdownFrontMatter">
    <div class="MarkdownFrontMatter-table">
      <div
        v-for="(entry, index) in localEntries"
        :key="index"
        class="MarkdownFrontMatter-row"
      >
        <input
          v-if="!readonly"
          v-model="entry.key"
          class="MarkdownFrontMatter-input MarkdownFrontMatter-key"
          :placeholder="$t('markdownBlock.keyPlaceholder')"
          @input="onChange"
        />
        <span v-else class="MarkdownFrontMatter-key">{{ entry.key }}</span>
        <input
          v-if="!readonly"
          v-model="entry.value"
          class="MarkdownFrontMatter-input MarkdownFrontMatter-value"
          :placeholder="$t('markdownBlock.valuePlaceholder')"
          @input="onChange"
        />
        <span v-else class="MarkdownFrontMatter-value">{{ entry.value }}</span>
        <button
          v-if="!readonly"
          class="MarkdownFrontMatter-remove"
          @click="removeEntry(index)"
        >
          &times;
        </button>
      </div>
    </div>
    <div v-if="!readonly" class="MarkdownFrontMatter-actions">
      <button class="MarkdownFrontMatter-add" @click="addEntry">
        {{ $t('markdownBlock.addField') }}
      </button>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';

interface FrontMatterEntry {
  key: string;
  value: string;
}

export default defineComponent({
  name: 'MarkdownFrontMatter',
  props: {
    entries: {
      type: Array as PropType<FrontMatterEntry[]>,
      default: () => [],
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:entries'],
  data() {
    return {
      localEntries: [] as FrontMatterEntry[],
    };
  },
  watch: {
    entries: {
      immediate: true,
      handler(val: FrontMatterEntry[]) {
        this.localEntries = val.map((e) => ({ ...e }));
      },
    },
  },
  methods: {
    onChange() {
      this.$emit(
        'update:entries',
        this.localEntries.map((e) => ({ ...e })),
      );
    },
    addEntry() {
      this.localEntries.push({ key: '', value: '' });
      this.onChange();
    },
    removeEntry(index: number) {
      this.localEntries.splice(index, 1);
      this.onChange();
    },
  },
});
</script>
<style lang="scss" scoped>
.MarkdownFrontMatter {
  margin-bottom: 12px;
  overflow: hidden;
}

.MarkdownFrontMatter-table {
  display: flex;
  flex-direction: column;
}
.MarkdownFrontMatter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.MarkdownFrontMatter-row:last-child {
  border-bottom: none;
}
.MarkdownFrontMatter-input {
  border: 1px solid var(--local-border-color);
  padding: 4px 6px;
  font-size: 13px;
  background: var(--local-input-bg-color);
  color: var(--local-text-color);
  outline: none;
  &:focus {
    border-color: var(--color-accent);
  }
}
.MarkdownFrontMatter-key {
  width: 140px;
  flex-shrink: 0;
  font-family: monospace;
}
.MarkdownFrontMatter-value {
  flex: 1;
  font-family: monospace;
}
.MarkdownFrontMatter-remove {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--local-sub-text-color);
  border-radius: 4px;
  &:hover {
    background: var(--local-hl-bg-color);
    color: var(--color-danger);
  }
}
.MarkdownFrontMatter-actions {
}
.MarkdownFrontMatter-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-accent);
  padding: 4px 8px;
  border-radius: 4px;
  &:hover {
    background: var(--local-hl-bg-color);
  }
}
</style>
