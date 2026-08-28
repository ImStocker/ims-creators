<template>
  <div ref="root" class="SelectionToolbar">
    <div class="SelectionToolbar-bubble">
      <!-- Section 1: block formats -->
      <div v-if="!inlineOnly" class="SelectionToolbar-section">
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
            class="SelectionToolbar-button is-button"
            title="Reset"
            @mousedown.prevent="onFormat(activeHeading, { reset: true })"
          >
            <i class="ri-close-fill"></i>
            <span class="SelectionToolbar-menuLabel">Reset</span>
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
            class="SelectionToolbar-button is-button"
            title="Reset"
            @mousedown.prevent="onFormat(activeListKind, { reset: true })"
          >
            <i class="ri-close-fill"></i>
            <span class="SelectionToolbar-menuLabel">Reset</span>
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
            class="SelectionToolbar-button is-button"
            title="Reset"
            @mousedown.prevent="
              onFormat('callout', { calloutType: active.callout!, reset: true })
            "
          >
            <i class="ri-close-fill"></i>
            <span class="SelectionToolbar-menuLabel">Reset</span>
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
          :class="{ 'has-dot': !!(active && active.link) }"
          title="Link"
          @mousedown.prevent="openMenu('link')"
        >
          <i class="ri-link"></i>
        </button>
        <div
          v-if="menu === 'link'"
          class="SelectionToolbar-menu SelectionToolbar-linkMenu"
          @mousedown.prevent
        >
          <div class="SelectionToolbar-linkSection">
            <button
              class="SelectionToolbar-button is-button"
              title="Select element"
              @mousedown.prevent="browseAsset"
            >
              <i class="ri-file-search-line"></i>
            </button>
          </div>
          <template v-if="active && active.linkAsset">
            <div class="SelectionToolbar-linkSection">
              <span class="SelectionToolbar-linkTitle">{{
                active.linkTitle
              }}</span>
            </div>
            <div class="SelectionToolbar-linkSection">
              <button
                class="SelectionToolbar-button is-button danger"
                title="Remove link"
                @mousedown.prevent="removeLink"
              >
                <i class="ri-link-unlink"></i>
              </button>
            </div>
          </template>
          <template v-else>
            <div class="SelectionToolbar-linkSection">
              <input
                ref="urlInput"
                v-model="url"
                class="SelectionToolbar-input"
                placeholder="https://..."
                @keyup.enter="applyLink"
              />
              <button
                class="SelectionToolbar-button is-button"
                :disabled="!url.trim()"
                title="Apply link"
                @mousedown.prevent="applyLink"
              >
                <i class="ri-check-fill"></i>
              </button>
            </div>
            <div
              v-if="url.trim() && active && active.link"
              class="SelectionToolbar-linkSection"
            >
              <a
                v-if="isHttp(url)"
                class="SelectionToolbar-button is-button"
                :href="url"
                target="_blank"
                title="Open link"
              >
                <i class="ri-external-link-fill"></i>
              </a>
              <button
                class="SelectionToolbar-button is-button danger"
                title="Remove link"
                @mousedown.prevent="removeLink"
              >
                <i class="ri-link-unlink"></i>
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Section 4: last used + more -->
      <div class="SelectionToolbar-section">
        <button
          v-if="lastUsedTool && !(inlineOnly && isBlock(lastUsedTool.type))"
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
            v-for="t of inlineOnly ? inlineTools : otherTools"
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
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import { getQueryAssetPropsSelection } from '~ims-app-base/logic/expression/filter/filterExpression';

type ButtonDef = { type: FormatType; title: string; icon: string };
type CalloutDef = { type: string; icon: string };

export default defineComponent({
  name: 'SelectionToolbar',
  props: {
    rect: { type: Object as () => SelectionRect, required: true },
    active: { type: Object as () => ActiveFormats | null, default: null },
    inlineOnly: { type: Boolean, default: false },
    text: { type: String, default: '' },
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
    inlineTools(): ButtonDef[] {
      return this.otherTools.filter((t) => !this.isBlock(t.type));
    },
    assetLinkRootWorkspace() {
      const gdd_workspace = this.$getAppManager()
        .get(ProjectManager)
        .getWorkspaceByName('gdd');
      return gdd_workspace;
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
    isBlock(type: FormatType): boolean {
      return [
        'h1',
        'h2',
        'h3',
        'h4',
        'bullet_list',
        'ordered_list',
        'task_list',
        'quote',
        'callout',
        'code_block',
      ].includes(type);
    },
    openMenu(name: string) {
      this.linkOpen = false;
      if (name === 'link') {
        this.url =
          this.active && this.active.link && !this.active.linkAsset
            ? this.active.link
            : '';
        this.$nextTick(() =>
          (this.$refs['urlInput'] as HTMLInputElement | undefined)?.focus(),
        );
      }
      this.menu = this.menu === name ? null : name;
    },
    onFormat(type: FormatType, payload: FormatPayload = {}) {
      this.$emit('format', { type, payload });
      this.menu = null;
      this.linkOpen = false;
    },
    isHttp(url: string): boolean {
      return /^(https?|mailto|tel|sms):\/\//.test(url);
    },
    removeLink() {
      this.onFormat('link', { reset: true });
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
      if (!this.assetLinkRootWorkspace) {
        return;
      }
      const dialog = this.$getAppManager()
        .get(DialogManager)
        .show(
          SelectAssetDialog,
          {
            searchValue: getQueryAssetPropsSelection(
              this.text ? this.text.trim() : '',
            ),
            where: {
              workspaceids: this.assetLinkRootWorkspace.id,
            },
          },
          this,
        );
      const res = await dialog;
      if (res && (res as { id?: string }).id) {
        const id = (res as { id: string }).id;
        const name = (res as { name?: string }).name ?? '';
        const text = this.text;
        this.onFormat('link', { internal: id, internalName: name, text });
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
  top: 100%;
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
}

.SelectionToolbar-linkMenu {
  flex-direction: row;
  align-items: center;

  .SelectionToolbar-button {
    width: auto;
    text-align: center;
  }
}

.SelectionToolbar-linkSection {
  border-right: 1px solid var(--local-border-color);
  padding: 0 5px;
  display: flex;
  align-items: center;

  &:last-child {
    border-right: none;
  }
}

.SelectionToolbar-linkTitle {
  white-space: nowrap;
  margin-right: 4px;
}

.SelectionToolbar-menu .SelectionToolbar-button.danger {
  color: var(--color-danger, #e05252);
}

.SelectionToolbar-input {
  width: 220px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--local-border-color);
  background-color: var(--local-box-color);
  color: var(--local-text-color);
}
</style>
