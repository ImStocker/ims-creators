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
    'This block stores a visual dialogue script as a node graph (VueFlow). Top-level structure: { start: string | null (start node id), nodes: { [id: string]: ScriptBlockPlainNode }, variables: { own: { [name: string]: DialogVariable } }, actions: { own: { [name: string]: DialogAction } }, __settings: { speech: { main: { [name: string]: DialogVariable } (default: "character" of type TEXT, "text" of type TEXT), option: { [name: string]: DialogVariable } (default: "text" of type TEXT) } } }. Each node: { type: string ("start"|"end"|"speech"|"branch"|"trigger"|"function"|"callScript"|"setVar"|"getVar"|"constBoolean"|"constFloat"|"constInteger"|"constString"|"constText"|"constAsset"|"opEqual"|"opNotEqual"|"opLess"|"opLessEqual"|"opMore"|"opMoreEqual"|"opPlus"|"opMinus"|"opMult"|"opDiv"|"opMod"|"opAnd"|"opOr"|"opNot"), subject?: string, values?: { [prop: string]: AssetPropValue | { get: string (source node id), param: string (output param name) } } (direct value or data-pin binding), next?: string | null (next node id), options?: { values: { [prop: string]: ScriptBlockPlainPropValue }, next: string | null }[] (response choices), params?: { in: ScriptBlockPlainVariable[], out: ScriptBlockPlainVariable[] }, pos: { x: number, y: number }, index: number }. Edges connect nodes with flow handles ("in", "out", "out-N") and data handles ("data-in-paramName", "data-out-paramName"). Variable/action definitions: { name: string, title: string, type?: AssetPropValueType { Type: AssetPropType, Kind?: string, Of?: AssetPropValueType }, kind?: "global"|"local"|"in"|"out"|"in-out", description?: string, default?: AssetPropValue, index?: number }.';

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
