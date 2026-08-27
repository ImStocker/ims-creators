import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const highlightMark = Decoration.mark({ class: 'cm-md-highlight' });
const mathMark = Decoration.mark({ class: 'cm-md-math' });

const highlightRegex = /==([^=\n]+)==/g;
const mathRegex = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

export function markStyles() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    {
      decorations: (inst) => inst.decorations,
    },
  );
}

function build(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  for (const m of text.matchAll(highlightRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      deco: highlightMark,
    });
  }

  for (const m of text.matchAll(mathRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      deco: mathMark,
    });
  }

  ranges.sort((a, b) => a.from - b.from);

  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const r of ranges) {
    if (r.from < lastTo) continue;
    builder.add(r.from, r.to, r.deco);
    lastTo = r.to;
  }
  return builder.finish();
}
