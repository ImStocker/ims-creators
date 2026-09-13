import type { AssetPropsPlainObject } from '~ims-app-base/logic/types/Props';
import { convertAssetPropsToPlainObject } from '~ims-app-base/logic/types/Props';
import type { SharedAssetBlock } from './asset-ops';
import { BLOCK_NAME_META } from '~ims-app-base/logic/constants';

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

  // Write blocks if present (Electron always writes them).
  // Stored blocks are in assigned (flatten) form; persist them as plain objects.
  if (asset.blocks) {
    ima_asset.blocks = asset.blocks.map((block) => {
      const disk_block: Record<string, unknown> = {
        id: block.id,
        type: block.type,
        name: block.name ?? null,
        title: block.title ?? null,
        index: block.index,
        own: block.own,
        ownTitle: block.ownTitle,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
        props: convertAssetPropsToPlainObject(block.props ?? {}),
        computed: convertAssetPropsToPlainObject(block.computed ?? {}),
        inherited: block.inherited ? convertAssetPropsToPlainObject(block.inherited) : null,
      };
      if (block.delete) disk_block.delete = true;
      return disk_block;
    });
  }

  // Build values from blocks (user-props only, filtered)
  const values: Record<string, AssetPropsPlainObject> = {};
  if (asset.blocks) {
    const blocks_for_values = asset.blocks.filter(
      (block) => block.name && !block.name.startsWith('__'),
    );
    for (const block of blocks_for_values) {
      if (!block.name) continue;
      const values_block_props = convertAssetPropsToPlainObject(block.props ?? {});
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
 * Serialize an asset to the new simplified .json format.
 *
 * Structure:
 * - Top-level keys = block values (named by block name, or @blockId for unnamed)
 * - __meta: system fields + __meta block values + block metadata array
 * - Markdown blocks: value unwrapped to a string (no "value" wrapper)
 * - Only own blocks stored; inherited copies skipped
 * - typeIds NOT stored (computed from parent chain at load time)
 */
export function serializeAssetToNewFormatJSON(
  asset: {
    id: string;
    title?: string | null;
    icon?: string | null;
    parentIds?: string[];
    projectId?: string;
    index?: number | null;
    isAbstract?: boolean;
    blocks?: SharedAssetBlock[];
  },
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const blocks = asset.blocks ?? [];

  // Find the __meta block
  const meta_block = blocks.find((b) => b.name === BLOCK_NAME_META);
  const meta_block_own_props = meta_block
    ? convertAssetPropsToPlainObject(meta_block.props ?? {})
    : {};

  // Top-level keys: own blocks (non-empty props, not __meta)
  for (const block of blocks) {
    if (block.name === BLOCK_NAME_META) continue;
    if (block.delete) continue;

    const has_own_props = block.props && Object.keys(block.props).length > 0;
    if (!has_own_props) continue;

    const key = block.name ? block.name : `@${block.id}`;
    const block_props_plain = convertAssetPropsToPlainObject(block.props ?? {});

    // Markdown blocks: unwrap value
    if (block.type === 'markdown' && typeof block_props_plain.value === 'string') {
      result[key] = block_props_plain.value;
    } else {
      result[key] = { ...block_props_plain };
    }
  }

  // Build __meta.blocks metadata
  const blocks_meta: Record<string, unknown>[] = [];
  for (const block of blocks) {
    if (block.name === BLOCK_NAME_META) continue;

    if (block.delete) {
      blocks_meta.push({
        id: block.id,
        name: block.name,
        deleted: true,
      });
    } else {
      const has_own_props = block.props && Object.keys(block.props).length > 0;
      if (!has_own_props) continue;

      const entry: Record<string, unknown> = {
        id: block.id,
        index: block.index,
        type: block.type,
      };
      if (block.name) entry.name = block.name;
      if (block.title) entry.title = block.title;
      if (block.createdAt) entry.createdAt = block.createdAt;
      if (block.updatedAt) entry.updatedAt = block.updatedAt;

      blocks_meta.push(entry);
    }
  }

  result.__meta = {
    id: asset.id,
    title: asset.title ?? null,
    parentIds: asset.parentIds ?? [],
    icon: asset.icon ?? undefined,
    projectId: asset.projectId ?? '',
    isAbstract: asset.isAbstract ?? undefined,
    index: asset.index ?? null,
    values: meta_block_own_props,
    blocks: blocks_meta,
  };

  return result;
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
