import {
  Decoration,
  type ViewUpdate,
  type EditorView,
  ViewPlugin,
  type DecorationSet,
} from '@codemirror/view';
import type { Range } from '@codemirror/state';

import { syntaxTree } from '@codemirror/language';
import { generateTextHeaderAnchor } from '~ims-app-base/logic/utils/assets';

// const headingIdPlugin = ViewPlugin.fromClass(
//   class {
//     constructor(private _view: EditorView) {}

//     update(update: ViewUpdate) {
//       if (!update.docChanged) return;

//       const builder: any[] = [];

//       syntaxTree(update.state).iterate({
//         enter: (node) => {
//           if (node.name === 'ATXHeading1') {
//             const line = this._view.state.doc.lineAt(node.from);

//             // Extract heading text (skip ###)
//             const text = line.text.replace(/^#+\s*/, '');
//             const id = '123';

//             builder.push(
//               Decoration.line({
//                 attributes: { id },
//               }).range(line.from),
//             );
//           }
//         },
//       });

//       return Decoration.set(builder);
//     }
//   },
// );
const headingIdPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(private view: EditorView) {
      // начальная отрисовка
      this.decorations = this.buildDecorations();
    }

    update(update: ViewUpdate) {
      if (update.docChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) {
        this.decorations = this.buildDecorations();
      }
    }

    private buildDecorations(): DecorationSet {
      const builder: Range<Decoration>[] = [];
      const used_anchors = new Set<string>();

      syntaxTree(this.view.state).iterate({
        enter: (ctx) => {
          if (
            ctx.name.startsWith('ATXHeading') ||
            ctx.name.startsWith('SetextHeading')
          ) {
            let header_text = '';

            if (ctx.name.startsWith('ATXHeading')) {
              const cursor_to = ctx.to;
              const cursor_from = ctx.node.firstChild!.to;
              header_text = this.view.state.doc.sliceString(
                cursor_from,
                cursor_to,
              );
            } else {
              const cursor_from = ctx.from;
              const cursor_to = ctx.node.firstChild!.from;
              header_text = this.view.state.doc.sliceString(
                cursor_from,
                cursor_to,
              );
            }

            header_text = header_text.trim();

            if (!header_text) return;

            const anchor = generateTextHeaderAnchor(header_text, used_anchors);
            used_anchors.add(anchor);

            const line = this.view.state.doc.lineAt(ctx.from);

            const id = 'h-' + anchor;

            if (!id) return;

            builder.push(
              Decoration.line({
                attributes: { id },
              }).range(line.from),
            );
          }
        },
      });

      return Decoration.set(builder, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export function headingId() {
  return [
    {
      type: 'default',
      value: headingIdPlugin,
    },
  ];
}
