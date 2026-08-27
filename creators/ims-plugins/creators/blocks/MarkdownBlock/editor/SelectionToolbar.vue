<template>
  <div ref="root" class="SelectionToolbar" :style="positionStyle">
    <div class="SelectionToolbar-bubble">
      <!-- Section 1: block formats -->
      <div class="SelectionToolbar-section">
        <button
          class="SelectionToolbar-button is-button"
          :class="{ 'has-dot': !!activeHeading }"
          title="Heading"
          @mousedown.prevent="openMenu('h')"
        >
          <i :class="headingTriggerIcon"></i>
        </button>
        <div
          v-if="menu === 'h'"
          class="SelectionToolbar-menu"
          @mousedown.prevent
        >
          <button
            v-for="lvl of headingLevels"
            :key="lvl"
            class="SelectionToolbar-button is-button"
            :title="'Heading ' + lvl"
            @mousedown.prevent="onFormat('h' + lvl)"
          >
            <i
              :class="[
                'ri-h-' + lvl,
                { 'has-dot': !!active && !!active['h' + lvl] },
              ]"
            ></i>
            <span class="SelectionToolbar-menuLabel">{{
              'Heading ' + lvl
            }}</span>
          </button>
          <button
            v-if="activeHeading"
            class="SelectionToolbar-button is-button reset"
            title="Reset"
            @mousedown.prevent="onFormat(activeHeading, { reset: true })"
          >
            <i class="ri-close-fill"></i> Reset
          </button>
        </div>

        <button
          class="SelectionToolbar-button is-button"
          :class="{
            'has-dot': !!(
              active &&
              (active.bullet || active.ordered || active.task)
            ),
          }"
          title="List"
          @mousedown.prevent="openMenu('list')"
        >
          <i :class="listTriggerIcon"></i>
        </button>
        <div
          v-if="menu === 'list'"
          class="SelectionToolbar-menu"
          @mousedown.prevent
        >
          <button
            class="SelectionToolbar-button is-button"
            title="Bullet list"
            @mousedown.prevent="onFormat('bullet_list')"
          >
            <i
              :class="[
                'ri-list-unordered',
                { 'has-dot': !!(active && active.bullet) },
              ]"
            ></i>
            <span class="SelectionToolbar-menuLabel">Bullet list</span>
          </button>
          <button
            class="SelectionToolbar-button is-button"
            title="Ordered list"
            @mousedown.prevent="onFormat('ordered_list')"
          >
            <i
              :class="[
                'ri-list-ordered',
                { 'has-dot': !!(active && active.ordered) },
              ]"
            ></i>
            <span class="SelectionToolbar-menuLabel">Ordered list</span>
          </button>
          <button
            class="SelectionToolbar-button is-button"
            title="Task list"
            @mousedown.prevent="onFormat('task_list')"
          >
            <i
              :class="[
                'ri-list-check-2',
                { 'has-dot': !!(active && active.task) },
              ]"
            ></i>
            <span class="SelectionToolbar-menuLabel">Task list</span>
          </button>
          <button
            v-if="activeListKind"
            class="SelectionToolbar-button is-button reset"
            title="Reset"
            @mousedown.prevent="onFormat(activeListKind, { reset: true })"
          >
            <i class="ri-close-fill"></i> Reset
          </button>
        </div>

        <button
          class="SelectionToolbar-button is-button"
          :class="{ 'has-dot': !!(active && active.quote) }"
          title="Quote"
          @mousedown.prevent="onFormat('quote')"
        >
          <i class="ri-double-quotes-r"></i>
        </button>

        <button
          class="SelectionToolbar-button is-button"
          :class="{ 'has-dot': !!(active && !!active.callout) }"
          title="Notice block"
          @mousedown.prevent="openMenu('notice')"
        >
          <i :class="noticeTriggerIcon"></i>
        </button>
        <div
          v-if="menu === 'notice'"
          class="SelectionToolbar-menu"
          @mousedown.prevent
        >
          <button
            v-for="c of calloutTypes"
            :key="c.type"
            class="SelectionToolbar-button is-button"
            :title="c.label"
            @mousedown.prevent="onFormat('callout', { calloutType: c.type })"
          >
            <i
              :class="[
                c.icon,
                { 'has-dot': !!(active && active.callout === c.type) },
              ]"
            ></i>
            <span class="SelectionToolbar-menuLabel">{{ c.label }}</span>
          </button>
          <button
            v-if="active && active.callout"
            class="SelectionToolbar-button is-button reset"
            title="Reset"
            @mousedown.prevent="
              onFormat('callout', { calloutType: active.callout!, reset: true })
            "
          >
            <i class="ri-close-fill"></i> Reset
          </button>
        </div>
      </div>

      <!-- Section 2: inline formats -->
      <div class="SelectionToolbar-section">
        <button
          v-for="b of inlineButtons"
          :key="b.type"
          class="SelectionToolbar-button is-button"
          :class="{ 'has-dot': activeDot(b.type) }"
          :title="b.title"
          @mousedown.prevent="onInline(b.type)"
        >
          <i :class="b.icon"></i>
        </button>
      </div>

      <!-- Section 3: link -->
      <div class="SelectionToolbar-section">
        <button
          class="SelectionToolbar-button is-button"
          title="Link"
          @mousedown.prevent="toggleLink"
        >
          <i class="ri-link"></i>
        </button>
      </div>

      <!-- Section 4: last used + more -->
      <div class="SelectionToolbar-section">
        <button
          v-if="lastUsedTool"
          class="SelectionToolbar-button is-button"
          :class="{ 'has-dot': activeDot(lastUsedTool.type) }"
          :title="lastUsedTool.title"
          @mousedown.prevent="onOther(lastUsedTool.type)"
        >
          <i :class="lastUsedTool.icon"></i>
        </button>
        <button
          class="SelectionToolbar-button is-button"
          title="More"
          @mousedown.prevent="openMenu('more')"
        >
          <i class="ri-more-2-fill"></i>
        </button>
        <div
          v-if="menu === 'more'"
          class="SelectionToolbar-menu"
          @mousedown.prevent
        >
          <button
            v-for="t of otherTools"
            :key="t.type"
            class="SelectionToolbar-button is-button"
            :title="t.title"
            @mousedown.prevent="onOther(t.type)"
          >
            <i :class="[t.icon, { 'has-dot': activeDot(t.type) }]"></i>
            <span class="SelectionToolbar-menuLabel">{{ t.title }}</span>
          </button>
        </div>
      </div>

      <!-- Link popover -->
      <div
        v-if="linkOpen"
        class="SelectionToolbar-linkPopover"
        @mousedown.prevent
      >
        <input
          ref="urlInput"
          v-model="url"
          class="SelectionToolbar-input"
          placeholder="https://..."
          @keyup.enter="applyLink"
        />
        <button
          class="is-button SelectionToolbar-apply"
          :disabled="!url.trim()"
          @click="applyLink"
        >
          <i class="ri-check-fill"></i>
        </button>
        <button
          class="is-button SelectionToolbar-browse"
          title="Select element"
          @click="browseAsset"
        >
          <i class="ri-file-search-line"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { SelectionRect } from './plugins/selection-toolbar';
import type {
  ActiveFormats,
  FormatType,
  FormatPayload,
} from './format-commands';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import SelectAssetDialog from '~ims-app-base/components/Asset/SelectAssetDialog.vue';

type ButtonDef = { type: FormatType; title: string; icon: string };
type CalloutDef = { type: string; icon: string };

export default defineComponent({
  name: 'SelectionToolbar',
  props: {
    rect: { type: Object as () => SelectionRect, required: true },
    active: { type: Object as () => ActiveFormats | null, default: null },
  },
  emits: ['format'],
  data() {
    return {
      menu: null as string | null,
      linkOpen: false,
      url: '',
      headingLevels: [1, 2, 3, 4],
      calloutTypes: [
        { type: 'info', icon: 'ri-information-2-line', label: 'Info' },
        { type: 'warning', icon: 'ri-alert-line', label: 'Warning' },
        {
          type: 'solution',
          icon: 'ri-checkbox-circle-line',
          label: 'Solution',
        },
        { type: 'error', icon: 'ri-error-warning-line', label: 'Error' },
      ] as CalloutDef[],
      inlineButtons: [
        { type: 'bold', title: 'Bold', icon: 'ri-bold' },
        { type: 'italic', title: 'Italic', icon: 'ri-italic' },
        { type: 'highlight', title: 'Highlight', icon: 'ri-mark-pen-fill' },
      ] as ButtonDef[],
      otherTools: [
        { type: 'code_block', title: 'Code block', icon: 'ri-code-box-fill' },
        { type: 'strike', title: 'Strikethrough', icon: 'ri-strikethrough' },
        { type: 'code', title: 'Inline code', icon: 'ri-code-s-slash-fill' },
        { type: 'superscript', title: 'Superscript', icon: 'ri-superscript' },
        { type: 'subscript', title: 'Subscript', icon: 'ri-subscript' },
        { type: 'formula', title: 'Formula', icon: 'ri-formula' },
      ] as ButtonDef[],
      lastUsed: this.$getAppManager()
        .get(UiPreferenceManager)
        .getPreference<string>('MarkdownBlockEditor-lastUsedTool', ''),
    };
  },
  computed: {
    positionStyle(): Record<string, string> {
      const above = this.rect.top > 60;
      return {
        left: `${this.rect.left}px`,
        top: above ? `${this.rect.top}px` : `${this.rect.bottom}px`,
        transform: above
          ? 'translate(-50%, calc(-100% - 8px))'
          : 'translate(-50%, 8px)',
      };
    },
    activeHeading(): 'h1' | 'h2' | 'h3' | 'h4' | null {
      const a = this.active;
      if (!a) return null;
      if (a.h1) return 'h1';
      if (a.h2) return 'h2';
      if (a.h3) return 'h3';
      if (a.h4) return 'h4';
      return null;
    },
    activeListKind(): 'bullet_list' | 'ordered_list' | 'task_list' | null {
      const a = this.active;
      if (!a) return null;
      if (a.task) return 'task_list';
      if (a.bullet) return 'bullet_list';
      if (a.ordered) return 'ordered_list';
      return null;
    },
    headingTriggerIcon(): string {
      return this.activeHeading
        ? 'ri-h-' + this.activeHeading.slice(1)
        : 'ri-heading';
    },
    listTriggerIcon(): string {
      const map: Record<string, string> = {
        bullet_list: 'ri-list-unordered',
        ordered_list: 'ri-list-ordered',
        task_list: 'ri-list-check-2',
      };
      return this.activeListKind ? map[this.activeListKind] : 'ri-list-check';
    },
    noticeTriggerIcon(): string {
      if (this.active && this.active.callout) {
        const c = this.calloutTypes.find(
          (t) => t.type === this.active!.callout,
        );
        if (c) return c.icon;
      }
      return 'ri-text-block';
    },
    lastUsedTool(): ButtonDef | null {
      return this.otherTools.find((t) => t.type === this.lastUsed) ?? null;
    },
  },
  mounted() {
    window.addEventListener('mousedown', this.onWindowMouseDown);
  },
  unmounted() {
    window.removeEventListener('mousedown', this.onWindowMouseDown);
  },
  methods: {
    activeDot(type: FormatType): boolean {
      const a = this.active as Record<string, unknown> | null;
      return !!(a && a[type]);
    },
    openMenu(name: string) {
      this.linkOpen = false;
      this.menu = this.menu === name ? null : name;
    },
    toggleLink() {
      this.menu = null;
      this.linkOpen = !this.linkOpen;
      if (this.linkOpen) {
        this.$nextTick(() =>
          (this.$refs['urlInput'] as HTMLInputElement | undefined)?.focus(),
        );
      }
    },
    onFormat(type: FormatType, payload: FormatPayload = {}) {
      this.$emit('format', { type, payload });
      this.menu = null;
      this.linkOpen = false;
    },
    onInline(type: FormatType) {
      const payload: FormatPayload = this.activeDot(type)
        ? { reset: true }
        : {};
      this.onFormat(type, payload);
    },
    onOther(type: FormatType) {
      const payload: FormatPayload = this.activeDot(type)
        ? { reset: true }
        : {};
      this.onFormat(type, payload);
      this.lastUsed = type;
      this.$getAppManager()
        .get(UiPreferenceManager)
        .setPreference('MarkdownBlockEditor-lastUsedTool', type);
    },
    applyLink() {
      const url = this.url.trim();
      if (!url) return;
      this.onFormat('link', { url });
      this.url = '';
    },
    async browseAsset() {
      const dialog = this.$getAppManager()
        .get(DialogManager)
        .show(SelectAssetDialog, {}, this);
      const res = await dialog;
      if (res) {
        const ref =
          (res as { id?: string; name?: string }).id ??
          (res as { name?: string }).name;
        if (ref) {
          this.onFormat('link', { internal: String(ref) });
        }
      }
    },
    onWindowMouseDown(e: MouseEvent) {
      const root = this.$refs['root'] as HTMLElement | undefined;
      if (root && !root.contains(e.target as Node)) {
        this.menu = null;
        this.linkOpen = false;
      }
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
  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  padding: 2px 0;
}

.SelectionToolbar-section {
  position: relative;
  display: flex;
  border-right: 1px solid var(--local-border-color);
  padding: 0 4px;

  &:last-child {
    border-right: none;
  }
}

.SelectionToolbar-button {
  position: relative;
  background: transparent;
  border: none;
  color: var(--local-text-color);
  padding: 7px 5px;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
  font-weight: normal;

  &:hover {
    background-color: var(--dropdown-hl-bg-color);
  }

  i {
    font-size: 17px;
  }

  &.has-dot::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--color-accent, #2f80ed);
  }

  i.has-dot {
    position: relative;
  }

  i.has-dot::after {
    content: '';
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--color-accent, #2f80ed);
  }
}

.SelectionToolbar-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  pointer-events: auto;
  z-index: 1;

  .SelectionToolbar-button {
    width: 100%;
    text-align: left;
  }

  .SelectionToolbar-menuLabel {
    margin-left: 7px;
    white-space: nowrap;
  }

  .reset {
    font-size: 12px;
    color: var(--color-danger, #e05252);

    i {
      font-size: 13px;
    }
  }
}

.SelectionToolbar-linkPopover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  pointer-events: auto;
}

.SelectionToolbar-input {
  width: 220px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--local-border-color);
  background-color: var(--local-box-color);
  color: var(--local-text-color);
}

.SelectionToolbar-apply,
.SelectionToolbar-browse {
  background: transparent;
  border: none;
  color: var(--color-accent, #2f80ed);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
