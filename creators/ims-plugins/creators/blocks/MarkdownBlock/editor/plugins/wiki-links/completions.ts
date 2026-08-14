import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import type { PluginConfig } from './index';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import {
  castAssetPropValueToString,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';

async function loadOptions(query: string, config: PluginConfig) {
  return await config.appManager.get(CreatorAssetManager).getAssetShortsList({
    where: {
      query,
      workspaceids: config.appManager
        .get(ProjectManager)
        .getWorkspaceIdByName('gdd'),
    },
  });
}

export const completions = (config: PluginConfig): CompletionSource => {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/\[\[(?:.(?!\[\[))*?/);

    if (!match) {
      return null;
    }

    const query = match.text.slice(2).trim();

    const options = await loadOptions(query, config);

    return {
      from: match.from + 2,
      options: options.list.map((asset) => {
        return {
          apply: `${castAssetPropValueToString({
            AssetId: asset.id,
            Name: asset.name ?? undefined,
            Title: asset.title ?? undefined,
          } as AssetPropValueAsset)}]]`,
          label: asset.title ?? asset.id,
          type: 'text',
        };
      }),
    };
  };
};
