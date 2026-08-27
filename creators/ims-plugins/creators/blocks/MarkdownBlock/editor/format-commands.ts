import type { Instance as InkInstance } from 'ink-mde';
import type { SelectionInfo } from './plugins/selection-toolbar';
import {
  castAssetPropValueToString,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';

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
  | 'subscript'
  | 'clean';

export type FormatPayload = {
  url?: string;
  asset?: AssetPropValueAsset;
  calloutType?: string;
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

function applyHeading(editor: InkInstance, info: SelectionInfo, level: number) {
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

function applyCallout(
  editor: InkInstance,
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
    newBlock = lines
      .map((l) =>
        l.startsWith(marker)
          ? l.slice(marker.length).replace(/^\s+/, '')
          : l.replace(/^>\s?/, ''),
      )
      .join('\n');
  } else {
    newBlock = [marker, ...lines.map((l) => '> ' + l)].join('\n');
  }
  editor.update(doc.slice(0, lineStart) + newBlock + doc.slice(blockEnd));
  editor.select({
    selection: { start: lineStart, end: lineStart + newBlock.length },
  });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/<sup>([^<]+)<\/sup>/g, '$1')
    .replace(/<sub>([^<]+)<\/sub>/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');
}

function applyClean(editor: InkInstance, info: SelectionInfo) {
  const doc = editor.getDoc();
  const start = info.from;
  const end = info.to;
  const text = doc.slice(start, end);
  editor.insert(stripMarkdown(text), { start, end });
}

export function applyFormat(
  editor: InkInstance,
  info: SelectionInfo,
  type: FormatType,
  payload: FormatPayload = {},
): void {
  const selection = { start: info.from, end: info.to };

  switch (type) {
    case 'bold':
      editor.format('bold' as any, { selection });
      break;
    case 'italic':
      editor.format('italic' as any, { selection });
      break;
    case 'code':
      editor.format('code' as any, { selection });
      break;
    case 'code_block':
      editor.format('code_block' as any, { selection });
      break;
    case 'bullet_list':
      editor.format('list' as any, { selection });
      break;
    case 'ordered_list':
      editor.format('ordered_list' as any, { selection });
      break;
    case 'task_list':
      editor.format('task_list' as any, { selection });
      break;
    case 'quote':
      editor.format('quote' as any, { selection });
      break;
    case 'strike':
      editor.wrap({ before: '~~', after: '~~', selection });
      break;
    case 'highlight':
      editor.wrap({ before: '==', after: '==', selection });
      break;
    case 'formula':
      editor.wrap({ before: '$', after: '$', selection });
      break;
    case 'superscript':
      editor.wrap({ before: '<sup>', after: '</sup>', selection });
      break;
    case 'subscript':
      editor.wrap({ before: '<sub>', after: '</sub>', selection });
      break;
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
    case 'callout':
      applyCallout(editor, info, payload.calloutType ?? 'note');
      break;
    case 'link':
      if (payload.asset) {
        const str = castAssetPropValueToString(payload.asset);
        editor.insert(`[[${str}]]`, selection);
      } else {
        const url = payload.url ?? '';
        editor.wrap({ before: '[', after: `](${url})`, selection });
      }
      break;
    case 'clean':
      applyClean(editor, info);
      break;
  }
}
