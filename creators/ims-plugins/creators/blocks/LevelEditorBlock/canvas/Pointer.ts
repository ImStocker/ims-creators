import * as fabric from 'fabric';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { AssetPreviewInfo } from '~ims-app-base/logic/types/AssetsType';
import FileManager from '~ims-app-base/logic/managers/FileManager';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import type { LevelEditorShape } from '../editor/LevelEditor';

const POINTER_SIZE = 100;
const LINE_HEIGHT = 10;
const BG_COLOR = 'rgba(35, 35, 33, 0.9)';

const NO_IMAGE_LINE_HEIGHT = 30;

export default class Pointer extends fabric.Group {
  static override type = 'pointer';

  readonly line: fabric.Line;
  readonly image: fabric.Rect;
  readonly image_bg: fabric.Rect;
  readonly appManager: IAppManager;

  constructor(
    appManager: IAppManager,
    value: LevelEditorShape['value'],
    renderProps: Partial<fabric.GroupProps>,
  ) {
    const pointer_line = new fabric.Line([0, 0, 0, -NO_IMAGE_LINE_HEIGHT], {
      strokeWidth: 3,
      strokeUniform: false,
      originX: 'center',
      originY: 'bottom',
    });

    const pointer_image = new fabric.Rect({
      width: POINTER_SIZE,
      height: 0,
      rx: 20,
      originX: 'center',
      originY: 'bottom',
      top: pointer_line.height,
      visible: false,
    });

    const image_bg = new fabric.Rect({
      width: pointer_image.width,
      height: pointer_image.height,
      rx: pointer_image.rx,
      originY: pointer_image.originY,
      originX: pointer_image.originX,
      top: pointer_image.top,
      visible: false,
      fill: BG_COLOR,
      strokeWidth: 0,
    });

    const objects = [pointer_line, image_bg, pointer_image];

    super(objects, {
      ...renderProps,
      originX: 'center',
      originY: 'bottom',
    });

    this.line = pointer_line;
    this.image = pointer_image;
    this.image_bg = image_bg;
    this.appManager = appManager;

    this.setValue(value);
  }

  setValue(value: LevelEditorShape['value']) {
    if (typeof value !== 'string' && value?.AssetId) {
      this._setImage(value.AssetId);
    } else {
      this._removeImage();
    }
  }

  private _removeImage() {
    if (this.image) {
      this.image.set({
        visible: false,
        height: 0,
      });
      this.image_bg.set({
        visible: false,
        height: 0,
      });
      this.set({
        height: NO_IMAGE_LINE_HEIGHT,
      });

      this.line.set({
        height: NO_IMAGE_LINE_HEIGHT,
        top: this.height / 2,
      });

      this.setCoords();
      this.canvas?.fire('shape:content-changed', { target: this });
    }
  }

  private _setImage(asset_id: string) {
    this.appManager
      .get(CreatorAssetManager)
      .getAssetPreviewViaCache(asset_id)
      .then((asset: AssetPreviewInfo | null) => {
        if (
          !asset ||
          !asset.mainImage ||
          asset.mainImage.type !== 'file' ||
          !(asset.mainImage.value as AssetPropValueFile).FileId
        ) {
          this._removeImage();
          return;
        }

        const asset_image_file = asset.mainImage.value as AssetPropValueFile;
        const image_url = this.appManager.get(FileManager).getFileUrl(asset_image_file);

        fabric.FabricImage.fromURL(image_url, undefined).then((img) => {
          if (this.image) {
            this.set({
              height: POINTER_SIZE + LINE_HEIGHT,
            });
            this.line.set({
              height: LINE_HEIGHT,
              top: this.height / 2,
            });
            this.image.set({
              top: this.line.top - this.line.height,
              height: POINTER_SIZE,
            });
            this.image_bg.set({
              top: this.image.top,
              height: this.image.height,
              visible: true,
            });

            const scale = Math.max(
              this.image.width / img.width,
              this.image.height / img.height,
            );
            const image_pattern = new fabric.Pattern({
              source: img.getElement(),
              repeat: 'no-repeat',
              patternTransform: [scale, 0, 0, scale, 0, 0],
            });

            this.image.set({
              fill: image_pattern,
              visible: true,
            });
            this.setCoords();

            this.canvas?.fire('shape:content-changed', { target: this });
          }

          if (this.canvas) this.canvas.requestRenderAll();
        });
      })
      .catch((err) => {
        this.appManager.get(UiManager).showError(err);
      });
  }
}
