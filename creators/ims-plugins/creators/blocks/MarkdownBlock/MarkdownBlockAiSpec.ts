import type { AiSpecEntry } from '~ims-app-base/logic/types/AiSpec';

export const markdownBlockAiSpec: AiSpecEntry = {
  name: 'markdown',
  icon: 'markdown-line',
  aiSpec: {
    brief:
      'Raw Markdown content. Use for design documents, lore entries, technical specs, or free-form notes.',
    spec: 'Stored as:\n- `value` — the raw Markdown string content\n\nThe editor (ink-mde, CodeMirror-based) supports wiki links (`[[AssetTitle]]`) for cross-asset references and image upload via drag-and-drop. Headers are automatically extracted into a navigation outline (BlockContentItem[]).\n\nExample (lore entry for the Merrow Cartel faction):\n{\n  "value": "# The Merrow Cartel\\n\\n## Overview\\nThe Merrow Cartel controls all smuggling routes through the **Sunken Coast**. Founded by [[Evelyn Merrow]] after the Crimson War, they deal in relic trading, information brokering, and — allegedly — soul contracts.\\n\\n## Key Figures\\n| Name | Role | Status |\\n|------|------|--------|\\n| Evelyn Merrow | Cartel Leader | Active |\\n| Silas Vane | Harbor Master | Deceased |\\n| Lira Blacktide | Enforcer | Active |\\n\\n> \\"The tide takes everything eventually. We just help it along.\\"\\n> — Evelyn Merrow"\n}',
    needSpec: true,
  },
};
