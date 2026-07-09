import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';

import { parser } from '@lezer/markdown';
import { generateTextHeaderAnchor } from '~ims-app-base/logic/utils/assets';

function stripFrontMatter(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith('---')) return input;
  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) return input;
  return trimmed.slice(endIdx + 3).trim();
}

function extractHeaderAnchorsFromMarkdown(input: string) {
  const input_body = stripFrontMatter(input);
  const tree = parser.parse(input_body);
  const headers: { title: string; level: number; anchor: string }[] = [];
  const used_anchors = new Set<string>();

  const cursor = tree.cursor();

  while (cursor.next()) {
    if (
      cursor.name.startsWith('ATXHeading') ||
      cursor.name.startsWith('SetextHeading')
    ) {
      const level = parseInt(cursor.name.slice(-1));
      if (typeof level !== 'number') continue;
      let header_text = '';

      if (cursor.name.startsWith('ATXHeading')) {
        const cursor_to = cursor.to;
        cursor.next();
        const cursor_from = cursor.to;
        header_text = input_body.substring(cursor_from, cursor_to);
      } else {
        const cursor_from = cursor.from;
        cursor.firstChild();
        const cursor_to = cursor.from;
        header_text = input_body.substring(cursor_from, cursor_to);
      }

      header_text = header_text.trim();

      if (header_text) {
        const anchor = generateTextHeaderAnchor(header_text, used_anchors);
        used_anchors.add(anchor);
        headers.push({
          title: header_text,
          level,
          anchor: anchor,
        });
      }
    }
  }

  return headers;
}

export class MarkdownBlockController extends BlockEditorController {
  override getContentItems(): BlockContentItem<any>[] {
    const anchors_list: BlockContentItem<void>[] = [];
    if (this.resolvedBlock) {
      if (this.resolvedBlock.title) {
        anchors_list.push({
          blockId: this.resolvedBlock.id,
          itemId: 'header',
          title: this.resolvedBlock.title,
          level: 1,
          anchor: '',
          index: 1,
        });
      }

      const value = this.resolvedBlock.computed['value'];
      if (typeof value === 'string') {
        const headers = extractHeaderAnchorsFromMarkdown(value);
        for (const header of headers) {
          anchors_list.push({
            ...header,
            itemId: 'h-' + header.anchor,
            blockId: this.resolvedBlock.id,
          });
        }
      }
    }
    return anchors_list;
  }
}
