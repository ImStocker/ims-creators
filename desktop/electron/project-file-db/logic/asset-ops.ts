import { v4 as uuidv4 } from 'uuid';
import {
  parseAssetNewBlockRef,
  assignPlainValueToAssetProps,
  applyPropsChange,
  extractRemapParentProps,
  remapAssetProps,
  convertAssetPropsToPlainObject,
  type AssetProps,
  type AssetPropsPlainObject,
} from '~ims-app-base/logic/types/Props';
import type { AssetBlockParamsDTO } from '~ims-app-base/logic/types/AssetsType';

// ── Shared Types ──────────────────────────────────────────────────────────────

/** Minimal block type compatible with both Desktop (ProjectFileDbAssetBlock) and MCP server */
export interface SharedAssetBlock {
  id: string;
  type: string;
  name: string | null;
  title: string | null;
  index: number;
  own: boolean;
  ownTitle: string | null;
  props: AssetPropsPlainObject;
  computed: AssetPropsPlainObject;
  inherited: AssetPropsPlainObject | null;
  createdAt: string;
  updatedAt: string;
  delete?: true;
  [key: string]: unknown;
}

/** Minimal asset type compatible with both sides */
export interface SharedAsset {
  id: string;
  typeIds: string[];
  parentIds: string[];
  blocks: SharedAssetBlock[];
  [key: string]: unknown;
}

/** Params for building a new asset */
export interface BuildAssetParams {
  id?: string;
  workspaceId?: string | null;
  title?: string | null;
  name?: string | null;
  icon?: string | null;
  isAbstract?: boolean;
  typeIds?: string[];
  parentIds?: string[];
  index?: number | null;
  creatorUserId?: string | null;
  blocks?: { [blockKey: string]: AssetBlockParamsDTO };
}

// ── Block Operations ──────────────────────────────────────────────────────────

/**
 * Merge new block changes into existing blocks.
 * This is the canonical implementation from AssetService._mergeBlocksToSave.
 *
 * @param oldBlocks - current blocks on the asset
 * @param newBlocks - keyed by block reference ("blockName" or "blockName@blockId")
 * @param undo - optional undo record (mutated in place)
 * @returns merged block array sorted by index
 */
export function mergeBlocksToSave(
  oldBlocks: SharedAssetBlock[],
  newBlocks: { [blockKey: string]: AssetBlockParamsDTO },
  undo?: Record<string, any>,
): SharedAssetBlock[] {
  const result: SharedAssetBlock[] = [];
  const changed_block_ids = new Set<string>();

  for (const [block_key, new_block] of Object.entries(newBlocks)) {
    const { blockId, blockName } = parseAssetNewBlockRef(block_key);
    const old_block = oldBlocks.find((block) => {
      if (blockId) {
        return block.id === blockId;
      } else if (blockName) {
        return block.name === blockName;
      }
      return false;
    });

    let block_undo: AssetBlockParamsDTO | undefined;
    if (undo) {
      if (!undo.blocks) undo.blocks = {};
      if (blockId) {
        undo.blocks[`@${blockId}`] = {};
        block_undo = undo.blocks[`@${blockId}`];
      } else if (blockName) {
        undo.blocks[blockName] = {};
        block_undo = undo.blocks[blockName];
      }
    }

    const result_block = prepareBlockToSave(
      block_key,
      old_block ? old_block : null,
      new_block,
      block_undo,
    );
    if (result_block) {
      result.push(result_block);
      changed_block_ids.add(result_block.id);
    }
    if (old_block) changed_block_ids.add(old_block.id);
  }

  for (const old_block of oldBlocks) {
    if (!changed_block_ids.has(old_block.id)) {
      result.push(old_block);
    }
  }

  return result.sort((a, b) => a.index - b.index);
}

/**
 * Prepare a single block for saving.
 * This is the canonical implementation from AssetService._prepareBlockToSave.
 */
export function prepareBlockToSave(
  block_key: string,
  old_block: Partial<SharedAssetBlock> | null,
  new_block: AssetBlockParamsDTO,
  block_undo?: AssetBlockParamsDTO,
): SharedAssetBlock | null {
  const { blockId, blockName } = parseAssetNewBlockRef(block_key);

  if (!(old_block?.type || new_block.type)) {
    throw new Error('Type is not set');
  }

  const old_block_props = assignPlainValueToAssetProps({}, old_block?.props ?? {});
  const old_block_inherited = old_block?.inherited
    ? assignPlainValueToAssetProps({}, old_block.inherited ?? {})
    : null;

  let result_props = old_block_props;
  let result_props_undo: AssetProps[] | undefined;
  if (new_block.props) {
    const new_block_props_change = Array.isArray(new_block.props)
      ? new_block.props
      : [new_block.props];
    const result_props_applied_change = applyPropsChange(
      old_block_props,
      old_block_inherited ?? {},
      new_block_props_change,
    );
    result_props = result_props_applied_change.props;
    result_props_undo = result_props_applied_change.undo;
  }

  const { normalProps, remapParentProps } = extractRemapParentProps(result_props);
  let computed_props: AssetProps = {};
  if (old_block_inherited) {
    if (remapParentProps) {
      computed_props = remapAssetProps(old_block_inherited, remapParentProps);
    } else {
      computed_props = old_block_inherited;
    }
  }
  computed_props = { ...computed_props, ...normalProps };

  const now = new Date().toISOString();
  const block_entity: SharedAssetBlock = {
    id: blockId ?? old_block?.id ?? uuidv4(),
    name: new_block.name ?? old_block?.name ?? blockName,
    index: new_block.index ?? old_block?.index ?? 0,
    type: (new_block.type ?? old_block?.type) as string,
    title: new_block.title ?? old_block?.title ?? null,
    ownTitle: new_block.title ?? old_block?.ownTitle ?? null,
    createdAt: old_block?.createdAt ?? now,
    updatedAt: now,
    own: old_block?.own ?? true,
    inherited: old_block_inherited
      ? convertAssetPropsToPlainObject(old_block_inherited)
      : null,
    computed: convertAssetPropsToPlainObject(computed_props),
    props: convertAssetPropsToPlainObject(result_props),
  };

  if (block_undo) {
    if (new_block.delete || new_block.reset) {
      if (old_block) {
        block_undo = {
          index: old_block.index,
          name: old_block.name,
          title: old_block.title,
          props: assignPlainValueToAssetProps({}, old_block.props ?? {}),
          type: old_block.type,
        };
      }
    } else {
      if (old_block) {
        if (block_undo) {
          for (const [prop, val] of Object.entries(new_block) as [keyof AssetBlockParamsDTO, any][]) {
            switch (prop) {
              case 'delete':
              case 'props':
              case 'reset':
                continue;
              default:
                block_undo[prop] = old_block[prop] as any;
            }
          }
          if (result_props_undo) block_undo.props = result_props_undo;
        }
      } else {
        if (block_undo) {
          block_undo = {
            delete: true,
          };
        }
      }
    }
  }

  if (new_block.delete) {
    if (old_block?.inherited) {
      block_entity.delete = true;
      block_entity.props = {};
      block_entity.computed = {};
    } else return null;
  } else if (new_block.reset) {
    block_entity.props = {};
    block_entity.computed = { ...block_entity.inherited };
  }

  return block_entity;
}

// ── Asset Building ────────────────────────────────────────────────────────────

/**
 * Build a new asset object with proper type inheritance.
 * This is the canonical implementation from AssetService._assetsCreateImpl.
 *
 * @param params - asset creation params
 * @param parentAsset - the parent type asset (if inheriting), or null
 * @param projectId - the project ID
 * @returns the new asset object (not yet saved to disk)
 */
export function buildNewAsset(
  params: BuildAssetParams,
  parentAsset: SharedAsset | null,
  projectId: string,
): SharedAsset {
  let parent_props: SharedAssetBlock[] = [];
  let type_ids: string[] = [];

  if (parentAsset) {
    for (const block of parentAsset.blocks) {
      parent_props.push({
        ...block,
        inherited: { ...block.computed },
        computed: { ...block.props },
        props: {},
      });
    }
    if (parentAsset.typeIds) {
      type_ids = [...parentAsset.typeIds];
    }
    type_ids.unshift(parentAsset.id);
  }

  const now = new Date().toISOString();
  const asset_id = params.id ?? uuidv4();

  const asset: SharedAsset = {
    id: asset_id,
    projectId: projectId ?? '',
    workspaceId: params.workspaceId ?? null,
    name: params.name ?? null,
    title: params.title ?? null,
    icon: params.icon ?? null,
    isAbstract: params.isAbstract ?? false,
    typeIds: params.typeIds ?? type_ids,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rights: 5, // FULL_ACCESS
    index: params.index ?? null,
    creatorUserId: params.creatorUserId ?? null,
    unread: 0,
    hasImage: false,
    parentIds: params.parentIds ?? [],
    ownTitle: params.title ?? null,
    ownIcon: params.icon ?? null,
    blocks: params.blocks
      ? mergeBlocksToSave(parent_props, params.blocks)
      : parent_props,
    comments: [],
    references: [],
    lastViewedAt: null,
  } as SharedAsset;

  return asset;
}
