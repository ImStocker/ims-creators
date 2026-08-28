import { syntaxTree } from '@codemirror/language';
import { RangeSet, StateField } from '@codemirror/state';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';

interface PluginConfig {
  appManager: IAppManager;
}

function openLink(url: string, appManager: IAppManager) {
  const trimmed = url.trim();

  const assetMatch = trimmed.match(/^#asset:([0-9a-f-]+)$/i);
  if (assetMatch) {
    appManager.get(EditorManager).openAsset(assetMatch[1], 'popup');
    return;
  }

  // Open web/mail URLs in a new tab.
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^ftp:\/\//i.test(trimmed)
  ) {
    window.open(trimmed, '_blank', 'noopener,noreferrer');
    return;
  }

  // Best-effort fallback for relative/asset paths.
  window.open(trimmed, '_blank', 'noopener,noreferrer');
}

// The whole link (label + markers) gets this class so it is visually a link and
// so a mousedown on it can be intercepted to open the URL. The markers
// (`[`, `]`, `(`, `)` and the URL) stay hidden by the live-preview plugin.
const linkMark = Decoration.mark({ class: 'cm-md-link' });

const decorate = (
  state: EditorState,
  appManager: IAppManager,
): DecorationSet => {
  const ranges: Range<Decoration>[] = [];

  const cursorInside = (from: number, to: number) =>
    state.selection.ranges.some((r) => r.from <= to && r.to >= from);

  // Walk the URL nodes (also matched/hidden by the live-preview plugin) and
  // mark their enclosing Link/Autolink as clickable.
  syntaxTree(state).iterate({
    enter: (ref) => {
      if (ref.type.name !== 'URL') return;
      const link = ref.node.parent;
      if (!link) return;
      const linkName = link.name;
      if (linkName !== 'Link' && linkName !== 'Autolink') return;

      const from = link.from;
      const to = link.to;

      // While the caret is inside the link, show the raw markdown so it can be
      // edited (consistent with wiki links / the live-preview marker reveal).
      if (cursorInside(from, to)) return;

      ranges.push(linkMark.range(from, to));
    },
  });

  ranges.sort((a, b) => a.from - b.from);
  return ranges.length > 0 ? RangeSet.of(ranges) : Decoration.none;
};

export const linkWidgets = (config: PluginConfig): Extension => {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state, config.appManager);
    },
    update(value, tr) {
      if (
        tr.docChanged ||
        tr.selectionSet ||
        syntaxTree(tr.state) !== syntaxTree(tr.startState)
      ) {
        return decorate(tr.state, config.appManager);
      }
      return value.map(tr.changes);
    },
    provide(f) {
      return EditorView.decorations.from(f);
    },
  });

  // Open the link when the user clicks the (clickable) link text.
  const handlers = EditorView.domEventHandlers({
    mousedown: (event, view) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.closest('.cm-md-link')) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;

      let node = syntaxTree(view.state).resolve(pos, -1);
      let link = node;
      while (link && link.name !== 'Link' && link.name !== 'Autolink') {
        link = link.parent;
      }
      if (!link) return false;

      const urlNode = link.getChild('URL');
      const url = urlNode
        ? view.state.doc.sliceString(urlNode.from, urlNode.to)
        : '';
      if (!url) return false;

      event.preventDefault();
      openLink(url, config.appManager);
      return true;
    },
  });

  return [field, handlers];
};
