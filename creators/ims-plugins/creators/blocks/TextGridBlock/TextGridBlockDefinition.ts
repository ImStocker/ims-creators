import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { AssetProps } from '~ims-app-base/logic/types/Props';
import { textGridBlockAiSpec } from './TextGridBlockAiSpec';

export class TextGridBlockDefinition extends BlockTypeDefinition {
  name = 'textgrid';
  component = async () => (await import('./TextGridBlock.vue')).default;
  icon = 'layout-grid-fill';
  override hideInAdding = false;
  override focusOnAdded = false;
  override aiSpec = textGridBlockAiSpec.aiSpec;
  override async beforeBlockCreate(
    appManager: IAppManager,
    params: { title: string },
  ): Promise<{ title: string; props?: AssetProps } | undefined> {
    const TextGridBlockSettingsDialog = (
      await import('./TextGridBlockSettingsDialog.vue')
    ).default;
    const res = await appManager
      .get(DialogManager)
      .show(TextGridBlockSettingsDialog, {
        columnsCount: 4,
      });
    if (!res) return undefined;
    return {
      title: params.title,
      props: {
        columns: res.columnsCount,
      },
    };
  }
}
