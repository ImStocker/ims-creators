import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const highlightMark = Decoration.mark({ class: 'cm-md-highlight' });
const mathMark = Decoration.mark({ class: 'cm-md-math' });

const highlightRegex = /==([^=\n]+)==/g;
const mathRegex = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

const highlightMathPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMarks(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildMarks(update.view);
      }
    }
  },
  {
    decorations: (inst) => inst.decorations,
  },
);

const calloutStart = /^>\s*\[!(\w+)\]/;
const calloutCont = /^>/;

const calloutPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCallouts(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCallouts(update.view);
      }
    }
  },
  {
    decorations: (inst) => inst.decorations,
  },
);

export function markStyles() {
  return [highlightMathPlugin, calloutPlugin];
}

function buildMarks(view: EditorView): DecorationSet {
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

function buildCallouts(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  let inCallout = false;
  let calloutType = '';

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const startMatch = text.match(calloutStart);
    if (startMatch) {
      inCallout = true;
      calloutType = startMatch[1].toLowerCase();
    } else if (inCallout && !calloutCont.test(text)) {
      inCallout = false;
    }

    if (inCallout) {
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: `cm-md-callout cm-md-callout-${calloutType}`,
        }),
      );
    }
  }

  return builder.finish();
}
