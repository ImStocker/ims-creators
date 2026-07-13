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
    'This block stores a visual script/dialogue graph (VueFlow-based). Use in scene assets to author branching dialogue, triggers, variable logic, and sub-script calls; use in master assets to orchestrate scene calls and global variable flow only (no speech/trigger/end nodes).\n' +
    'Storage structure:\n' +
    '- start: string — ID of the entry node (or null).\n' +
    '- nodes: { [id: string]: ScriptBlockPlainNode } — see below.\n' +
    '- variables: { own: { [name: string]: DialogVariable } } — scoped variable declarations.\n' +
    '- actions: { own: { [name: string]: DialogAction } } — scoped action declarations.\n' +
    '- __settings: { speech: { main, option } } — parameter schemas for speech fields (default main: "character" (TEXT), "text" (TEXT); option: "text" (TEXT)).\n' +
    'Each node has: type, pos: { x, y }, index (ordering), next? (next node ID or null for terminal), values? (direct AssetPropValue or data-pin binding { get: sourceNodeId, param: outputParamName }), options? (for speech: array of { values: { [prop]: AssetPropValue }, next }), subject? (for trigger/callScript — action or script identifier), params? { in, out } (for callScript/function). Variable/action def: { name, title, type?, kind? ("global"|"local"|"in"|"out"|"in-out"), description?, default?, index? }.\n' +
    'Node types by purpose:\n' +
    '  - start: entry point; next points to first node. index=0.\n' +
    '  - end: terminal; no next.\n' +
    '  - speech: dialogue line or narration (no character values); options[] makes it a player choice (next=null).\n' +
    '  - trigger: scene action (changeLocation, showCharacter, hideCharacter, etc.); values vary by subject.\n' +
    '  - branch: conditional fork; values.condition binds to comparison result, options[0]=true-branch, options[1]=false-branch.\n' +
    '  - callScript: calls a sub-script (scene or master); subject is the script reference.\n' +
    '  - setVar / getVar: variable read/write; wired via data-pin bindings.\n' +
    '  - constBoolean / constFloat / constInteger / constString / constText / constAsset: literal value providers.\n' +
    '  - opEqual / opNotEqual / opLess / opLessEqual / opMore / opMoreEqual / opPlus / opMinus / opMult / opDiv / opMod / opAnd / opOr / opNot: arithmetic/logic operators; inputs via data-pin binds, output on "result" param.\n' +
    'Wiring rules:\n' +
    '  1) Linear flow: increment x by ~600 per node, vary y for branches.\n' +
    '  2) Variable mod (e.g., "trust + 1"): getVar -> operator -> setVar chain via data-pin binds.\n' +
    '  3) Condition ("if trust == 1"): getVar -> comparison op -> branch; branch.values.condition binds to op result.\n' +
    '  4) Player choice: speech node with next=null, options[] containing each choice text and its next.\n' +
    '  5) Edges (inferred from next/options/bindings): flow handles "in"/"out"/"out-N", data handles "data-in-param"/"data-out-param".\n' +
    'For AssetPropValue format see the "AssetPropValue types" leaf value reference; for field type details see the "Field type controllers reference".\n' +
    'Example (player meets Evelyn in Act 3):\n' +
    '{\n' +
    '  "start": "1",\n' +
    '  "nodes": {\n' +
    '    "1": { "type": "start", "pos": { "x": 0, "y": 200 }, "index": 0, "next": "2" },\n' +
    '    "2": { "type": "speech", "pos": { "x": 600, "y": 0 }, "index": 1, "values": { "character": { "value": "evelyn_merrow", "type": { "Type": "Asset" } }, "text": { "value": "I\'m not going anywhere near that ruins.", "type": { "Type": "Text" } }, "voiceLine": { "value": "vo/act3_ruins_refusal.wav", "type": { "Type": "Asset" } }, "camera": { "value": "closeup", "type": { "Type": "String" } } }, "next": "3", "options": null },\n' +
    '    "3": { "type": "speech", "pos": { "x": 1200, "y": 0 }, "index": 2, "values": { "character": { "value": "evelyn_merrow", "type": { "Type": "Asset" } }, "text": { "value": "But maybe you can change my mind.", "type": { "Type": "Text" } } }, "next": null, "options": [{ "values": { "text": { "value": "Persuade her (Intimidate)", "type": { "Type": "Text" } } }, "next": "4" }, { "values": { "text": { "value": "Fine, stay here.", "type": { "Type": "Text" } } }, "next": "7" }] },\n' +
    '    "4": { "type": "trigger", "pos": { "x": 1800, "y": -200 }, "index": 3, "subject": "checkSkill", "values": { "skill": { "value": "intimidate", "type": { "Type": "String" } }, "difficulty": { "value": 15, "type": { "Type": "Integer" } } }, "next": "5" },\n' +
    '    "5": { "type": "getVar", "pos": { "x": 2400, "y": -200 }, "index": 4, "values": { "variable": { "value": "playerReputation", "type": { "Type": "String" } } }, "next": null, "params": { "in": [], "out": [{ "name": "result", "type": { "Type": "Integer" } }] } },\n' +
    '    "6": { "type": "opMoreEqual", "pos": { "x": 3000, "y": -200 }, "index": 5, "values": { "a": { "get": "5", "param": "result" }, "b": { "value": 10, "type": { "Type": "Integer" } } }, "next": null, "params": { "in": [{ "name": "a", "type": { "Type": "Integer" } }, { "name": "b", "type": { "Type": "Integer" } }], "out": [{ "name": "result", "type": { "Type": "Boolean" } }] } },\n' +
    '    "7": { "type": "branch", "pos": { "x": 3600, "y": -200 }, "index": 6, "values": { "condition": { "get": "6", "param": "result" } }, "next": null, "options": [{ "next": "8" }, { "next": "9" }] },\n' +
    '    "8": { "type": "speech", "pos": { "x": 4200, "y": -400 }, "index": 7, "values": { "character": { "value": "evelyn_merrow", "type": { "Type": "Asset" } }, "text": { "value": "Alright, you convinced me. Let\'s go.", "type": { "Type": "Text" } } }, "next": "10" },\n' +
    '    "9": { "type": "speech", "pos": { "x": 4200, "y": 0 }, "index": 8, "values": { "character": { "value": "evelyn_merrow", "type": { "Type": "Asset" } }, "text": { "value": "Ha! I knew you wouldn\'t last five minutes.", "type": { "Type": "Text" } } }, "next": "10" },\n' +
    '    "10": { "type": "callScript", "pos": { "x": 4800, "y": -200 }, "index": 9, "subject": { "value": "act3_ruins_exploration", "type": { "Type": "Asset" } }, "next": "11" },\n' +
    '    "11": { "type": "end", "pos": { "x": 5400, "y": -200 }, "index": 10 }\n' +
    '  },\n' +
    '  "variables": { "own": { "playerReputation": { "name": "playerReputation", "title": "Player Reputation", "type": { "Type": "Integer" }, "kind": "local", "default": { "value": 50 }, "index": 0 } } },\n' +
    '  "actions": { "own": {} },\n' +
    '  "__settings": { "speech": { "main": { "character": { "name": "character", "title": "Character", "type": { "Type": "Asset" } }, "text": { "name": "text", "title": "Dialogue Text", "type": { "Type": "Text" } }, "voiceLine": { "name": "voiceLine", "title": "Voice Over", "type": { "Type": "Asset" } }, "camera": { "name": "camera", "title": "Camera Preset", "type": { "Type": "String" } } }, "option": { "text": { "name": "text", "title": "Option Text", "type": { "Type": "Text" } } } } }\n' +
    '}';

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
