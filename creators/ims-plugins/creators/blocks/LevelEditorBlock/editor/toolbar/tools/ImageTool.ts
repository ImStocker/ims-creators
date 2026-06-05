import type { UploadingJob } from '~ims-app-base/logic/managers/EditorManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { getClipboardImagesContent } from '~ims-app-base/logic/utils/clipboard';
import Tool from './base/Tool';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import { v4 as uuidv4 } from 'uuid';
import { loadImage } from '~ims-app-base/logic/utils/imageUtils';
import FileManager from '~ims-app-base/logic/managers/FileManager';
import type { ToolSection } from '../ToolManager';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';

export type ImageToolComponentProps = {
  menuList: MenuListItem[];
};

const AllowedExtensions = new Set(['jpg', 'jpeg', 'png', 'bmp', 'svg', 'gif']);

export default class ImageTool extends Tool {
  name = 'image';
  icon = 'ri-image-add-line';
  section: ToolSection = 'draw';
  component = async () =>
    (await import('../LevelEditorToolbarDropdownButton.vue')).default;
  override exclusiveGroup: string = 'drawing';

  private _inputElement: HTMLInputElement | null = null;

  private _uploadJob: UploadingJob | null = null;
  private _uploadTotal: number = 0;
  private _uploadDone: number = 0;

  private _loading: boolean = false;

  override init() {
    this.componentProps = {
      menuList: [
        {
          title: this.appManager.$t(
            'assetEditor.galleryBlockAddFileFromComputer',
          ),
          action: async () => {
            await this._selectFiles();
          },
          icon: 'file',
        },
        {
          title: this.appManager.$t('assetEditor.galleryBlockPasteFromBuffer'),
          action: async () => await this.getFileFromBuffer(),
          icon: 'ri-clipboard-line',
        },
      ],
    };
  }

  override isLoading() {
    return this._loading;
  }

  private get projectId() {
    return this.appManager.get(ProjectManager).getProjectInfo()?.id;
  }

  async processFiles(files: File[]) {
    const files_to_upload: { blob: Blob; name: string }[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      if (!ext || !AllowedExtensions.has(ext.toLowerCase())) {
        this.appManager.get(UiManager).showError(
          this.appManager.$t('file.errorUnsupportedFormat', {
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
  }
  async handleFile(e: any) {
    let files: File[];
    if (e.target && e.target.files) {
      files = [...e.target.files];
      e.target.value = null;
    } else if (e.dataTransfer && e.dataTransfer.files)
      files = [...e.dataTransfer.files];
    else if (this._inputElement && this._inputElement.files)
      files = [...this._inputElement.files];
    else files = [];

    await this.processFiles(files);
  }

  private async _selectFiles() {
    if (!document) return;
    this._inputElement = document.createElement('input');
    this._inputElement.type = 'file';
    this._inputElement.accept = 'image/*';
    this._inputElement.onchange = async (event) => {
      await this.handleFile(event);
    };
    this._inputElement.click();
  }

  async uploadFiles(files: { blob: Blob; name: string }[]) {
    this._uploadTotal += files.length;
    for (const file of files) {
      try {
        await this.uploadBlob(file.blob, file.name);
      } finally {
        this._uploadJob = null;
        this._uploadDone++;
      }
    }
    if (this._uploadTotal === this._uploadDone) {
      this._uploadTotal = 0;
      this._uploadDone = 0;
    }
  }
  async uploadBlob(blob: Blob, file_name: string) {
    await this.appManager.get(UiManager).doTask(async () => {
      this._uploadJob = this.appManager
        .get(EditorManager)
        .attachFile(blob, file_name);
      const res = await this._uploadJob.awaitResult();
      if (!res) return;

      await this._addImageToCanvas(res);
    });
  }

  private async _addImageToCanvas(imageFile: AssetPropValueFile) {
    const vpCenter = this.controller.canvas.getVpCenter();
    const imageURL = this.appManager.get(FileManager).getFileUrl(imageFile);

    await this.appManager.get(UiManager).doTask(async () => {
      this._loading = true;
      const imageElement = await loadImage(imageURL);

      const image = this.controller.createShape({
        id: uuidv4(),
        type: 'image',
        x: vpCenter.x - imageElement.width / 2,
        y: vpCenter.y - imageElement.height / 2,
        params: {
          file: imageFile,
        },
      });
      if (image) {
        this.controller.canvas.setActiveObject(image);
        this.controller.canvas.requestRenderAll();
      }
      this._loading = false;
    });
  }

  async getFileFromBuffer() {
    this.appManager.get(UiManager).doTask(async () => {
      const files: { blob: Blob; name: string }[] =
        await getClipboardImagesContent();
      if (files.length === 0) {
        throw Error(
          this.appManager.$t('assetEditor.galleryBlockPasteFromBufferEmpty'),
        );
      }
      await this.uploadFiles(files);
    });
  }
}
