import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// Decorates a markdown marker (e.g. `**`, `#`, `>`, `-`, backticks, link
// brackets) so it is visually hidden unless the cursor is inside the construct
// it belongs to. The document text is never changed, so editing/cursor keep
// working exactly as in raw source.
const hideMark = Decoration.mark({ class: 'cm-md-mark-hidden' });

// Syntax-tree node names that represent pure *markup* (no semantic content).
// For each we look at its owning construct and hide the marker when that
// construct is not "active" (cursor inside, line- or block-level).
const MARK_NODES = new Set([
  'HeaderMark', // `#`
  'QuoteMark', // `>`
  'ListMark', // `-`, `*`, `1.`
  'EmphasisMark', // `*`, `_` (also the marks of `**`/`__`)
  'CodeMark', // backticks (inline + fenced)
  'CodeInfo', // fenced code language, e.g. `js`
  'LinkMark', // `[`, `]`, `(`, `)`
  'URL', // link/image target
]);

// `==highlight==` and `~~strike~~` are not parsed by CodeMirror's markdown
// grammar, so their delimiters are hidden via a regex fallback (the inner text
// is already styled by mark-styles.ts). Lookarounds avoid matching `===`/`~~~`
// (setext/horizontal-rule) and nested delimiters.
const highlightDelim = /==([^=\n]+?)==/g;
const strikeDelim = /~~([^~\n]+?)~~/g;

// Line-level styling classes (Obsidian-style chrome for the rendered block).
const LINE_BLOCKQUOTE = 'cm-md-line-blockquote';
const LINE_LIST = 'cm-md-line-list';
const LINE_HR = 'cm-md-line-hr';

export function livePreview() {
  return livePreviewPlugin;
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = build(update.view);
      }
    }
  },
  {
    decorations: (inst) => inst.decorations,
  },
);

function build(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const tree = syntaxTree(view.state);
  const markRanges: Range<Decoration>[] = [];
  const lineClasses = new Map<number, Set<string>>();

  const sel = view.state.selection.ranges;

  // Lines touched by any selection are "active" (Obsidian reveals the whole
  // line the cursor is on).
  const activeLines = new Set<number>();
  for (const r of sel) {
    const start = doc.lineAt(r.from).number;
    const end = doc.lineAt(r.to).number;
    for (let l = start; l <= end; l++) activeLines.add(l);
  }
  const overlaps = (a: number, b: number) =>
    sel.some((r) => r.from <= b && r.to >= a);

  const addLineClass = (from: number, to: number, cls: string) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let l = first; l <= last; l++) {
      const pos = doc.line(l).from;
      let set = lineClasses.get(pos);
      if (!set) {
        set = new Set<string>();
        lineClasses.set(pos, set);
      }
      set.add(cls);
    }
  };

  for (const vr of view.visibleRanges) {
    tree.iterate({
      from: vr.from,
      to: vr.to,
      enter: (ref) => {
        const name = ref.name;

        // ---- line-level chrome (always on in live preview) ----
        if (name === 'Blockquote') {
          addLineClass(ref.from, ref.to, LINE_BLOCKQUOTE);
        } else if (
          name === 'ListItem' ||
          name === 'BulletList' ||
          name === 'OrderedList'
        ) {
          addLineClass(ref.from, ref.to, LINE_LIST);
        } else if (name === 'HorizontalRule') {
          // Render a rule only when the cursor is NOT on the line; otherwise
          // reveal the raw `---`/`***` so it can be edited.
          if (!activeLines.has(doc.lineAt(ref.from).number)) {
            if (ref.from < ref.to) {
              markRanges.push(hideMark.range(ref.from, ref.to));
            }
            addLineClass(ref.from, ref.to, LINE_HR);
          }
          return;
        }

        // ---- marker hiding ----
        if (!MARK_NODES.has(name)) return;
        const node = ref.node;
        if (!node) return;
        const owner = node.parent;
        if (!owner) return;
        const startLine = doc.lineAt(owner.from).number;
        const endLine = doc.lineAt(owner.to).number;
        // Multi-line constructs (code block, blockquote, list) activate as a
        // whole; single-line constructs activate per line.
        const active =
          startLine !== endLine
            ? overlaps(owner.from, owner.to)
            : activeLines.has(startLine);
        if (!active) {
          markRanges.push(hideMark.range(node.from, node.to));
        }
      },
    });
  }

  hideRegexDelimiters(highlightDelim, view, activeLines, markRanges);
  hideRegexDelimiters(strikeDelim, view, activeLines, markRanges);

  const ranges: Range<Decoration>[] = [...markRanges];
  for (const [pos, set] of lineClasses) {
    ranges.push(Decoration.line({ class: [...set].join(' ') }).range(pos));
  }

  return Decoration.set(ranges, true);
}

function hideRegexDelimiters(
  regex: RegExp,
  view: EditorView,
  activeLines: Set<number>,
  ranges: Range<Decoration>[],
) {
  const doc = view.state.doc;
  const text = doc.toString();
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index === undefined) continue;
    const openFrom = m.index;
    const openTo = openFrom + m[1].length;
    const closeTo = m.index + m[0].length;
    const closeFrom = closeTo - m[1].length;
    const line = doc.lineAt(openFrom).number;
    if (activeLines.has(line)) continue;
    ranges.push(hideMark.range(openFrom, openTo));
    ranges.push(hideMark.range(closeFrom, closeTo));
  }
}
