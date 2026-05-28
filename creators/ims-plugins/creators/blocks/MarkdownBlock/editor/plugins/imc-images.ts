import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, Range } from '@codemirror/state';
import { RangeSet, StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import FileManager from '~ims-app-base/logic/managers/FileManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';

function parseImagePathToFile(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');

  const match = normalized.match(/@(.*?)\/(.*?)\/([^/]*)$/);

  if (match) {
    return {
      Store: match[1],
      Dir: match[2],
      Title: match[3],
    };
  }
}

interface ImageWidgetParams {
  url: string;
}

type PluginConfig = {
  appManager: IAppManager;
};

class ImageWidget extends WidgetType {
  readonly url;

  constructor({ url }: ImageWidgetParams) {
    super();

    this.url = url;
  }

  override eq(imageWidget: ImageWidget) {
    return imageWidget.url === this.url;
  }

  toDOM() {
    const container = document.createElement('div');
    const backdrop = container.appendChild(document.createElement('div'));
    const figure = backdrop.appendChild(document.createElement('figure'));
    const image = figure.appendChild(document.createElement('img'));

    container.setAttribute('aria-hidden', 'true');
    container.className = 'cm-image-container';
    backdrop.className = 'cm-image-backdrop';
    figure.className = 'cm-image-figure';
    image.className = 'cm-image-img';
    image.src = this.url;

    container.style.paddingBottom = '0.5rem';
    container.style.paddingTop = '0.5rem';

    backdrop.classList.add('cm-image-backdrop');

    backdrop.style.borderRadius = 'var(--ink-internal-border-radius)';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.overflow = 'hidden';
    backdrop.style.maxWidth = '100%';

    figure.style.margin = '0';

    image.style.display = 'block';
    image.style.maxHeight = 'var(--ink-internal-block-max-height)';
    image.style.maxWidth = '100%';
    image.style.width = '100%';

    return container;
  }
}

export const imagesExtension = (config: PluginConfig): Extension => {
  const imageDecoration = (imageWidgetParams: ImageWidgetParams) => {
    let url = imageWidgetParams.url;
    if (url.startsWith('<') && url.endsWith('>')) {
      url = url.slice(1, -1).trim();
    }
    if (!url.startsWith('http') && !url.startsWith('data')) {
      const file = parseImagePathToFile(url);
      if (file) {
        url = config.appManager.get(FileManager).getFileUrl(
          file as AssetPropValueFile,
        );
      }
    }
    return Decoration.widget({
      widget: new ImageWidget({ url }),
      side: -1,
      block: true,
    });
  };

  const decorate = (state: EditorState) => {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: (ctx) => {
        if (ctx.type.name === 'Image') {
          const url_node = ctx.node.getChild('URL');
          if (!url_node) return;
          const url = state.doc.sliceString(url_node.from, url_node.to);

          if (url)
            widgets.push(
              imageDecoration({ url: url }).range(
                state.doc.lineAt(ctx.from).from,
              ),
            );
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  };

  const imagesField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(images, transaction) {
      if (transaction.docChanged) return decorate(transaction.state);

      return images.map(transaction.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [imagesField];
};

export function imcImages(config: PluginConfig) {
  return [
    {
      type: 'default',
      value: imagesExtension(config),
    },
  ];
}
