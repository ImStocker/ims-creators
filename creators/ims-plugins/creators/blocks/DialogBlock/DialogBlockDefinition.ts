import { extractDialogBlockData } from './editor/DialogEditor';
import type {
  ResolvedAssetBlock,
  AssetLocalizableField,
} from '~ims-app-base/logic/utils/assets';
import type { AssetFullInstanceR } from '~ims-app-base/logic/types/AssetFullInstance';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { DialogBlockController } from './editor/DialogBlockController';

export class DialogBlockDefinition extends BlockTypeDefinition {
  name = 'script';
  component = async () => (await import('./DialogBlock.vue')).default;
  icon = 'file-paper-2-fill';
  override resizableBlockHeight = true;
  override aiSpec =
    'This block contains the dialogue script. It consists of nodes, each node containing speeches with text and optional response options with button text and links to other nodes.';

  override getBlockLocalizableFields(
    asset: AssetFullInstanceR,
    resolved_block: ResolvedAssetBlock,
  ): AssetLocalizableField[] {
    const dialog = extractDialogBlockData(resolved_block.computed);
    const res: AssetLocalizableField[] = [];
    for (const node of dialog.nodes) {
      if (node.type !== 'speech') {
        continue;
      }
      for (const speech_var of Object.values(dialog.__settings.speech.main)) {
        if (
          speech_var.type?.Type === AssetPropType.TEXT ||
          speech_var.type?.Type === AssetPropType.STRING
        ) {
          const prop_path = ['nodes', node.id, 'values', speech_var.name];
          res.push({
            propKey: prop_path.join('\\'),
            localeKey: prop_path.join('.'),
            title: speech_var.title,
            type: speech_var.type?.Type,
          });
        }
      }
      if (node.data.options) {
        for (let opt_ind = 0; opt_ind < node.data.options.length; opt_ind++) {
          for (const opt_var of Object.values(
            dialog.__settings.speech.option,
          )) {
            if (
              opt_var.type?.Type === AssetPropType.TEXT ||
              opt_var.type?.Type === AssetPropType.STRING
            ) {
              const prop_path = [
                'nodes',
                node.id,
                'options',
                opt_ind,
                'values',
                opt_var.name,
              ];
              res.push({
                propKey: prop_path.join('\\'),
                localeKey: prop_path.join('.'),
                title: opt_var.title,
                type: opt_var.type?.Type,
              });
            }
          }
        }
      }
    }
    return res;
  }

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new DialogBlockController(appManager, getResolvedBlock);
  }
}
