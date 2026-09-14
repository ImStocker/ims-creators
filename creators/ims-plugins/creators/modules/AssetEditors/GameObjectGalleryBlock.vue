<template>
  <div
    class="GameObjectGalleryBlock"
    :class="{
      'state-drag-ok': dragEffect === 1,
      'state-drag-error': dragEffect === -1,
    }"
    @drop.prevent="dropFile"
    @dragover.prevent="dragFileEnter"
    @dragleave.prevent="dragFileLeave"
  >
    <div v-if="mainItem">
      <screenshot-renderer
        :disabled="displayMode !== 'print'"
        :ready="ready"
        @rendering-done="$emit('view-ready')"
      >
        <gallery-block-item
          class="GameObjectGalleryBlock-itemContent"
          :readonly="readonly"
          :item="mainItem"
          :files="[mainItem]"
          :allow-caption="false"
          @delete="deleteImage(mainItem)"
        ></gallery-block-item
      ></screenshot-renderer>
    </div>
    <div
      v-else-if="uploadProgressPercent !== null"
      class="GameObjectGalleryBlock-uploadProgressPercent"
    >
      <div
        class="GameObjectGalleryBlock-uploadProgressPercent-bar"
        :style="{
          transform: `scaleY(${uploadProgressPercent}%)`,
        }"
      ></div>
      <div class="GameObjectGalleryBlock-uploadProgressPercent-content">
        {{ $t('file.uploading') }}
        <br />
        {{ uploadProgressPercent }}%
      </div>
    </div>
    <div
      v-else-if="!readonly"
      class="GameObjectGalleryBlock-add"
      :title="$t('assetEditor.galleryBlockAddImage')"
      @click="onAddButtonSlotClick"
    >
      <menu-button
        v-if="!readonly"
        class="use-buttons-action"
        @show="enterEditMode()"
        @hide="exitEditMode()"
      >
        <template #button="{ tooltip, show }">
          <button
            ref="addButton"
            class="GameObjectGalleryBlock-add-button is-button is-button-icon"
            :title="tooltip"
            @click="show"
          >
            <i class="ri-image-fill"></i>
          </button>
        </template>
        <menu-list :menu-list="menuList"></menu-list>
      </menu-button>
      <input
        ref="fileInput"
        type="file"
        style="display: none"
        :accept="fileAccept"
        @change="handleFile"
      />
    </div>
    <div v-else class="GameObjectGalleryBlock-empty">
      <i class="ri-image-fill"></i>
    </div>
  </div>
</template>

<script lang="ts">
import { type PropType, type UnwrapRef, defineComponent } from 'vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type {
  AssetDisplayMode,
  ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import {
  extractGalleryBlockEntries,
  type GalleryBlockExtractedEntries,
  type GalleryBlockItemObject,
} from '~ims-plugin-base/blocks/GalleryBlock/GalleryBlock';
import GalleryBlockItem from '~ims-plugin-base/blocks/GalleryBlock/GalleryBlockItem.vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import { nodeContainsElement } from '~ims-app-base/components/utils/DomElementUtils';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import ExternalLinkDialog from '~ims-plugin-base/blocks/GalleryBlock/ExternalLinkDialog.vue';
import { getNextIndexWithTimestamp } from '~ims-app-base/components/Asset/Editor/blockUtils';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import { getClipboardImagesContent } from '~ims-app-base/logic/utils/clipboard';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import ScreenshotRenderer from '~ims-app-base/components/Common/ScreenshotRenderer.vue';
import { makeBlockRef } from '~ims-app-base/logic/types/Props';
import EditorManager, {
  type UploadingJob,
} from '~ims-app-base/logic/managers/EditorManager';

const AllowedExtensions = new Set(['jpg', 'jpeg', 'png', 'bmp', 'svg', 'gif']);

const SET_GALLERY_KEY = 'main';

export default defineComponent({
  name: 'GameObjectGalleryBlock',
  components: {
    GalleryBlockItem,
    MenuButton,
    MenuList,
    ScreenshotRenderer,
  },
  props: {
    assetBlockEditor: {
      type: Object as PropType<AssetBlockEditorVM>,
      required: true,
    },
    resolvedBlock: {
      type: Object as PropType<UnwrapRef<ResolvedAssetBlock>>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    assetChanger: {
      type: Object as PropType<UnwrapRef<AssetChanger>>,
      required: true,
    },
    displayMode: {
      type: String as PropType<AssetDisplayMode>,
      default: () => 'normal',
    },
  },
  emits: ['save', 'view-ready'],
  data() {
    return {
      dragEffect: 0,
      uploadJob: null as UploadingJob | null,
      uploadTotal: 0,
      uploadDone: 0,
      ready: false,
    };
  },
  computed: {
    menuList() {
      return [
        {
          title: this.$t('assetEditor.galleryBlockAddFileFromComputer'),
          action: this.selectFiles,
          icon: 'file',
        },
        {
          title: this.$t('assetEditor.galleryBlockAddVideoLink'),
          action: this.addVideoLink,
          icon: 'video',
        },
        {
          title: this.$t('assetEditor.galleryBlockAddExternalImage'),
          action: this.addImageLink,
          icon: 'image',
        },
        {
          title: this.$t('assetEditor.galleryBlockPasteFromBuffer'),
          action: this.getFileFromBuffer,
          icon: 'ri-clipboard-line',
        },
      ];
    },
    fileAccept() {
      return [...AllowedExtensions].map((x) => `.${x}`).join(',');
    },
    realEntries(): GalleryBlockExtractedEntries {
      return extractGalleryBlockEntries(this.resolvedBlock);
    },
    mainItem() {
      return this.realEntries.list.find((item) => item.key === SET_GALLERY_KEY);
    },
    galleryItems(): GalleryBlockItemObject[] {
      return this.realEntries.list;
    },
    projectId() {
      return this.assetBlockEditor.projectInfo.id;
    },
    uploadProgressPercent() {
      if (this.uploadTotal <= 0) {
        return null;
      }
      const val =
        (this.uploadDone + (this.uploadJob ? this.uploadJob.progress : 0)) /
        this.uploadTotal;
      return Math.round(val * 100);
    },
    getProjectInfo(): any {
      return this.assetBlockEditor.projectInfo;
    },
  },
  mounted() {
    this.$emit('view-ready');
  },
  _methods: {
    enterEditMode() {
      if (this.readonly) return;
      this.assetBlockEditor.enterEditMode(this.resolvedBlock.id);
      if (!this.$refs.addButton) return;
      (this.$refs.addButton as HTMLButtonElement).click();
    },
    exitEditMode() {
      this.assetBlockEditor.exitEditMode();
    },
    showError(error: any) {
      this.$getAppManager().get(UiManager).showError(error);
    },
    async uploadFiles(files: { blob: Blob; name: string }[]) {
      this.uploadTotal += files.length;
      for (const file of files) {
        try {
          await this.uploadBlob(file.blob, file.name);
        } finally {
          this.uploadJob = null;
          this.uploadDone++;
        }
      }
      if (this.uploadTotal === this.uploadDone) {
        this.uploadTotal = 0;
        this.uploadDone = 0;
      }
    },
    async uploadBlob(blob: Blob, file_name: string) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.uploadJob = this.$getAppManager()
            .get(EditorManager)
            .attachFile(blob, file_name);

          const res = await this.uploadJob.awaitResult();
          if (!res) return;

          const new_key = SET_GALLERY_KEY;
          this.assetChanger.setBlockPropKeys(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            {
              [`${new_key}\\value`]: res,
              [`${new_key}\\type`]: 'file',
              [`${new_key}\\index`]: getNextIndexWithTimestamp(
                this.realEntries.maxIndex,
              ),
            },
          );
          this.save();
        });
    },
    async processFiles(files: File[]) {
      if (files.length === 0) return;
      else if (files.length > 1) files = [files[0]];

      const files_to_upload: { blob: Blob; name: string }[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        if (!ext || !AllowedExtensions.has(ext.toLowerCase())) {
          this.showError(
            this.$t('file.errorUnsupportedFormat', {
              file: file.name,
            }),
          );
        } else {
          files_to_upload.push({
            blob: file,
            name: file.name,
          });
        }
      }
      await this.uploadFiles(files_to_upload);
    },
    async handleFile(e: any) {
      if (this.readonly) {
        return;
      }
      let files: File[];
      if (e.target && e.target.files) {
        files = [...e.target.files];
        e.target.value = null;
      } else if (e.dataTransfer && e.dataTransfer.files)
        files = [...e.dataTransfer.files];
      else if (this.$refs.fileInput && (this.$refs.fileInput as any).files)
        files = [...(this.$refs.fileInput as any).files];
      else files = [];

      await this.processFiles(files);
    },
    selectFiles() {
      const upload_input = this.$refs.fileInput as HTMLInputElement | undefined;
      if (!upload_input) return;
      upload_input.onchange = (e) => {
        this.handleFile(e);
      };
      upload_input.click();
    },
    async getFileFromBuffer() {
      this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          const files: { blob: Blob; name: string }[] =
            await getClipboardImagesContent();
          if (files.length === 0) {
            throw Error(
              this.$t('assetEditor.galleryBlockPasteFromBufferEmpty'),
            );
          }
          await this.uploadFiles(files);
        });
    },
    async addVideoLink() {
      const video = await this.$getAppManager()
        .get(DialogManager)
        .show(ExternalLinkDialog, {
          yesCaption: this.$t('common.dialogs.save'),
          header: this.$t('assetEditor.galleryBlockAddVideoLinkMessage'),
          placeholder: this.$t(
            'assetEditor.galleryBlockAddVideoLinkPlaceholder',
          ),
          fileType: 'video',
        });
      if (video) {
        const new_key = SET_GALLERY_KEY;
        this.assetChanger.setBlockPropKeys(
          this.resolvedBlock.assetId,
          makeBlockRef(this.resolvedBlock),
          null,
          {
            [`${new_key}\\value`]: video.value,
            [`${new_key}\\type`]: video.type,
            [`${new_key}\\index`]: getNextIndexWithTimestamp(
              this.realEntries.maxIndex,
            ),
          },
        );
        this.save();
      }
    },
    async addImageLink() {
      const image = await this.$getAppManager()
        .get(DialogManager)
        .show(ExternalLinkDialog, {
          yesCaption: this.$t('common.dialogs.save'),
          fileType: 'image',
          header: this.$t('assetEditor.galleryBlockAddExternalImageMessage'),
          placeholder: this.$t(
            'assetEditor.galleryBlockAddExternalImagePlaceholder',
          ),
        });
      if (image) {
        const new_key = SET_GALLERY_KEY;
        this.assetChanger.setBlockPropKeys(
          this.resolvedBlock.assetId,
          makeBlockRef(this.resolvedBlock),
          null,
          {
            [`${new_key}\\value`]: image.value,
            [`${new_key}\\type`]: image.type,
            [`${new_key}\\index`]: getNextIndexWithTimestamp(
              this.realEntries.maxIndex,
            ),
          },
        );
        this.save();
      }
    },
    save() {
      this.$emit('save');
    },
    deleteImage(item: GalleryBlockItemObject) {
      this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.assetChanger.deleteBlockPropKey(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            `${item.key}`,
          );
          this.save();
        });
    },
    dropFile(ev: DragEvent) {
      if (!ev.dataTransfer) {
        return;
      }
      this.dragEffect = 0;
      this.handleFile(ev);
    },
    dragFileEnter(ev: DragEvent) {
      const is_file_move =
        ev.dataTransfer && ev.dataTransfer.types.includes('Files');
      this.dragEffect = is_file_move ? 1 : 0;
      if (is_file_move && ev.dataTransfer && ev.dataTransfer.items) {
        const are_images = [...ev.dataTransfer.items].some((i) => {
          return /^image\/.+$/i.test(i.type);
        });
        this.dragEffect = are_images ? 1 : -1;
      }
      if (ev.dataTransfer && this.dragEffect !== 1) {
        ev.dataTransfer.dropEffect = 'none';
      }
    },
    dragFileLeave(ev: DragEvent) {
      if (!nodeContainsElement(this.$el, ev.relatedTarget as Node)) {
        this.dragEffect = 0;
      }
    },
    onAddButtonSlotClick() {
      if (!this.$refs.addButton) {
        return;
      }
      (this.$refs.addButton as HTMLButtonElement).focus();
      (this.$refs.addButton as HTMLButtonElement).click();
    },
  },
  get methods() {
    return this._methods;
  },
  set methods(value) {
    this._methods = value;
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.GameObjectGalleryBlock {
  border: 1px solid var(--local-bg-color);
  border-radius: 4px;
  display: flex;
  justify-content: center;

  &.state-drag-ok {
    border-color: var(--color-main-yellow);
  }

  &.state-drag-error {
    border-color: var(--color-main-error);
  }
}

.GameObjectGalleryBlock-uploadProgressPercent,
.GameObjectGalleryBlock-uploadProgressPercent-content {
  width: 200px;
  max-width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: 4px;
  box-sizing: border-box;
  padding: 20px;
}

.GameObjectGalleryBlock-uploadProgressPercent {
  border: 1px solid var(--color-main-yellow);
  color: var(--color-main-yellow);
  position: relative;
}

.GameObjectGalleryBlock-uploadProgressPercent-bar,
.GameObjectGalleryBlock-uploadProgressPercent-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.GameObjectGalleryBlock-uploadProgressPercent-bar {
  background: var(--color-main-yellow);
  opacity: 0.02;
  transform-origin: bottom;
}

.GameObjectGalleryBlock-itemContent {
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.GameObjectGalleryBlock-add {
  cursor: pointer;
  &:hover {
    background: var(--button-bg-color-hover);
  }
}

.GameObjectGalleryBlock-add,
.GameObjectGalleryBlock-empty {
  width: 100%;
  height: 200px;
  box-sizing: border-box;
  border: 1px solid var(--local-border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.GameObjectGalleryBlock-empty,
.GameObjectGalleryBlock-add-button {
  font-size: 36px;
  --button-bg-color: transparent !important;
  --button-outline-color: transparent !important;
}

.GameObjectGalleryBlock-add-button {
  &:hover {
    background: transparent;
  }
}
.GameObjectGalleryBlock-itemContent:deep(.GalleryBlockItem-content) {
  border-radius: 4px;
}
</style>
