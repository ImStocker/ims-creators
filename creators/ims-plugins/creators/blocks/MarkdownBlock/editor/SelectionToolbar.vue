<template>
  <div class="SelectionToolbar" :style="positionStyle">
    <div class="SelectionToolbar-bubble">
      <div class="SelectionToolbar-section">
        <button
          v-for="b of inlineButtons"
          :key="b.type"
          class="SelectionToolbar-button is-button"
          :title="b.title"
          @mousedown.prevent="onFormat(b.type)"
        >
          <i :class="b.icon"></i>
        </button>
      </div>

      <div class="SelectionToolbar-section">
        <button
          v-for="b of blockButtons"
          :key="b.type"
          class="SelectionToolbar-button is-button"
          :title="b.title"
          @mousedown.prevent="onFormat(b.type)"
        >
          <i :class="b.icon"></i>
        </button>
      </div>

      <div class="SelectionToolbar-section">
        <button
          class="SelectionToolbar-button is-button"
          title="Link"
          @mousedown.prevent="toggleLink"
        >
          <i class="ri-link"></i>
        </button>
      </div>

      <div class="SelectionToolbar-section">
        <button
          class="SelectionToolbar-button is-button"
          title="Formula"
          @mousedown.prevent="onFormat('formula')"
        >
          <i class="ri-formula"></i>
        </button>
        <button
          class="SelectionToolbar-button is-button"
          title="Clear formatting"
          @mousedown.prevent="onFormat('clean')"
        >
          <i class="ri-format-clear"></i>
        </button>
      </div>

      <div
        v-if="linkOpen"
        class="SelectionToolbar-linkPopover"
        @mousedown.stop
        @click.stop
      >
        <div class="SelectionToolbar-linkTabs">
          <button
            class="is-button"
            :class="{ 'state-active': linkMode === 'url' }"
            @click="linkMode = 'url'"
          >
            URL
          </button>
          <button
            class="is-button"
            :class="{ 'state-active': linkMode === 'asset' }"
            @click="linkMode = 'asset'"
          >
            Asset
          </button>
        </div>

        <template v-if="linkMode === 'url'">
          <input
            ref="urlInput"
            v-model="url"
            class="SelectionToolbar-input"
            placeholder="https://..."
            @keyup.enter="applyLink"
          />
          <button class="is-button SelectionToolbar-apply" @click="applyLink">
            Apply
          </button>
        </template>

        <template v-else>
          <input
            v-model="assetRef"
            class="SelectionToolbar-input"
            placeholder="Asset or page name"
            @keyup.enter="applyAsset"
          />
          <button class="is-button SelectionToolbar-apply" @click="applyAsset">
            Insert
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { SelectionRect } from './plugins/selection-toolbar';
import type { FormatType, FormatPayload } from './format-commands';

type ButtonDef = { type: FormatType; title: string; icon: string };

export default defineComponent({
  name: 'SelectionToolbar',
  props: {
    rect: { type: Object as () => SelectionRect, required: true },
  },
  emits: ['format'],
  data() {
    return {
      linkOpen: false,
      linkMode: 'url' as 'url' | 'asset',
      url: '',
      assetRef: '',
      inlineButtons: [
        { type: 'bold', title: 'Bold', icon: 'ri-bold' },
        { type: 'italic', title: 'Italic', icon: 'ri-italic' },
        { type: 'strike', title: 'Strikethrough', icon: 'ri-strikethrough' },
        { type: 'highlight', title: 'Highlight', icon: 'ri-mark-pen-fill' },
        { type: 'code', title: 'Inline code', icon: 'ri-code-s-slash-fill' },
        { type: 'superscript', title: 'Superscript', icon: 'ri-superscript' },
        { type: 'subscript', title: 'Subscript', icon: 'ri-subscript' },
      ] as ButtonDef[],
      blockButtons: [
        { type: 'h1', title: 'Heading 1', icon: 'ri-h-1' },
        { type: 'h2', title: 'Heading 2', icon: 'ri-h-2' },
        { type: 'h3', title: 'Heading 3', icon: 'ri-h-3' },
        { type: 'h4', title: 'Heading 4', icon: 'ri-h-4' },
        {
          type: 'bullet_list',
          title: 'Bulleted list',
          icon: 'ri-list-unordered',
        },
        {
          type: 'ordered_list',
          title: 'Numbered list',
          icon: 'ri-list-ordered',
        },
        { type: 'task_list', title: 'Task list', icon: 'ri-list-check' },
        { type: 'quote', title: 'Quote', icon: 'ri-double-quotes-r' },
        { type: 'callout', title: 'Callout', icon: 'ri-text-block' },
        { type: 'code_block', title: 'Code block', icon: 'ri-code-box-fill' },
      ] as ButtonDef[],
    };
  },
  computed: {
    positionStyle(): Record<string, string> {
      // Place the bubble above the selection; flip below when there isn't
      // enough room at the top of the viewport.
      const above = this.rect.top > 60;
      return {
        left: `${this.rect.left}px`,
        top: above ? `${this.rect.top}px` : `${this.rect.bottom}px`,
        transform: above
          ? 'translate(-50%, calc(-100% - 8px))'
          : 'translate(-50%, 8px)',
      };
    },
  },
  methods: {
    onFormat(type: FormatType, payload: FormatPayload = {}) {
      this.$emit('format', { type, payload });
      this.linkOpen = false;
    },
    toggleLink() {
      this.linkOpen = !this.linkOpen;
      if (this.linkOpen && this.linkMode === 'url') {
        this.$nextTick(() =>
          (this.$refs['urlInput'] as HTMLInputElement)?.focus(),
        );
      }
    },
    applyLink() {
      this.onFormat('link', { url: this.url });
      this.url = '';
    },
    applyAsset() {
      this.onFormat('link', { asset: this.assetRef as any });
      this.assetRef = '';
    },
  },
});
</script>

<style lang="scss">
.SelectionToolbar {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
}

.SelectionToolbar-bubble {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  padding: 2px 0;
}

.SelectionToolbar-section {
  display: flex;
  border-right: 1px solid var(--local-border-color);
  padding: 0 4px;

  &:last-child {
    border-right: none;
  }
}

.SelectionToolbar-button {
  background: transparent;
  border: none;
  color: var(--local-text-color);
  padding: 7px 5px;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;

  &:hover {
    background-color: var(--dropdown-hl-bg-color);
  }

  i {
    font-size: 17px;
  }
}

.SelectionToolbar-linkPopover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  pointer-events: auto;
}

.SelectionToolbar-linkTabs {
  display: flex;
  gap: 4px;

  .is-button {
    background: transparent;
    border: none;
    color: var(--local-text-color);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;

    &.state-active {
      background-color: var(--dropdown-hl-bg-color);
    }
  }
}

.SelectionToolbar-input {
  width: 220px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--local-border-color);
  background-color: var(--local-box-color);
  color: var(--local-text-color);
}

.SelectionToolbar-apply {
  align-self: flex-end;
  background: transparent;
  border: none;
  color: var(--color-accent, #2f80ed);
  cursor: pointer;
  padding: 4px 8px;
}
</style>
