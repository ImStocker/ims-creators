import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';

export class DiagramBlockDefinition extends BlockTypeDefinition {
  name = 'diagram';
  component = async () => (await import('./DiagramBlock.vue')).default;
  icon = 'organization-chart';
  override resizableBlockHeight = true;
  override aiSpec =
    'This block stores a flowchart/diagram (mxGraph-based). Two storage formats. New format: `vertices` array — each vertex: { id (string), parent (string | null), style (string), value (AssetPropValue), index (number), geometry: { x, y, w, h, r (relative boolean) } }; `edges` array — each edge: { id, source (string | null), target (string | null), style, value, index, geometry: { x, y, w, h, r, sp? (sourcePoint: {x, y}), tp? (targetPoint: {x, y}) } }. Legacy format: `graph` XML string (mxGraph XML) + separate `values\\id{id}` props per cell.';
}
