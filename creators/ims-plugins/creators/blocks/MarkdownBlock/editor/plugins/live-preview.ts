import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import katex from 'katex';

// Decorates a markdown marker (e.g. `**`, `#`, `>`, `-`, backticks, link
// brackets) so it is visually hidden unless the cursor is inside the construct
// it belongs to. The document text is never changed, so editing/cursor keep
// working exactly as in raw source.
const hideMark = Decoration.mark({ class: 'cm-md-mark-hidden' });

// Syntax-tree node names that represent pure *markup* (no semantic content).
// For each we look at its owning construct and hide the marker when that
// construct is not "active".
//
// Block-level markers reveal whenever the cursor is on the (line of the)
// construct: headings `#`, blockquote `>`, list `-`/`*`.
const LINE_MARK_NODES = new Set([
  'HeaderMark', // `#`
  'QuoteMark', // `>`
  'ListMark', // `-`, `*`, `1.`
]);

// Inline markers reveal only when the cursor is *inside* the construct span
// (Obsidian keeps `**bold**` rendered until you place the caret within it),
// not merely anywhere on the same line:
//   xx|x bold xxxx   ->  xx bold xxxx        (markers stay hidden)
//   xx **b|old** xxxx -> xx **b|old** xxxx   (markers revealed)
const INLINE_MARK_NODES = new Set([
  'EmphasisMark', // `*`, `_` (also the marks of `**`/`__`)
  'CodeMark', // backticks (inline + fenced)
  'LinkMark', // `[`, `]`, `(`, `)`
  'URL', // link/image target
]);

// `==highlight==` and `~~strike~~` are not parsed by CodeMirror's markdown
// grammar, so their delimiters are hidden via a regex fallback (the inner text
// is already styled by mark-styles.ts). Lookarounds avoid matching `===`/`~~~`
// (setext/horizontal-rule) and nested delimiters.
const highlightDelim = /(==)([^=\n]+?)==/g;
const strikeDelim = /(~~)([^~\n]+?)~~/g;

// Line-level styling classes (Obsidian-style chrome for the rendered block).
const LINE_BLOCKQUOTE = 'cm-md-line-blockquote';
const LINE_LIST = 'cm-md-line-list';
const LINE_HR = 'cm-md-line-hr';
const GAP_LINE = 'cm-md-list-gap';

class CodeLangWidget extends WidgetType {
  readonly lang: string;

  constructor(lang: string) {
    super();
    this.lang = lang;
  }

  override eq(other: CodeLangWidget): boolean {
    return other.lang === this.lang;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-md-code-lang';
    span.textContent = this.lang;
    return span;
  }
}

// Renders a `$...$` / `$$...$$` formula with KaTeX in live preview.
class MathWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly display: boolean,
  ) {
    super();
  }

  override eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-md-math-render';
    try {
      span.innerHTML = katex.renderToString(this.tex, {
        displayMode: this.display,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      span.textContent = this.tex;
    }
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

// Renders `<sub>` / `<sup>` inline HTML as a real subscript / superscript.
class SubSupWidget extends WidgetType {
  constructor(
    readonly tag: 'sub' | 'sup',
    readonly content: string,
  ) {
    super();
  }

  override eq(other: SubSupWidget): boolean {
    return other.tag === this.tag && other.content === this.content;
  }

  override toDOM(): HTMLElement {
    const el = document.createElement(this.tag);
    el.textContent = this.content;
    return el;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

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
  const widgetRanges: Range<Decoration>[] = [];
  const lineClasses = new Map<number, Set<string>>();
  const listItemLines = new Set<number>();

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

        // Track the lines covered by list items so we can draw the connecting
        // guide line on the *empty* line between two items (Obsidian-style).
        if (name === 'ListItem') {
          const a = doc.lineAt(ref.from).number;
          const b = doc.lineAt(ref.to).number;
          for (let l = a; l <= b; l++) listItemLines.add(l);
        }

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
        } else if (name === 'CodeInfo') {
          // Render the fenced-code language as a small label chip instead of
          // hiding it (Obsidian shows `js`/`ts` at the top of the block).
          const lang = view.state.doc.sliceString(ref.from, ref.to);
          if (lang) {
            widgetRanges.push(
              Decoration.replace({
                widget: new CodeLangWidget(lang),
              }).range(ref.from, ref.to),
            );
          }
          return;
        }

        // ---- marker hiding ----
        if (!LINE_MARK_NODES.has(name) && !INLINE_MARK_NODES.has(name)) return;
        const node = ref.node;
        if (!node) return;
        const owner = node.parent;
        if (!owner) return;
        let active: boolean;
        if (LINE_MARK_NODES.has(name)) {
          const startLine = doc.lineAt(owner.from).number;
          const endLine = doc.lineAt(owner.to).number;
          // Multi-line constructs (code block, blockquote, list) activate as a
          // whole; single-line constructs activate per line.
          active =
            startLine !== endLine
              ? overlaps(owner.from, owner.to)
              : activeLines.has(startLine);
        } else {
          // Inline construct: reveal its markers only when the cursor is inside
          // the span, not merely elsewhere on the same line.
          active = overlaps(owner.from, owner.to);
        }
        if (!active) {
          let to = node.to;
          // Swallow the whitespace that follows a line-level marker (`# `, `> `,
          // `- `) so live preview doesn't render a redundant leading space.
          if (LINE_MARK_NODES.has(name)) {
            const lineEnd = doc.lineAt(node.to).to;
            let p = to;
            while (p < lineEnd) {
              const ch = doc.sliceString(p, p + 1);
              if (ch === ' ' || ch === '\t') p++;
              else break;
            }
            to = p;
          }
          markRanges.push(hideMark.range(node.from, to));
        }
      },
    });
  }

  hideRegexDelimiters(highlightDelim, view, overlaps, markRanges);
  hideRegexDelimiters(strikeDelim, view, overlaps, markRanges);
  buildRenderWidgets(view, overlaps, widgetRanges);

  // Draw the connecting guide line on an empty line that sits between two list
  // items (so it appears only in the gap, aligned under the bullet markers).
  const docLines = doc.lines;
  for (let l = 2; l < docLines; l++) {
    if (listItemLines.has(l - 1) && listItemLines.has(l + 1)) {
      const line = doc.line(l);
      if (line.text.trim() === '') {
        addLineClass(line.from, line.from, GAP_LINE);
      }
    }
  }

  const ranges: Range<Decoration>[] = [...markRanges, ...widgetRanges];
  for (const [pos, set] of lineClasses) {
    ranges.push(Decoration.line({ class: [...set].join(' ') }).range(pos));
  }

  return Decoration.set(ranges, true);
}

function hideRegexDelimiters(
  regex: RegExp,
  view: EditorView,
  overlaps: (a: number, b: number) => boolean,
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
    // Reveal the delimiters only when the caret is inside the construct span.
    if (overlaps(openFrom, closeTo)) continue;
    ranges.push(hideMark.range(openFrom, openTo));
    ranges.push(hideMark.range(closeFrom, closeTo));
  }
}

// Replaces `<sub>`/`<sup>` HTML and `$…$`/`$$…$$` formulas with rendered
// widgets in live preview. Widgets are skipped while the caret is inside the
// construct so the raw source can be edited (Obsidian-style reveal-on-edit).
function buildRenderWidgets(
  view: EditorView,
  overlaps: (a: number, b: number) => boolean,
  widgetRanges: Range<Decoration>[],
): void {
  const text = view.state.doc.toString();
  const occupied: Array<[number, number]> = [];

  const pushWidget = (from: number, to: number, widget: WidgetType) => {
    if (from >= to) return;
    if (overlaps(from, to)) return;
    for (const [a, b] of occupied) {
      if (from < b && to > a) return;
    }
    occupied.push([from, to]);
    widgetRanges.push(Decoration.replace({ widget }).range(from, to));
  };

  for (const [re, tag] of [
    [/<sub>([\s\S]*?)<\/sub>/g, 'sub'],
    [/<sup>([\s\S]*?)<\/sup>/g, 'sup'],
  ] as const) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const from = m.index;
      const to = from + m[0].length;
      pushWidget(from, to, new SubSupWidget(tag, m[1]));
    }
  }

  // Block math `$$…$$` first so inline math doesn't claim its contents.
  {
    const re = /\$\$([\s\S]+?)\$\$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const from = m.index;
      const to = from + m[0].length;
      pushWidget(from, to, new MathWidget(m[1], true));
    }
  }

  // Inline math `$…$`.
  {
    const re = /\$([^$\n]+?)\$/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const from = m.index;
      const to = from + m[0].length;
      pushWidget(from, to, new MathWidget(m[1], false));
    }
  }
}
