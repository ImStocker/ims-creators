import { defineAsyncComponent } from 'vue';
import {
  LEVEL_ASSET_ID,
  DIAGRAM_ASSET_ID,
  SCRIPT_ASSET_ID,
  GAME_OBJECT_ASSET_ID,
  GRAPH_ASSET_ID,
} from '~ims-app-base/logic/constants';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';

export default function () {
  return [
    {
      type: 'module',
      content: {
        async activate(appManager: IAppManager) {
          const cancel_callbacks: { cancel: () => void }[] = [];

          cancel_callbacks.push(
            appManager.get(EditorManager).registerAssetLayout({
              name: 'gameobject',
              editorComponent: defineAsyncComponent(
                () => import('./AssetEditors/AssetBlockGameObjectEditor.vue'),
              ),
              props: {
                headerLocaleButton: true,
              },
            }),
          );

          cancel_callbacks.push(
            appManager
              .get(EditorManager)
              .registerAssetLayoutBind(LEVEL_ASSET_ID, 'full'),
          );

          cancel_callbacks.push(
            appManager
              .get(EditorManager)
              .registerAssetLayoutBind(DIAGRAM_ASSET_ID, 'full'),
          );

          cancel_callbacks.push(
            appManager
              .get(EditorManager)
              .registerAssetLayoutBind(SCRIPT_ASSET_ID, 'full'),
          );

          cancel_callbacks.push(
            appManager
              .get(EditorManager)
              .registerAssetLayoutBind(GRAPH_ASSET_ID, 'full'),
          );

          cancel_callbacks.push(
            appManager
              .get(EditorManager)
              .registerAssetLayoutBind(GAME_OBJECT_ASSET_ID, 'gameobject'),
          );

          return async () => {
            for (const descr of cancel_callbacks) {
              descr.cancel();
            }
          };
        },
      },
    },
  ];
}
