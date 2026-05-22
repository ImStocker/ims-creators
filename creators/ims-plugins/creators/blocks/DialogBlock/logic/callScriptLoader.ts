import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import { DialogBlockController } from '../editor/DialogBlockController';

export async function loadCallScriptController(
  appManager: IAppManager,
  assetId: string,
): Promise<DialogBlockController | null> {
  try {
    const asset = await appManager
      .get(CreatorAssetManager)
      .getAssetInstance(assetId);
    if (!asset) return null;
    asset.activate();
    const editor = AssetBlockEditorVM.CreateInstance(appManager, asset);
    const controller = new DialogBlockController(
      appManager,
      () =>
        editor.resolveBlocks().list.find((el) => el.name === 'content') ?? null,
    );
    controller.postCreate();
    controller.mountEditor(editor);
    return controller;
  } catch {
    return null;
  }
}
