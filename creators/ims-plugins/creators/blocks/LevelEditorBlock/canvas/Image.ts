import * as fabric from 'fabric';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import FileManager from '~ims-app-base/logic/managers/FileManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';

export default class Image extends fabric.FabricImage {
  displayingWidth?: number;
  displayingHeight?: number;

  constructor(
    appManager: IAppManager,
    file: AssetPropValueFile,
    renderProps: Partial<fabric.ImageProps>,
  ) {
    const imageURL = appManager.get(FileManager).getFileUrl(file);

    super(document.createElement('img'), {
      ...renderProps,
      width: renderProps.width || 1,
      height: renderProps.height || 1,
    });
    this.displayingHeight = renderProps.height;
    this.displayingWidth = renderProps.width;

    fabric.FabricImage.fromURL(imageURL, undefined, { ...renderProps })
      .then((img) => {
        this.setElement(img.getElement());
        this.scaleY = this.displayingHeight
          ? this.displayingHeight / this.height
          : 1;
        this.scaleX = this.displayingWidth
          ? this.displayingWidth / this.width
          : 1;
        this.setCoords();
        if (this.canvas) {
          this.canvas.requestRenderAll();
        }
      })
      .catch((err) => {
        appManager.get(UiManager).showError(err);
        if (this.canvas) {
          this.canvas.remove(this);
        }
      });
  }
}
