import type { Instance as InkInstance } from 'ink-mde';
import type { SelectionInfo } from './plugins/selection-toolbar';
import type { InkLike } from './editor-adapter';

type EditorTarget = InkInstance | InkLike;

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'code_block'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bullet_list'
  | 'ordered_list'
  | 'task_list'
  | 'quote'
  | 'callout'
  | 'link'
  | 'formula'
  | 'superscript'
  | 'subscript';

export type FormatPayload = {
  url?: string;
  internal?: string;
  internalName?: string;
  text?: string;
  calloutType?: string;
  reset?: boolean;
};

export type ActiveFormats = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  highlight: boolean;
  code: boolean;
  formula: boolean;
  superscript: boolean;
  subscript: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  h4: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
  callout: string | null;
  link: string | null;
  linkAsset: string | null;
  linkTitle: string | null;
};

const INLINE_MARKS: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  highlight: ['==', '=='],
  code: ['`', '`'],
  formula: ['$', '$'],
  superscript: ['<sup>', '</sup>'],
  subscript: ['<sub>', '</sub>'],
};

function lineBounds(
  doc: string,
  start: number,
  end: number,
): { lineStart: number; blockEnd: number } {
  const lineStart = doc.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = doc.indexOf('\n', end);
  const blockEnd = lineEnd === -1 ? doc.length : lineEnd;
  return { lineStart, blockEnd };
}

function countTrailing(s: string, ch: string): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === ch; i--) n++;
  return n;
}

function countLeading(s: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < s.length && s[i] === ch; i++) n++;
  return n;
}

function detectLinkAt(
  doc: string,
  from: number,
  to: number,
): {
  kind: 'url' | 'asset';
  value: string;
  title: string;
  from: number;
  to: number;
} | null {
  const lineStart = doc.lastIndexOf('\n', from - 1) + 1;
  const lineEnd = doc.indexOf('\n', from);
  const lineEndClamped = lineEnd === -1 ? doc.length : lineEnd;
  const line = doc.slice(lineStart, lineEndClamped);

  const assetRe = /\[\[\[(.+?)\]\(#asset:([0-9a-f-]+)\)\]\]/g;
  for (const m of line.matchAll(assetRe)) {
    const s = lineStart + (m.index ?? 0);
    const e = s + m[0].length;
    if (s <= to && e >= from) {
      return { kind: 'asset', value: m[2], title: m[1], from: s, to: e };
    }
  }

  const urlRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  for (const m of line.matchAll(urlRe)) {
    const s = lineStart + (m.index ?? 0);
    const e = s + m[0].length;
    if (s <= to && e >= from) {
      return { kind: 'url', value: m[2], title: m[1], from: s, to: e };
    }
  }

  return null;
}

function applyHeading(
  editor: EditorTarget,
  info: SelectionInfo,
  level: number,
) {
  const doc = editor.getDoc();
  const { lineStart, blockEnd } = lineBounds(doc, info.from, info.to);
  const prefix = '#'.repeat(level) + ' ';
  const block = doc.slice(lineStart, blockEnd);
  const transformed = block.split('\n').map((line) => {
    const m = line.match(/^(#{1,6})\s+([\s\S]*)$/);
    if (m) {
      // Already a heading: toggle off when it's the same level, otherwise
      // switch to the requested level.
      return m[1].length === level ? m[2] : prefix + m[2];
    }
    return prefix + line;
  });
  const newBlock = transformed.join('\n');
  editor.update(doc.slice(0, lineStart) + newBlock + doc.slice(blockEnd));
  editor.select({
    selection: { start: lineStart, end: lineStart + newBlock.length },
  });
}

function applyList(
  editor: EditorTarget,
  info: SelectionInfo,
  kind: 'bullet' | 'ordered' | 'task',
) {
  const doc = editor.getDoc();
  const { lineStart, blockEnd } = lineBounds(doc, info.from, info.to);
  const block = doc.slice(lineStart, blockEnd);
  const lines = block.split('\n');

  const isActive = (l: string) => {
    if (kind === 'bullet') return /^[-*+]\s+/.test(l);
    if (kind === 'ordered') return /^\d+\.\s+/.test(l);
    if (kind === 'task') return /^[-*+]\s+\[[ xX]\]\s+/.test(l);
    return false;
  };

  const stripPrefix = (l: string) =>
    l
      .replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '');

  const allActive = lines.length > 0 && lines.every(isActive);

  let newLines: string[];
  if (allActive) {
    newLines = lines.map(stripPrefix);
  } else {
    newLines = lines.map((l) => {
      const s = stripPrefix(l);
      if (kind === 'bullet') return '- ' + s;
      if (kind === 'ordered') return '1. ' + s;
      if (kind === 'task') return '- [ ] ' + s;
      return s;
    });
  }

  const newBlock = newLines.join('\n');
  editor.update(doc.slice(0, lineStart) + newBlock + doc.slice(blockEnd));
  editor.select({
    selection: { start: lineStart, end: lineStart + newBlock.length },
  });
}

function applyQuote(editor: EditorTarget, info: SelectionInfo) {
  const doc = editor.getDoc();
  const { lineStart, blockEnd } = lineBounds(doc, info.from, info.to);
  const block = doc.slice(lineStart, blockEnd);
  const lines = block.split('\n');
  const allQuote = lines.length > 0 && lines.every((l) => /^>\s?/.test(l));

  const newBlock = (
    allQuote
      ? lines.map((l) => l.replace(/^>\s?/, ''))
      : lines.map((l) => '> ' + l)
  ).join('\n');

  editor.update(doc.slice(0, lineStart) + newBlock + doc.slice(blockEnd));
  editor.select({
    selection: { start: lineStart, end: lineStart + newBlock.length },
  });
}

function applyCallout(
  editor: EditorTarget,
  info: SelectionInfo,
  calloutType: string,
) {
  const doc = editor.getDoc();
  const { lineStart, blockEnd } = lineBounds(doc, info.from, info.to);
  const marker = `> [!${calloutType}]`;
  const block = doc.slice(lineStart, blockEnd);
  const lines = block.split('\n');
  const alreadyCallout = lines[0].startsWith('> [!');

  let newBlock: string;
  if (alreadyCallout) {
    const stripped = lines.map((l) =>
      l.replace(/^>\s*\[![^\]]*\]/, '').replace(/^>\s?/, ''),
    );
    const wasThisType = lines[0].startsWith(marker);
    newBlock = wasThisType
      ? stripped.join('\n')
      : [marker, ...stripped.map((l) => '> ' + l)].join('\n');
  } else {
    newBlock = [marker, ...lines.map((l) => '> ' + l)].join('\n');
  }

  editor.update(doc.slice(0, lineStart) + newBlock + doc.slice(blockEnd));
  editor.select({
    selection: { start: lineStart, end: lineStart + newBlock.length },
  });
}

export function insertHorizontalRule(
  editor: EditorTarget,
  info: SelectionInfo,
): void {
  const doc = editor.getDoc();
  const { blockEnd } = lineBounds(doc, info.from, info.to);
  const snippet = '\n---\n';
  editor.update(doc.slice(0, blockEnd) + snippet + doc.slice(blockEnd));
  const pos = blockEnd + snippet.length;
  editor.select({ selection: { start: pos, end: pos } });
}

export function insertTable(editor: EditorTarget, info: SelectionInfo): void {
  const doc = editor.getDoc();
  const { blockEnd } = lineBounds(doc, info.from, info.to);
  const table =
    '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |';
  editor.update(doc.slice(0, blockEnd) + table + doc.slice(blockEnd));
  const pos = blockEnd + 1;
  editor.select({ selection: { start: pos, end: pos } });
}

function unwrap(
  editor: EditorTarget,
  info: SelectionInfo,
  before: string,
  after: string,
) {
  const doc = editor.getDoc();
  const pre = doc.slice(Math.max(0, info.from - before.length), info.from);
  const post = doc.slice(info.to, Math.min(doc.length, info.to + after.length));
  if (pre !== before || post !== after) return;

  const start = info.from - before.length;
  const end = info.to + after.length;
  const newDoc =
    doc.slice(0, start) + doc.slice(info.from, info.to) + doc.slice(end);
  editor.update(newDoc);
  editor.select({
    selection: { start, end: start + (info.to - info.from) },
  });
}

export function applyFormat(
  editor: EditorTarget,
  info: SelectionInfo,
  type: FormatType,
  payload: FormatPayload = {},
): void {
  const selection = { start: info.from, end: info.to };
  const reset = !!payload.reset;

  switch (type) {
    case 'bold':
    case 'italic':
    case 'strike':
    case 'highlight':
    case 'code':
    case 'formula':
    case 'superscript':
    case 'subscript': {
      const [before, after] = INLINE_MARKS[type];
      if (reset) {
        unwrap(editor, info, before, after);
      } else if (detectActive(editor, info)[type]) {
        unwrap(editor, info, before, after);
      } else {
        editor.wrap({ before, after, selection });
      }
      break;
    }
    case 'h1':
      applyHeading(editor, info, 1);
      break;
    case 'h2':
      applyHeading(editor, info, 2);
      break;
    case 'h3':
      applyHeading(editor, info, 3);
      break;
    case 'h4':
      applyHeading(editor, info, 4);
      break;
    case 'bullet_list':
      applyList(editor, info, 'bullet');
      break;
    case 'ordered_list':
      applyList(editor, info, 'ordered');
      break;
    case 'task_list':
      applyList(editor, info, 'task');
      break;
    case 'quote':
      applyQuote(editor, info);
      break;
    case 'callout':
      applyCallout(editor, info, payload.calloutType ?? 'note');
      break;
    case 'link':
      if (payload.reset) {
        const docText = editor.getDoc();
        const link = detectLinkAt(docText, info.from, info.to);
        if (link) {
          editor.insert(link.title, { start: link.from, end: link.to });
        }
      } else if (payload.internal) {
        const linkText =
          payload.text ?? info.text ?? payload.internalName ?? 'link';
        editor.insert(
          `[[[${linkText}](#asset:${payload.internal})]]`,
          selection,
        );
      } else {
        const url = payload.url ?? '';
        editor.wrap({ before: '[', after: `](${url})`, selection });
      }
      break;
    case 'code_block':
      editor.format('code_block' as any, { selection });
      break;
  }
}

export function detectActive(
  editor: EditorTarget,
  info: SelectionInfo,
): ActiveFormats {
  const doc = editor.getDoc();
  const before = doc.slice(Math.max(0, info.from - 4), info.from);
  const after = doc.slice(info.to, Math.min(doc.length, info.to + 4));
  const has = (b: string, a: string) =>
    before.endsWith(b) && after.startsWith(a);

  // Bold uses ** (>=2 asterisks), italic uses a single * that is NOT part of
  // a ** pair. Counting consecutive markers lets ***text*** be both.
  const starBefore = countTrailing(before, '*');
  const starAfter = countLeading(after, '*');
  const boldActive = starBefore >= 2 && starAfter >= 2;
  const italicStar =
    starBefore >= 1 && starAfter >= 1 && !(starBefore === 2 && starAfter === 2);

  const undBefore = countTrailing(before, '_');
  const undAfter = countLeading(after, '_');
  const italicUnd = undBefore >= 1 && undAfter >= 1;

  const active: ActiveFormats = {
    bold: boldActive,
    italic: italicStar || italicUnd,
    strike: has('~~', '~~'),
    highlight: has('==', '=='),
    code: has('`', '`'),
    formula: has('$', '$'),
    superscript: has('<sup>', '</sup>'),
    subscript: has('<sub>', '</sub>'),
    h1: false,
    h2: false,
    h3: false,
    h4: false,
    bullet: false,
    ordered: false,
    task: false,
    quote: false,
    callout: null,
  };

  const lineStart = doc.lastIndexOf('\n', info.from - 1) + 1;
  const lineEnd = doc.indexOf('\n', info.to);
  const lineEndClamped = lineEnd === -1 ? doc.length : lineEnd;
  const firstLine = doc.slice(lineStart, lineEndClamped);

  const hm = firstLine.match(/^(#{1,6})\s/);
  if (hm) {
    const lvl = hm[1].length;
    if (lvl === 1) active.h1 = true;
    else if (lvl === 2) active.h2 = true;
    else if (lvl === 3) active.h3 = true;
    else if (lvl === 4) active.h4 = true;
  }

  if (/^[-*+]\s+\[[ xX]\]\s/.test(firstLine)) active.task = true;
  else if (/^[-*+]\s+/.test(firstLine)) active.bullet = true;
  else if (/^\d+\.\s+/.test(firstLine)) active.ordered = true;

  if (/^>\s?/.test(firstLine)) {
    const cm = firstLine.match(/^>\s*\[!(\w+)\]/);
    if (cm) active.callout = cm[1].toLowerCase();
    else active.quote = true;
  }

  const link = detectLinkAt(doc, info.from, info.to);
  active.link = link
    ? link.kind === 'asset'
      ? `#asset:${link.value}`
      : link.value
    : null;
  active.linkAsset = link?.kind === 'asset' ? link.value : null;
  active.linkTitle = link?.title ?? null;

  return active;
}
