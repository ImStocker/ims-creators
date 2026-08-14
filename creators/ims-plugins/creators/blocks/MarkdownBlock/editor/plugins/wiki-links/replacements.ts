import { syntaxTree } from '@codemirror/language';
import { RangeSet, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { EditorState, Extension, Range } from '@codemirror/state';
import type { DecorationSet, WidgetType, ViewUpdate } from '@codemirror/view';
import type { PluginConfig } from './index';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import { getProjectLinkHref } from '~ims-app-base/logic/router/routes-helpers';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';

function parseIMSWikiLink(text: string): { title: string; id: string } | null {
  const match = text.match(/^\[(.+?)\]\(#asset:([0-9a-f-]+)\)$/i);
  if (match) {
    return { title: match[1].trim(), id: match[2] };
  }
  return null;
}

interface WikiLinkWidget extends WidgetType {
  compare: (widget: WikiLinkWidget) => boolean;
  assetId: string;
}

function createWikiLinkWidget(
  link_data: {
    title: string;
    id: string;
  },
  appManager: IAppManager,
): WikiLinkWidget {
  return {
    coordsAt: () => null,
    compare: (other) => {
      return other.assetId === link_data.id;
    },
    destroy: () => {},
    eq: (other: WikiLinkWidget) => {
      return other.assetId === link_data.id;
    },
    assetId: link_data.id,
    estimatedHeight: -1,
    ignoreEvent: () => true,
    lineBreaks: 0,
    toDOM: () => {
      const a = document.createElement('a');
      const project_info = appManager.get(ProjectManager).getProjectInfo();

      a.innerText = link_data.title;
      a.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        appManager.get(EditorManager).openAsset(link_data.id, 'popup');
      };
      if (project_info) {
        a.href = getProjectLinkHref(
          appManager.getRouter(),
          project_info,
          {
            name: 'project-asset-by-id',
            params: {
              assetId: link_data.id,
            },
          },
          true,
        );
      }

      return a;
    },
    updateDOM: () => false,
  };
}

function isCursorInRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  return state.selection.ranges.some((range) => {
    return Math.max(from, range.from) <= Math.min(to, range.to);
  });
}

function getCachedAssetFromString(
  asset_string: string,
  appManager: IAppManager,
) {
  const parsed_asset_data = parseIMSWikiLink(asset_string);
  if (parsed_asset_data) {
    return appManager
      .get(CreatorAssetManager)
      .getAssetShortViaCacheSync(parsed_asset_data.id);
  } else {
    return appManager
      .get(CreatorAssetManager)
      .getAssetShortByTitleViaCacheSync(asset_string);
  }
}

// Define a state effect to trigger a refresh of decorations
export const refreshDecorations = StateEffect.define<null>();

export const replacements = (config: PluginConfig): Extension[] => {
  function decorate(state: EditorState) {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to }) => {
        if (type.name !== 'WikiLink') return;
        // Do not run on empty WikiLinks
        if (from + 2 === to - 2) return;

        if (isCursorInRange(state, from + 2, to - 2)) return;

        const asset_string = state.sliceDoc(from + 2, to - 2);

        const cached_asset = getCachedAssetFromString(
          asset_string,
          config.appManager,
        );

        if (cached_asset) {
          const decoration = Decoration.replace({
            widget: createWikiLinkWidget(
              {
                title: cached_asset.title ?? `Asset ${cached_asset.id}`,
                id: cached_asset.id,
              },
              config.appManager,
            ),
          });
          widgets.push(decoration.range(from + 2, to - 2));
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  }

  const stateField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(value, tr) {
      if (
        tr.docChanged ||
        tr.selection ||
        tr.effects.some((e) => e.is(refreshDecorations)) ||
        syntaxTree(tr.state) !== syntaxTree(tr.startState)
      ) {
        return decorate(tr.state);
      }
      return value.map(tr.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  type MissedAssetQuery =
    | { kind: 'byId'; id: string }
    | { kind: 'byTitle'; title: string };

  // ViewPlugin to handle async fetching
  const asyncFetcher = ViewPlugin.fromClass(
    class {
      private pending: Set<MissedAssetQuery> = new Set();

      constructor(private _view: EditorView) {}

      update(update: ViewUpdate) {
        const missingAssets = new Set<MissedAssetQuery>();
        const state = update.state;

        syntaxTree(state).iterate({
          enter: ({ type, from, to }) => {
            if (type.name !== 'WikiLink') return;
            if (from + 2 === to - 2) return;

            const asset_string = state.sliceDoc(from + 2, to - 2);

            const cached_asset = getCachedAssetFromString(
              asset_string,
              config.appManager,
            );

            if (cached_asset === undefined) {
              const parsed_asset_data = parseIMSWikiLink(asset_string);
              if (parsed_asset_data) {
                missingAssets.add({ kind: 'byId', id: parsed_asset_data.id });
              } else {
                missingAssets.add({ kind: 'byTitle', title: asset_string });
              }
            }
          },
        });

        for (const asset_query of missingAssets) {
          if (this.pending.has(asset_query)) continue;
          this.pending.add(asset_query);

          if (asset_query.kind === 'byId') {
            config.appManager
              .get(CreatorAssetManager)
              .getAssetShortViaCache(asset_query.id)
              .then(() => {
                this.pending.delete(asset_query);
                this._view.dispatch({ effects: refreshDecorations.of(null) });
              })
              .finally(() => {
                this.pending.delete(asset_query);
              });
          } else {
            config.appManager
              .get(CreatorAssetManager)
              .getAssetShortsList({ where: { query: asset_query.title } })
              .then((res) => {
                this.pending.delete(asset_query);
                if (res.list.length) {
                  this._view.dispatch({ effects: refreshDecorations.of(null) });
                }
              })
              .finally(() => {
                this.pending.delete(asset_query);
              });
          }
        }
      }
    },
  );

  return [stateField, asyncFetcher];
};
