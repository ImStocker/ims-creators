<template>
  <div class="AssetBlockGameObjectEditor">
    <div v-if="galleryBlockTagId" :id="galleryBlockTagId"></div>
    <div class="AssetBlockGameObjectEditor-header">
      <div v-if="galleryBlock" class="AssetBlockGameObjectEditor-gallery">
        <game-object-gallery-block
          class="AssetBlockGameObjectEditor-gallery-block"
          :asset-block-editor="assetBlockEditor"
          :asset-changer="assetBlockEditor.assetChanger"
          :resolved-block="galleryBlock"
          :readonly="galleryBlockReadonly"
        ></game-object-gallery-block>
      </div>
      <asset-block-editor
        ref="descriptionEditor"
        class="AssetBlockGameObjectEditor-description"
        :asset-block-editor="assetBlockEditor"
        :filter-blocks="
          (block) => !!block.name && ['description'].includes(block.name)
        "
        :allow-add-blocks="false"
        :allow-drag-blocks="false"
        :allow-collapse-blocks="false"
        :show-comments="showComments"
        :hide-root-links="true"
        :hide-blocks="(block) => block.name !== 'locale'"
        @update:is-dirty="$emit('update:is-dirty', $event)"
      ></asset-block-editor>
    </div>
    <asset-block-editor
      ref="otherEditor"
      class="AssetBlockGameObjectEditor-main"
      :asset-block-editor="assetBlockEditor"
      :filter-blocks="
        (block) =>
          !block.name ||
          !['gallery', 'description', 'locale'].includes(block.name)
      "
      :hide-root-links="hideRootLinks"
      :show-comments="showComments"
      @update:is-dirty="$emit('update:is-dirty', $event)"
    ></asset-block-editor>
  </div>
</template>

<script lang="ts">
import { type PropType, defineComponent } from 'vue';
import AssetBlockEditor from '~ims-app-base/components/Asset/Editor/AssetBlockEditor.vue';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import GameObjectGalleryBlock from './GameObjectGalleryBlock.vue';
import { AssetRights } from '~ims-app-base/logic/types/Rights';
import { makeBlockIdAnchorTagId } from '~ims-app-base/logic/utils/assets';
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed';

export default defineComponent({
  name: 'AssetBlockGameObjectEditor',
  components: {
    AssetBlockEditor,
    GameObjectGalleryBlock,
  },
  props: {
    assetBlockEditor: {
      type: Object as PropType<AssetBlockEditorVM>,
      required: true,
    },
    hideRootLinks: {
      type: Boolean,
      default: false,
    },
    showComments: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:is-dirty'],
  data() {
    return {};
  },
  computed: {
    isDirty() {
      return this.assetBlockEditor.getHasChanges();
    },
    resolvedBlocks() {
      return this.assetBlockEditor.resolveBlocks();
    },
    descriptionBlock() {
      return this.resolvedBlocks.mapNames['description'] ?? null;
    },
    galleryBlockTagId() {
      if (!this.galleryBlock) return undefined;
      return makeBlockIdAnchorTagId(this.galleryBlock.id);
    },
    galleryBlock() {
      return this.resolvedBlocks.mapNames['gallery'] ?? null;
    },
    galleryBlockReadonly() {
      return (
        !this.galleryBlock || this.galleryBlock.rights <= AssetRights.READ_ONLY
      );
    },
  },
  mounted() {
    this.$emit('update:is-dirty', this.isDirty);
  },
  methods: {
    async revealAssetBlock(blockId: string, anchor?: string): Promise<boolean> {
      if (!this.$el) {
        return false;
      }
      if (this.galleryBlock && this.galleryBlock.id === blockId) {
        const element = window.document.getElementById(this.galleryBlockTagId);
        if (!element) {
          return false;
        }

        scrollIntoViewIfNeeded(element as HTMLElement, {
          behavior: 'smooth',
          scrollMode: 'if-needed',
        });

        return true;
      }
      if (this.descriptionBlock && this.descriptionBlock.id === blockId) {
        const descriptionEditor = this.$refs[
          'descriptionEditor'
        ] as InstanceType<typeof AssetBlockEditor> | null;
        if (!descriptionEditor) return false;
        return descriptionEditor.revealAssetBlock(blockId, anchor);
      }

      const otherEditor = this.$refs['otherEditor'] as InstanceType<
        typeof AssetBlockEditor
      > | null;
      if (!otherEditor) return false;
      return otherEditor.revealAssetBlock(blockId, anchor);
    },
  },
});
</script>
<style lang="scss" scoped>
@use '~ims-app-base/style/devices-mixins.scss';
.AssetBlockGameObjectEditor {
  display: flex;
  flex-direction: column;
}
.AssetBlockGameObjectEditor-header {
  --editor-block-padding-left: 25px;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
.AssetBlockGameObjectEditor-gallery {
  border-top-left-radius: 4px;
  padding-top: 15px;
  padding-left: var(--editor-block-padding-left);
  margin-right: 0px;
}
.AssetBlockGameObjectEditor-main {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  flex: 1;
}

@include devices-mixins.device-type(not-mb) {
  .AssetBlockGameObjectEditor-header {
    display: flex;
    gap: 10px;
  }

  .AssetBlockGameObjectEditor-gallery {
    border-top-left-radius: 4px;
    width: calc(200px + var(--editor-block-padding-left));
    max-width: 30dvw;
  }

  .AssetBlockGameObjectEditor-description {
    flex: 1;
    --editor-block-padding-left: 15px;
  }
}
</style>
