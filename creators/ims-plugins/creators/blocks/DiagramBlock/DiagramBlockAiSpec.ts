import type { AiSpecEntry } from '~ims-app-base/logic/types/AiSpec';

export const diagramBlockAiSpec: AiSpecEntry = {
  name: 'diagram',
  icon: 'organization-chart',
  aiSpec: {
    brief:
      'Flowchart/diagram (mxGraph-based). Use for visual process flows, system architectures, or entity relationships.',
    spec: 'Two storage formats:\n\nNew format:\n- `vertices` array — each vertex: { id (string), parent (string | null), style (string), value (AssetPropValue), index (number), geometry: { x, y, w, h, r (relative boolean) } }\n- `edges` array — each edge: { id, source (string | null), target (string | null), style, value, index, geometry: { x, y, w, h, r, sp? (sourcePoint: {x, y}), tp? (targetPoint: {x, y}) } }\n\nLegacy format:\n- `graph` — XML string (mxGraph XML)\n- `values\\id{id}` — separate props per cell',
    needSpec: true,
  },
};
