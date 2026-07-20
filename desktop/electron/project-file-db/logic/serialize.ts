import type { AssetPropsPlainObject } from '~ims-app-base/logic/types/Props';
import type { SharedAssetBlock } from './asset-ops';

// ── Asset Serialization ───────────────────────────────────────────────────────

/**
 * Serialize an asset to its on-disk .ima.json format.
 * This produces the canonical format used by IMS Desktop:
 * - blocks: full block structure (inherited, computed, props)
 * - values: simplified user-props only (for backwards compatibility)
 *
 * Both `blocks` and `values` are written — this matches
 * AssetService.saveAssetFileToStream behavior.
 */
export function serializeAssetToJSON(
  asset: {
    id: string;
    title?: string | null;
    name?: string | null;
    icon?: string | null;
    typeIds?: string[];
    parentIds?: string[];
    workspaceId?: string | null;
    index?: number | null;
    isAbstract?: boolean;
    comments?: unknown[];
    references?: unknown[];
    blocks?: SharedAssetBlock[];
  },
  opts?: { compact?: boolean },
): Record<string, unknown> {
  const indent = opts?.compact ? undefined : 1;

  const ima_asset: Record<string, unknown> = {
    id: asset.id,
    title: asset.title ?? null,
    name: asset.name ?? null,
    icon: asset.icon ?? undefined,
    typeIds: asset.typeIds ?? [],
    parentIds: asset.parentIds ?? [],
    workspaceId: asset.workspaceId ?? null,
    index: asset.index ?? null,
    isAbstract: asset.isAbstract ?? undefined,
    comments: asset.comments ?? [],
    references: asset.references ?? [],
  };

  // Write blocks if present (Electron always writes them)
  if (asset.blocks) {
    ima_asset.blocks = asset.blocks;
  }

  // Build values from blocks (user-props only, filtered)
  const values: Record<string, AssetPropsPlainObject> = {};
  if (asset.blocks) {
    const blocks_for_values = asset.blocks.filter(
      (block) => block.name && !block.name.startsWith('__'),
    );
    for (const block of blocks_for_values) {
      if (!block.name) continue;
      const values_block_props = { ...block.props };
      const block_props_keys = Object.keys(values_block_props);
      for (const block_props_key of block_props_keys) {
        if (/^(__|~).+/.test(block_props_key)) {
          delete values_block_props[block_props_key];
        }
      }
      values[block.name] = values_block_props;
    }
  }
  ima_asset.values = values;

  return ima_asset;
}

/**
 * Serialize a workspace to its on-disk .imw.json format.
 */
export function serializeWorkspaceToJSON(
  workspace: {
    id: string;
    title?: string | null;
    name?: string | null;
    parentId?: string | null;
    index?: number | null;
    props?: Record<string, unknown>;
  },
): Record<string, unknown> {
  return {
    id: workspace.id,
    title: workspace.title ?? null,
    name: workspace.name ?? null,
    parentId: workspace.parentId ?? null,
    index: workspace.index ?? null,
    props: workspace.props ?? {},
  };
}
