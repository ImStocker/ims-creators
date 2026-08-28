import { Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const highlightMark = Decoration.mark({ class: 'cm-md-highlight' });
const codeMark = Decoration.mark({ class: 'cm-code' });
const boldMark = Decoration.mark({ class: 'cm-md-bold' });
const italicMark = Decoration.mark({ class: 'cm-md-italic' });
const strikeMark = Decoration.mark({ class: 'cm-md-strike' });

const highlightRegex = /==([^=\n]+)==/g;
// Inline code: a single backtick pair that is not adjacent to another backtick
// (so ``` fenced blocks are excluded). Group 1/3 are the surrounding chars
// used only to avoid matching fences; the decorated range is the `code` span.
const inlineCodeRegex = /(^|[^`])`([^`\n]+)`([^`]|$)/g;
// Inline emphasis. Markers are excluded from the decorated range so the
// `**`/`*`/`~~` delimiters keep their default styling.
const boldRegex = /\*\*([^*]+)\*\*/g;
const boldUnderscoreRegex = /__([^_]+)__/g;
const italicRegex = /\*([^\s*][^*]*)\*/g;
const strikeRegex = /~~([^~]+)~~/g;

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
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
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

  for (const m of text.matchAll(boldRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index + 2,
      to: m.index + 2 + m[1].length,
      deco: boldMark,
    });
  }

  for (const m of text.matchAll(boldUnderscoreRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index + 2,
      to: m.index + 2 + m[1].length,
      deco: boldMark,
    });
  }

  for (const m of text.matchAll(italicRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index + 1,
      to: m.index + 1 + m[1].length,
      deco: italicMark,
    });
  }

  for (const m of text.matchAll(strikeRegex)) {
    if (m.index === undefined) continue;
    ranges.push({
      from: m.index + 2,
      to: m.index + 2 + m[1].length,
      deco: strikeMark,
    });
  }

  for (const m of text.matchAll(inlineCodeRegex)) {
    if (m.index === undefined) continue;
    const from = m.index + (m[1] ? 1 : 0);
    const to = from + 1 + m[2].length + 1;
    if (to <= from) continue;
    ranges.push({ from, to, deco: codeMark });
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
  const doc = view.state.doc;
  const builder = new RangeSetBuilder<Decoration>();

  // Reveal the marker while the caret is inside it so the callout type can be
  // edited, consistent with the rest of live preview. The type icon itself is
  // rendered via a CSS `::after` on the first callout line (no widget DOM, so
  // it never interferes with CodeMirror's coordinate mapping).
  const sel = view.state.selection.ranges;
  const overlaps = (a: number, b: number) =>
    sel.some((r) => r.from <= b && r.to >= a);

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

    if (!inCallout) continue;

    const classes = startMatch
      ? `cm-md-callout cm-md-callout-${calloutType} cm-md-callout-first`
      : `cm-md-callout cm-md-callout-${calloutType}`;
    builder.add(line.from, line.from, Decoration.line({ class: classes }));

    // On the callout's first line, hide the `> [!type]` marker text.
    if (startMatch && startMatch.index !== undefined) {
      const markerFrom = line.from + startMatch.index;
      const markerTo = markerFrom + startMatch[0].length;
      if (!overlaps(markerFrom, markerTo)) {
        builder.add(
          markerFrom,
          markerTo,
          Decoration.mark({ class: 'cm-md-mark-hidden' }),
        );
      }
    }
  }

  return builder.finish();
}
