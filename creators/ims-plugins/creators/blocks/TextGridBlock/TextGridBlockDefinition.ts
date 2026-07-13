import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { AssetProps } from '~ims-app-base/logic/types/Props';

export class TextGridBlockDefinition extends BlockTypeDefinition {
  name = 'textgrid';
  component = async () => (await import('./TextGridBlock.vue')).default;
  icon = 'layout-grid-fill';
  override hideInAdding = false;
  override focusOnAdded = false;
  override aiSpec =
    'TextGridBlock stores a multi-column CSS grid of rich-text cells. ' +
    'Use it for any grid-like content that needs per-cell rich formatting — quest boards, loot tables, dialogue matrices, milestone roadmaps, or comparison tables.\n\n' +
    'Stored as flat block-level props:\n' +
    '- `columns` — number of grid columns (number, default 4, min 2)\n' +
    '- `{cellId}\\content` — rich text content (AssetPropValueText: { Str: string, Ops: QuillDeltaOp[] } for formatted text, or a plain string for simple text)\n' +
    '- `{cellId}\\index` — sort order (number)\n' +
    '- `{cellId}\\inherited` — whether the cell is inherited from a parent asset (boolean)\n\n' +
    'Cell IDs are UUIDs. Cells are laid out left-to-right, top-to-bottom in a CSS grid with `columns` columns.\n\n' +
    'Example (quest design grid with 4 columns: Quest, Objectives, Rewards, Notes):\n' +
    '{\n' +
    '  "columns": 4,\n' +
    '  "cell_a1\\content": { "Str": "The Missing Relic", "Ops": [{ "insert": "The Missing Relic" }] },\n' +
    '  "cell_a1\\index": 1,\n' +
    '  "cell_b1\\content": { "Str": "Find the relic in the Sunken Vault.\\nDefeat the guardian.\\nReturn to Evelyn.", "Ops": [{ "insert": "Find the relic in the Sunken Vault." }, { "insert": "\n" }, { "insert": "Defeat the guardian." }, { "insert": "\n" }, { "insert": "Return to Evelyn." }] },\n' +
    '  "cell_b1\\index": 2,\n' +
    '  "cell_c1\\content": { "Str": "1000 XP\\nGold x500\\nMerrow Faction +10", "Ops": [{ "insert": "1000 XP" }, { "insert": "\n" }, { "insert": "Gold x500" }, { "insert": "\n" }, { "insert": "Merrow Faction +10" }] },\n' +
    '  "cell_c1\\index": 3,\n' +
    '  "cell_d1\\content": { "Str": "Requires: Player Level 5+\\nTime limit: none", "Ops": [{ "insert": "Requires: Player Level 5+" }, { "insert": "\n" }, { "insert": "Time limit: none" }] },\n' +
    '  "cell_d1\\index": 4,\n' +
    '  "cell_a2\\content": "Rats in the Sewer",\n' +
    '  "cell_a2\\index": 5,\n' +
    '  "cell_b2\\content": "Clear 3 rat nests in the Old Quarter sewers.",\n' +
    '  "cell_b2\\index": 6,\n' +
    '  "cell_c2\\content": "250 XP\\nGold x50",\n' +
    '  "cell_c2\\index": 7,\n' +
    '  "cell_d2\\content": "Repeatable daily",\n' +
    '  "cell_d2\\index": 8\n' +
    '}';
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
