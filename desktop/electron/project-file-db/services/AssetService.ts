/* eslint-disable @typescript-eslint/no-unused-vars */
import { readFieldDescriptorValue } from "../asset-fields";
import { type ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbAssetBlock } from "../ProjectFileDb";
import { ProjectFileDbCollection } from "../logic/ProjectFileDbCollection";
import fs from 'node:fs';
import fse from 'fs-extra';
import * as node_path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AssetSearchFilter } from "../logic/AssetSearchFilter";
import { getAssetLocalPath, getAssetLocalPathById, getImsExtname, getIndexRangeStartAndStep, getWorkspaceLocalPathFolderById, absolutePathToUuid } from "../utils/files";
import { ASSET_EXT } from "./FileSystemService";
import { once } from "node:events";
import type { Writable } from "node:stream";
import { HistoryChangeRecord } from "../logic/HistoryChangeRecord";
import { BLOCK_NAME_META } from "~ims-app-base/logic/constants";
import type { AssetHistoryDTO } from "~ims-app-base/logic/types/AssetHistory";
import type { AssetQueryWhere, AssetsShortResult, AssetShort, AssetsFullResult, AssetsGraphItem, AssetsGraph, AssetBlockParamsDTO, AssetSetDTO, AssetCreateDTO, AssetsChangeResult, AssetChangeDTO, AssetChangeBatchOpDTO, AssetsBatchChangeResultDTO, AssetWhereParams, AssetDeleteResultDTO, CreateRefDTO, AssetReferencesResult, AssetDeleteRefResultDTO, AssetMoveParams, AssetMoveResult, AssetMoveResultItem } from "~ims-app-base/logic/types/AssetsType";
import type { AssetBlockEntity } from "~ims-app-base/logic/types/BlocksType";
import type { IProjectDatabaseAsset } from "~ims-app-base/logic/types/IProjectDatabase";
import type { ApiRequestList, ApiResultListWithTotal, ApiResultListWithMore } from "~ims-app-base/logic/types/ProjectTypes";
import { type AssetPropsPlainObjectValue, type AssetPropsPlainObject, type AssetPropValue, assignPlainValueToAssetProps, convertAssetPropsToPlainObject, castAssetPropValueToString, getAssetPropType, type AssetProps, extractAssetLinksFromProps, parseAssetNewBlockRef, type AssetBlockIdWithName } from "~ims-app-base/logic/types/Props";
import type { AssetPropsSelectionOrder, AssetPropsSelection, AssetPropsSelectionField } from "~ims-app-base/logic/types/PropsSelection";
import { AssetRights } from "~ims-app-base/logic/types/Rights";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import { ASSET_BASE_ORDERING, ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT, type AssetSaveFormat } from "../project-db-constants";

import { ProjectFileDbTransaction } from "../logic/ProjectFileDbTransaction";
import {
    applyAssetSelectionFunc,
    computeSelectionFieldValue,
    getSelectionFieldsBlocks,
    isAggregateAssetSelectionFunc,
    resolveOrderItems,
    resolveSelectionField,
    resolveSelectionFields,
    selectionIsFullyAggregate,
    sortByOrder,
    validateAggregateSelection,
    type ResolvedSelectionField,
} from "../logic/asset-selection";
import { mergeBlocksToSave, formBlockComputed } from "../logic/asset-ops";
import { serializeAssetToJSON, serializeAssetToNewFormatJSON } from "../logic/serialize";
import { buildMarkdownFrontmatter, MARKDOWN_DEFAULT_ICON, type MarkdownFrontmatterMeta } from "../logic/markdown-frontmatter";
import { suggestUniqueFilename } from "../utils/files";

export type AssetServiceAssetCreateDTO = AssetCreateDTO & { localName?: string }

const HAS_IMAGE_FIELD_SELECTOR: AssetPropsSelectionField = {
    prop: 'gallery|main\\value',
    as: 'hasImage',
    func: 'notEmpty',
}
const HAS_IMAGE_FIELD = resolveSelectionField(HAS_IMAGE_FIELD_SELECTOR);

export type AssetServiceAssetChangeBatchOpDTO = {
    create?: boolean | { id?: string | null, localName?: string };
    set: AssetSetDTO;
    where?: AssetWhereParams;
};

export class AssetService implements IProjectDatabaseAsset {


    private _sessionChangeHistory = new Map<string, HistoryChangeRecord>()
    private _sessionDeletedAssets = new ProjectFileDbCollection<ProjectFileDbAsset>();
    assets = new ProjectFileDbCollection<ProjectFileDbAsset>();
    systemAssets = new ProjectFileDbCollection<ProjectFileDbAsset>();

    private _typeChildren = new Map<string, Set<string>>();

    constructor(public db: ProjectFileDb) {

    }

    public async searchAssets(where: AssetQueryWhere): Promise<ProjectFileDbAsset[]> {
        if (Object.keys(where).length === 0) {
            return [...this.assets.iterate()].map(asset => this._cloneFullAsset(asset))
        }

        const filter = await AssetSearchFilter.Create(where, this.db);
        const result = await filter.apply(this.assets.iterate());
        return result.map(asset => this._cloneFullAsset(asset));
    }

    /**
     * Block props only exist in `block.computed`, which is only filled in by
     * computeFullAsset. Resolve just the blocks the query actually reads, the
     * same way AssetSearchFilter does before filtering on block values.
     */
    private async _resolveAssetsBlocks(
        assets: ProjectFileDbAsset[],
        blocks: AssetBlockIdWithName[],
    ): Promise<ProjectFileDbAsset[]> {
        if (blocks.length === 0) {
            return assets;
        }
        const res: ProjectFileDbAsset[] = [];
        for (const asset of assets) {
            res.push(await this.computeFullAsset(asset, blocks));
        }
        return res;
    }

    private async _sortAssets(assets: ProjectFileDbAsset[], order: AssetPropsSelectionOrder[]): Promise<ProjectFileDbAsset[]> {
        const order_items = resolveOrderItems(order ? order : ASSET_BASE_ORDERING);
        if (order_items.length === 0) {
            return [...assets];
        }
        const prepared = await this._resolveAssetsBlocks(
            assets,
            getSelectionFieldsBlocks(order_items),
        );
        return sortByOrder(
            prepared,
            order_items,
            (asset, field) => readFieldDescriptorValue(asset, field.descriptor) as AssetPropValue,
        );
    }
    async assetsGetShort(query: ApiRequestList<AssetQueryWhere>): Promise<AssetsShortResult> {
        const result = await this.assetsGetView<AssetShort>({
            ...query,
            select: [
                'id',
                {
                    prop: 'createdat',
                    as: 'createdAt',
                },
                'icon',
                {
                    prop: 'isabstract',
                    as: 'isAbstract',
                },
                'name',
                {
                    prop: 'typeids',
                    as: 'typeIds',
                },
                'unread',
                'rights',
                {
                    prop: 'deletedat',
                    as: 'deletedAt',
                },
                'title',
                {
                    prop: 'updatedat',
                    as: 'updatedAt',
                },
                {
                    prop: 'workspaceid',
                    as: 'workspaceId',
                },
                'index',
                {
                    prop: 'creatoruserid',
                    as: 'creatorUserId',
                },
                {
                    prop: 'projectid',
                    as: 'projectId',
                },
                HAS_IMAGE_FIELD_SELECTOR
            ]
        },
            {
                folded: true,
            });
        const workspaces = await this.db.workspace.loadAssetWorkspacesTree(result.list.map(item => (item as any).workspaceId));
        return {
            list: result.list.map(item => {
                const asset_info = this.assets.byId.get(item.id);
                return {
                    ...item,
                    localName: asset_info?.localName,
                }
            }),
            objects: {
                workspaces: Object.fromEntries([...workspaces.entries()].map(([id, workspace]) => {
                    const props = assignPlainValueToAssetProps({}, workspace.props)
                    return [id, {
                        ...workspace,
                        unread: 0,
                        props: props
                    }] as any
                })),
                users: {},
            },
            total: result.total,
        };
    }

    async getAssetFullById(asset_id: string): Promise<ProjectFileDbAsset | null> {
        const db_asset = this.assets.byId.get(asset_id);
        if (!db_asset) {
            return null;
        }
        return await this.computeFullAsset(db_asset, null);
    }

    private _getMaxTypeChangeTime(db_asset: ProjectFileDbAsset): string | null {
        let max: string | null = null;
        for (const ancestor_id of db_asset.typeIds) {
            const ancestor = this.assets.byId.get(ancestor_id);
            const t = ancestor?.updatedAt;
            if (t && (max === null || t > max)) max = t;
        }
        return max;
    }

    private _assetIsComputed(asset: ProjectFileDbAsset, parent_change_at: string | null): boolean {
        if (!asset.computedAt) return false;
        if (asset.updatedAt && asset.computedAt < asset.updatedAt) return false;
        if (parent_change_at && asset.computedAt < parent_change_at) return false;
        return true;
    }

    private _blockIsComputed(block: ProjectFileDbAssetBlock, asset_computed_at: string | null | undefined, parent_change_at: string | null): boolean {
        if (!block.computedAt) return false;
        if (parent_change_at && block.computedAt < parent_change_at) return false;
        if (asset_computed_at && block.computedAt < asset_computed_at) return false;
        return true;
    }

    private _cloneFullAsset(asset: ProjectFileDbAsset): ProjectFileDbAsset {
        const result: ProjectFileDbAsset = {
            ...asset,
            blocks: asset.blocks.map(block => ({ ...block }))
        };
        delete (result as any).computedAt;
        return result;
    }

    private _requestIsFullyComputed(asset: ProjectFileDbAsset, blocks_to_resolve: AssetBlockIdWithName[] | null): boolean {
        const parent_change_at = this._getMaxTypeChangeTime(asset);
        if (blocks_to_resolve === null) {
            return asset.blocks.every(block => block.delete || this._blockIsComputed(block, asset.computedAt, parent_change_at));
        }
        return blocks_to_resolve.every(ref => asset.blocks.some(block =>
            this._blockIsComputed(block, asset.computedAt, parent_change_at) && (
                (ref.blockId && ref.blockId === block.id) || (ref.blockName && ref.blockName === block.name)
            )
        ));
    }

    public async computeFullAsset(
        db_asset: ProjectFileDbAsset,
        blocks_to_resolve: AssetBlockIdWithName[] | null = null,
    ): Promise<ProjectFileDbAsset> {
        const current = this.assets.byId.get(db_asset.id) ?? db_asset;
        const parent_change_at = this._getMaxTypeChangeTime(current);
        const asset_stale = !this._assetIsComputed(current, parent_change_at);

        if (!asset_stale && this._requestIsFullyComputed(current, blocks_to_resolve)) {
            return this._cloneFullAsset(current);
        }

        const asset: ProjectFileDbAsset = {
            ...current,
            blocks: current.blocks.map(block => {
                return {
                    ...block,
                    inherited: null
                }
            })
        };

        const parent_id = current.parentIds && current.parentIds.length > 0 ? current.parentIds[0] : null
        const parent_basic = parent_id ? (this.assets.byId.get(parent_id) ?? null) : null;
        const parent_asset = parent_basic ? await this.computeFullAsset(parent_basic, blocks_to_resolve) : null;
        if (parent_asset) {

            if (!asset.ownIcon) {
                asset.icon = parent_asset.icon;
            }

            for (const parent_block of parent_asset.blocks) {
                let ind = -1
                if (parent_block.name) ind = asset.blocks.findIndex(b => b.name === parent_block.name)
                else if (ind < 0) ind = asset.blocks.findIndex(b => b.id === parent_block.id);
                if (ind < 0) {
                    asset.blocks.push({
                        ...parent_block,
                        props: {},
                        inherited: { ...parent_block.computed },
                    })
                }
                else {
                    asset.blocks[ind] = {
                        ...asset.blocks[ind],
                        inherited: { ...parent_block.computed },
                    }
                }
            }
        }

        const now = new Date().toISOString();
        const existing_blocks: ProjectFileDbAssetBlock[] = [];
        for (const block of asset.blocks) {
            if (block.delete) {
                existing_blocks.push({ ...block });
                continue;
            }
            if ((asset_stale || !this._blockIsComputed(block, current.computedAt, parent_change_at)) && this._blockNeedsResolve(block, blocks_to_resolve)) {
                existing_blocks.push({
                    ...block,
                    computed: formBlockComputed(block.props ?? {}, block.inherited),
                    computedAt: now,
                });
            }
            else {
                existing_blocks.push({ ...block });
            }
        }
        asset.blocks = existing_blocks;

        if (asset_stale) {
            asset.computedAt = now;
        }
        this.assets.replace(asset);
        return this._cloneFullAsset(asset);
    }

    private _blockNeedsResolve(block: ProjectFileDbAssetBlock, blocks_to_resolve: AssetBlockIdWithName[] | null): boolean {
        if (blocks_to_resolve === null) return true;
        return blocks_to_resolve.some(ref => {
            if (ref.blockId && ref.blockId === block.id) return true;
            if (ref.blockName && ref.blockName === block.name) return true;
            return false;
        });
    }

    public rebuildTypeStructure(): void {
        this._rebuildTypeChildrenMap();
        for (const asset of this.assets.iterate()) {
            this._recalcTypeIdAsset(asset.id);
        }
    }

    public onAssetCollectionUpdated(oldEntry: ProjectFileDbAsset | null, newEntry: ProjectFileDbAsset | null): void {
        if (!newEntry) return;
        const old_parent_id = oldEntry?.parentIds && oldEntry.parentIds.length > 0 ? oldEntry.parentIds[0] : null;
        const new_parent_id = newEntry.parentIds && newEntry.parentIds.length > 0 ? newEntry.parentIds[0] : null;
        if (old_parent_id && old_parent_id !== new_parent_id) {
            this._removeChildFromParentList(old_parent_id, newEntry.id);
        }
        if (new_parent_id && this.assets.byId.has(new_parent_id)) {
            this._addChildToParentList(new_parent_id, newEntry.id);
        }
        this._recalcTypeIdAsset(newEntry.id);
        if (old_parent_id !== new_parent_id) {
            this._recalcTypeIdSubtree(newEntry.id);
        }
    }

    private _rebuildTypeChildrenMap(): void {
        this._typeChildren = new Map<string, Set<string>>();
        for (const asset of this.assets.iterate()) {
            const parent_id = asset.parentIds && asset.parentIds.length > 0 ? asset.parentIds[0] : null;
            if (parent_id && this.assets.byId.has(parent_id)) {
                this._addChildToParentList(parent_id, asset.id);
            }
        }
    }

    private _addChildToParentList(parent_id: string, child_id: string): void {
        let children = this._typeChildren.get(parent_id);
        if (!children) {
            children = new Set<string>();
            this._typeChildren.set(parent_id, children);
        }
        children.add(child_id);
    }

    private _removeChildFromParentList(parent_id: string, child_id: string): void {
        const children = this._typeChildren.get(parent_id);
        if (children) {
            children.delete(child_id);
            if (children.size === 0) this._typeChildren.delete(parent_id);
        }
    }

    private _recalcTypeIdAsset(asset_id: string): void {
        const asset = this.assets.byId.get(asset_id);
        if (!asset) return;
        const chain: string[] = [];
        let cursor: ProjectFileDbAsset | null = asset;
        const visited = new Set<string>();
        while (cursor) {
            if (visited.has(cursor.id)) break;
            visited.add(cursor.id);
            const parent_id: string | null = cursor.parentIds && cursor.parentIds.length > 0 ? cursor.parentIds[0] : null;
            const parent: ProjectFileDbAsset | null = parent_id ? (this.assets.byId.get(parent_id) ?? null) : null;
            if (!parent) break;
            chain.unshift(parent.id);
            cursor = parent;
        }
        if (asset.typeIds.length !== chain.length || asset.typeIds.some((id, i) => id !== chain[i])) {
            // Type-chain membership changed — clear the cache marker so the
            // asset (and its subtree) is recomputed on next read.
            delete (asset as any).computedAt;
            asset.typeIds = chain;
        }
    }

    private _recalcTypeIdSubtree(asset_id: string, visited: Set<string> = new Set<string>()): void {
        if (visited.has(asset_id)) return;
        visited.add(asset_id);
        if (!this.assets.byId.has(asset_id)) return;
        this._recalcTypeIdAsset(asset_id);
        const children = this._typeChildren.get(asset_id);
        if (children) {
            for (const child_id of [...children]) {
                this._recalcTypeIdSubtree(child_id, visited);
            }
        }
    }

    async getAssetFulls(query: ApiRequestList<AssetQueryWhere>): Promise<{
        list: ProjectFileDbAsset[],
        total: number
    }> {
        let list = await this.searchAssets(query.where ? query.where : {})
        list = await this._sortAssets(list, query.order ?? ['index', 'title', 'name', 'createdAt', 'id']);
        const total = list.length;
        if (query.count || query.offset) {
            list = list.slice(query.offset ?? 0, query.count);
        }
        const actual_list = [];
        for (let asset of list) {
            const actual_asset = await this.getAssetFullById(asset.id);
            assert(actual_asset);
            actual_list.push(actual_asset);
        }
        return {
            list: actual_list,
            total
        }
    }

    async assetsGetFull(query: ApiRequestList<AssetQueryWhere>): Promise<AssetsFullResult> {
        const { list, total } = await this.getAssetFulls(query);
        const workspaces = await this.db.workspace.loadAssetWorkspacesTree(list.map(item => (item as any).workspaceId));
        const asset_ids = list.map(asset => asset.id);
        const type_ids_set = new Set<string>();
        list.forEach(asset => asset.typeIds.forEach(id => type_ids_set.add(id)));
        const asset_shorts = await this.assetsGetShort({
            where: {
                id: [...type_ids_set],
            }
        });
        return {
            ids: asset_ids,
            objects: {
                assetFulls: Object.fromEntries([...list.entries()].map(([, asset]) => {
                    const new_blocks: AssetBlockEntity[] = [];
                    for (const block of asset.blocks) {
                        if (block.delete) continue;
                        const { computedAt: _computedAt, delete: _block_delete, ...block_fields } = block;
                        new_blocks.push({
                            ...block_fields,
                            rights: 5,
                        })
                    }

                    const changed_asset = { ...asset };
                    delete (changed_asset as any)['values'];

                    changed_asset.hasImage = applyAssetSelectionFunc(
                        readFieldDescriptorValue(asset, HAS_IMAGE_FIELD.descriptor),
                        HAS_IMAGE_FIELD,
                    ) as boolean;
                    return [changed_asset.id, {
                        ...changed_asset,
                        lastViewedAt: undefined,
                        updatedAt: undefined,
                        createdAt: undefined,
                        creatorUserId: null,
                        deletedAt: null,
                        blocks: new_blocks,
                        comments: [],
                        unread: 0,
                    }]
                })) as any,
                assetShorts: Object.fromEntries(asset_shorts.list.map(((asset_short) => {
                    return [asset_short.id, {
                        ...asset_short,
                    }]
                }))),
                workspaces: Object.fromEntries([...workspaces.entries()].map(([id, workspace]) => {
                    const props = assignPlainValueToAssetProps({}, workspace.props)
                    return [id, {
                        ...workspace,
                        unread: 0,
                        props: props
                    }] as any
                })),
                users: {},
            },
            total: total,
        };
    }

    async getAssetLocalPath(asset_id: string) {
        return getAssetLocalPathById(asset_id, this.db);
    }

    /**
     * Single implementation of asset selection, covering plain rows, grouped
     * rows and aggregates. The result is bucketed three ways, and the mode is
     * unambiguous because validateAggregateSelection rejects everything else:
     *  - select is fully aggregate and there is no group -> one bucket holding
     *    every asset, because SQL still returns a single row for an empty set
     *  - group is given -> one bucket per distinct group key
     *  - otherwise -> implicit identity grouping, one bucket per asset
     */
    private async _getAssetViewRows(query: AssetPropsSelection): Promise<{
        list: AssetPropsPlainObject[],
        total: number
    }> {
        const group = resolveSelectionFields(query.group ?? []);
        const select = resolveSelectionFields(query.select ?? []);
        // ASSET_BASE_ORDERING is the desktop's long-standing default for
        // ungrouped queries. It cannot be applied to grouped ones, where every
        // non-aggregate order field has to be a group key.
        const order = resolveOrderItems(
            query.order ?? (group.length > 0 ? [] : ASSET_BASE_ORDERING),
        );
        validateAggregateSelection(group, select, order);

        const matched = await this.searchAssets(query.where ? query.where : {});
        const prepared = await this._resolveAssetsBlocks(
            matched,
            getSelectionFieldsBlocks([...group, ...select, ...order]),
        );

        type AssetGroup = {
            groupValues: AssetPropsPlainObjectValue[],
            assets: ProjectFileDbAsset[],
        };

        const buckets: AssetGroup[] = [];
        if (group.length === 0 && selectionIsFullyAggregate(select)) {
            buckets.push({ groupValues: [], assets: prepared });
        }
        else if (group.length === 0) {
            for (const asset of prepared) {
                buckets.push({ groupValues: [], assets: [asset] });
            }
        }
        else {
            const group_key_part = (value: AssetPropsPlainObjectValue): string =>  {
                if (value === null || value === undefined) return ' null';
                const type = getAssetPropType(value as AssetPropValue);
                if (type === undefined) {
                    // plain object / array: stable stringify so equal groups collide
                    return JSON.stringify(value, (_key, val) =>
                        val && typeof val === 'object' && !Array.isArray(val)
                            ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1)))
                            : val,
                    );
                }
                return `${type}:${castAssetPropValueToString(value as AssetPropValue)}`;
            }

            const group_key = (values: AssetPropsPlainObjectValue[]): string  => {
                return JSON.stringify(values.map(value => group_key_part(value)));
            }
            
            const groups_by_key = new Map<string, AssetGroup>();
            for (const asset of prepared) {
                const group_values = group.map(field => readFieldDescriptorValue(asset, field.descriptor));
                const key = group_key(group_values);
                const found = groups_by_key.get(key);
                if (found) {
                    found.assets.push(asset);
                }
                else {
                    groups_by_key.set(key, { groupValues: group_values, assets: [asset] });
                }
            }
            buckets.push(...groups_by_key.values());
        }

        const group_field_index = (field: ResolvedSelectionField) =>
            group.findIndex(group_field => group_field.prop === field.prop);

        const value_for = (asset_group: AssetGroup, field: ResolvedSelectionField): AssetPropsPlainObjectValue => {
            const index = group_field_index(field);
            if (!isAggregateAssetSelectionFunc(field.func) && index >= 0) {
                return applyAssetSelectionFunc(asset_group.groupValues[index], field);
            }
            return computeSelectionFieldValue(
                asset_group.assets.map(asset => readFieldDescriptorValue(asset, field.descriptor)),
                field,
            );
        };

        const ordered = sortByOrder(
            buckets,
            order,
            (asset_group, field) => value_for(asset_group, field) as AssetPropValue,
        );

        let page = ordered;
        if (query.count || query.offset) {
            page = page.slice(query.offset ?? 0, query.count);
        }

        return {
            list: page.map(asset_group => {
                const view: AssetPropsPlainObject = {};
                for (const field of select) {
                    view[field.as] = value_for(asset_group, field);
                }
                return view;
            }),
            total: buckets.length,
        };
    }

    async assetsGetView<T extends AssetProps>(
        query: AssetPropsSelection,
        options?: { folded: false },
    ): Promise<ApiResultListWithTotal<T>>;
    async assetsGetView<T extends AssetPropsPlainObject>(
        query: AssetPropsSelection,
        options: { folded: true } | { folded: boolean },
    ): Promise<ApiResultListWithTotal<T>>;
    async assetsGetView<T extends AssetPropsPlainObject>(
        query: AssetPropsSelection,
        options?: { folded: boolean },
    ): Promise<ApiResultListWithTotal<T>> {
        const { list, total } = await this._getAssetViewRows(query);
        return {
            list: list.map(view =>
                options?.folded
                    ? view as T
                    : assignPlainValueToAssetProps({}, view) as T,
            ),
            total,
        }
    }

    private _checkLinksInAssetBlockProps(asset: ProjectFileDbAsset): AssetsGraphItem[] {
        const list: AssetsGraphItem[] = [];
        for (const asset_block of asset.blocks) {
            const props: AssetProps = asset_block.props;
            for (const link of extractAssetLinksFromProps(props)) {
                if ('mention' in link) continue;
                list.push({
                    source: asset.id,
                    target: link.targetAssetId,
                    type: link.type,
                });
            }
        }
        return list;
    }

    async assetsGraph(query: ApiRequestList<AssetQueryWhere>): Promise<AssetsGraph> {
        // в list только сами связи
        // смотрю, те файлы, на которые ссылается текущий ассет, и те, к-ые ссылаются на первый 
        // смотрю только parentIds для inherited
        // рассматриваю только mention и inherited
        // target - от кого наследуется. От кого идет стрелка
        const assets = await this.getAssetFulls(query);
        let list: AssetsGraphItem[] = [];
        for (const graph_asset of assets.list) {
            //input links and parents
            for (const parent_id of graph_asset.parentIds) {
                const graph_item: AssetsGraphItem = {
                    source: graph_asset.id,
                    target: parent_id,
                    type: 'inherit'
                }
                list.push(graph_item);
            }
            list = [...list, ...this._checkLinksInAssetBlockProps(graph_asset)]
            // output links and children
            for (const asset of this.db.asset.assets.iterate()) {
                for (const parent_id of asset.parentIds) {
                    if (parent_id === graph_asset.id) {
                        const graph_item: AssetsGraphItem = {
                            source: asset.id,
                            target: graph_asset.id,
                            type: 'inherit'
                        }
                        list.push(graph_item);
                    }
                }
                const links = this._checkLinksInAssetBlockProps(asset).filter(item => item.target === graph_asset.id).map(item => {
                    return {
                        source: item.target,
                        target: item.source,
                        type: item.type
                    }
                });
                list = [...list, ...links];
            }
        }
        const graph_assets_ids_set = new Set<string>();
        list.forEach(item => {
            graph_assets_ids_set.add(item.source)
            graph_assets_ids_set.add(item.target)
        });
        const graph_assets = await this.assetsGetShort({
            where: {
                id: [...graph_assets_ids_set]
            }
        })
        const graph_assets_obj: { [key: string]: AssetShort } = {}
        graph_assets.list.forEach(asset => graph_assets_obj[asset.id] = { ...asset })
        return {
            list,
            more: false,
            objects: {
                assets: {
                    ...graph_assets_obj,
                }
            }
        }
    }

    private _mergeBlocksToSave(
        old_blocks: ProjectFileDbAssetBlock[],
        new_blocks: {
            [blockKey: string]: AssetBlockParamsDTO;
        },
        undo?: AssetSetDTO
    ): ProjectFileDbAssetBlock[] {
        return mergeBlocksToSave(old_blocks as any, new_blocks, undo) as ProjectFileDbAssetBlock[];
    }

    private _augmentMergeOldBlocks(
        stored_blocks: ProjectFileDbAssetBlock[],
        full_blocks: ProjectFileDbAssetBlock[] | null | undefined,
        new_blocks: {
            [blockKey: string]: AssetBlockParamsDTO;
        },
    ): ProjectFileDbAssetBlock[] {
        if (!full_blocks) return [...stored_blocks];
        const merge_old_blocks = [...stored_blocks];
        for (const block_key of Object.keys(new_blocks)) {
            const { blockId, blockName } = parseAssetNewBlockRef(block_key);
            const found = merge_old_blocks.some(block => {
                if (blockId) return block.id === blockId;
                if (blockName) return block.name === blockName;
                return false;
            });
            if (found) continue;
            const inherited_block = full_blocks.find(block => {
                if (blockId) return block.id === blockId;
                if (blockName) return block.name === blockName;
                return false;
            });
            if (inherited_block) {
                merge_old_blocks.push({ ...inherited_block });
            }
        }
        return merge_old_blocks;
    }

    async assetsCreate(params: AssetServiceAssetCreateDTO): Promise<AssetsChangeResult> {
        const change = await this.assetsChangeBatch({
            ops: [
                {
                    create: params.id || params.localName ? { id: params.id, localName: params.localName } : true,
                    set: params.set ?? {}
                }
            ]
        })
        return {
            ids: change.ids,
            objects: change.objects,
            total: change.total,
            changeId: change.changeId,
            touchedWIds: change.touchedWIds
        }
    }

    private async _assetsCreateImpl(tx: ProjectFileDbTransaction, changeRecord: HistoryChangeRecord, params: AssetServiceAssetCreateDTO, options?: { pid?: string; }): Promise<{
        id: string
    }> {
        let parent_props: ProjectFileDbAssetBlock[] = [];
        let type_ids: string[] = [];

        let asset_id = params.id ?? uuidv4();
        const system_asset = this.systemAssets.byId.get(asset_id);
        let asset_name = null;
        let asset_title = null;
        let asset_icon = null;
        let asset_is_abstract = false;
        let asset_index = null;
        let asset_parent_ids: string[] = [];
        if (system_asset) {
            parent_props = [...system_asset.blocks];
            asset_name = system_asset.name;
            asset_title = system_asset.title;
            asset_icon = system_asset.icon;
            asset_is_abstract = system_asset.isAbstract;
            asset_index = system_asset.index
            asset_parent_ids = [...system_asset.parentIds];
            type_ids = [...system_asset.typeIds];
        }
        else {
            if (params.set?.parentIds && params.set?.parentIds.length > 0) {
                if (params.set?.parentIds.length > 1) {
                    throw new Error("Need be 1 parent");
                }
                const parent_asset = this.assets.byId.get(params.set?.parentIds[0])
                if (!parent_asset) {
                    throw new Error("Parent with this id is not found");
                }
                for (const block of parent_asset.blocks) {
                    parent_props.push({
                        ...block,
                        inherited: { ...block.computed },
                        computed: { ...block.props },
                        props: {},
                    })
                }
                if (parent_asset.typeIds) {
                    type_ids = [...parent_asset.typeIds];
                }
                type_ids.unshift(parent_asset.id);
            }
        }

        const asset_full: ProjectFileDbAsset = {
            id: asset_id,
            projectId: this.db.project.db.info.id ?? '',
            workspaceId: params.set?.workspaceId ?? null,
            name: params.set?.name ?? asset_name,
            title: params.set?.title ?? asset_title,
            icon: params.set?.icon ?? asset_icon,
            isAbstract: params.set?.isAbstract ?? asset_is_abstract,
            typeIds: type_ids,
            createdAt: (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
            deletedAt: params.set?.delete ? (new Date()).toISOString() : null,
            rights: AssetRights.FULL_ACCESS,
            index: params.set?.index ?? asset_index,
            creatorUserId: params.set?.creatorUserId ?? null,
            unread: 0,
            hasImage: false,
            parentIds: params.set?.parentIds ?? asset_parent_ids,
            ownTitle: params.set?.title ?? asset_title,
            ownIcon: params.set?.icon ?? asset_icon,
            blocks: params.set?.blocks ? this._mergeBlocksToSave(parent_props, params.set.blocks) : parent_props,
            comments: [],
            references: [],
            lastViewedAt: null,
            localName: params.localName,
        };
        if (!params.id && this.isMarkdownAsset(asset_full)) {
            // Markdown files carry no embeddable id, so their id is derived from the
            // save path. Assign it at creation to match what the fs loader computes,
            // otherwise the id would change once the file is re-read from disk.
            const parent_workspace_path = asset_full.workspaceId
                ? getWorkspaceLocalPathFolderById(asset_full.workspaceId, this.db)
                : this.db.localPath;
            const suggested_name = await this.getAssetFileSavingFilename(
                asset_full,
                (name) => !fs.existsSync(node_path.join(parent_workspace_path, name)),
            );
            asset_id = absolutePathToUuid(node_path.join(parent_workspace_path, suggested_name), this.db.localPath);
            asset_full.id = asset_id;
        }
        tx.changeAsset(null, asset_full)
        changeRecord.addChange(asset_id, {
            delete: true
        })
        return {
            id: asset_id
        }
    }

    private _formComputedAsset(asset_full: ProjectFileDbAsset): ProjectFileDbAsset {
        const now = new Date().toISOString();
        return {
            ...asset_full,
            blocks: asset_full.blocks.map(block => {
                return {
                    ...block,
                    computed: formBlockComputed(block.props ?? {}, block.inherited),
                    computedAt: now,
                };
            })
        };
    }

    isMarkdownAsset(asset_full: ProjectFileDbAsset) {
        const formed_asset = this._formComputedAsset(asset_full);
        return formed_asset.blocks?.some(
            (block) => block.name === BLOCK_NAME_META && (block.computed as any)?.format === 'md',
        ) ?? false;
    }

    async saveAssetFile(asset_full: ProjectFileDbAsset) {
        assert(asset_full.localName)
        const formed_asset = this._formComputedAsset(asset_full);
        let local_path = getAssetLocalPath(asset_full, this.db);
        const format = await this.db.settings.getKey<AssetSaveFormat>(ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT);
        const is_md_file = this.isMarkdownAsset(formed_asset);
        if (is_md_file && getImsExtname(asset_full.localName) === ASSET_EXT) {
            const new_name = await this.getAssetFileSavingFilename(
                formed_asset,
                (val) => !fs.existsSync(node_path.join(node_path.dirname(local_path), val)),
            );
            const new_local_path = node_path.join(node_path.dirname(local_path), new_name);
            await this.db.fileSystem.expectFsChange([local_path, new_local_path], async () => {
                try {
                    await fse.move(local_path, new_local_path);
                }
                catch (err: any) {
                    if (err.code !== 'ENOENT') throw err;
                }
            });
            asset_full.localName = new_name;
            local_path = new_local_path;
        }
        else if (!is_md_file) {
            // Migrate between .ima.json and .json when format setting differs from current extension
            const current_ext = getImsExtname(asset_full.localName);
            const desired_ext = format === 'json' ? '.json' : '.ima.json';
            if (current_ext !== desired_ext) {
                const new_name = await this.getAssetFileSavingFilename(
                    formed_asset,
                    (val) => !fs.existsSync(node_path.join(node_path.dirname(local_path), val)),
                );
                const new_local_path = node_path.join(node_path.dirname(local_path), new_name);
                await this.db.fileSystem.expectFsChange([local_path, new_local_path], async () => {
                    try {
                        await fse.move(local_path, new_local_path);
                    }
                    catch (err: any) {
                        if (err.code !== 'ENOENT') throw err;
                    }
                });
                asset_full.localName = new_name;
                local_path = new_local_path;
            }
        }
        await this.saveAssetFileToFile(formed_asset, local_path, format);
    }

    async saveAssetFileToFile(asset_full: ProjectFileDbAsset, file_path: string, format?: AssetSaveFormat) {
        await this.db.fileSystem.expectFsChange([file_path], async () => {
            const writableStream = fs.createWriteStream(file_path);
            await this.saveAssetFileToStream(asset_full, writableStream, format);
            writableStream.end();
            await once(writableStream, 'finish');
            await new Promise<void>((resolve, reject) => writableStream.close((err) => {
                if (err) reject(err)
                else resolve();
            }));
        })
    }

    async saveAssetFileToStream(asset_full: ProjectFileDbAsset, target: Writable, format?: AssetSaveFormat) {
        const formed_asset = this._formComputedAsset(asset_full);
        if (this.isMarkdownAsset(formed_asset)) {
            const md_block = formed_asset.blocks.find(block => block.type === 'markdown');
            const content = (md_block ? (md_block.computed.value ?? '') : '').toString();
            const { frontmatter, content: stripped } = this._buildMarkdownFrontmatter(formed_asset, content);
            target.write(frontmatter ? frontmatter + stripped : stripped)
            return;
        }

        const actual_format = format ?? await this.db.settings.getKey<AssetSaveFormat>(ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT);
        if (actual_format === 'json') {
            const new_json = serializeAssetToNewFormatJSON(formed_asset as any);
            target.write(JSON.stringify(new_json, null, 1))
        } else {
            const ima_asset = serializeAssetToJSON(formed_asset as any);
            target.write(JSON.stringify(ima_asset, null, 1))
        }
    }

    private _buildMarkdownFrontmatter(asset: ProjectFileDbAsset, content: string): { frontmatter: string | null; content: string } {
        const meta_block = asset.blocks?.find((block) => block.name === BLOCK_NAME_META);
        const plain_props = meta_block
            ? convertAssetPropsToPlainObject(meta_block.props ?? {})
            : {};
        const { format: _format, ...values } = plain_props;
        const meta: MarkdownFrontmatterMeta = {};
        const path_derived_id = absolutePathToUuid(getAssetLocalPath(asset, this.db), this.db.localPath);
        if (asset.id !== path_derived_id) meta.id = asset.id;
        if (asset.name) meta.name = asset.name;
        if (asset.ownIcon && asset.ownIcon !== MARKDOWN_DEFAULT_ICON) meta.icon = asset.ownIcon;
        if (Object.keys(values).length > 0) meta.values = values as Record<string, unknown>;
        return buildMarkdownFrontmatter(meta, content);
    }

    async getAssetFileSavingFilename(asset_full: ProjectFileDbAsset, check_avail: (val: string) => boolean) {
        if (this.isMarkdownAsset(asset_full)) {
            return suggestUniqueFilename(asset_full.title, '.md', check_avail);
        }
        const format = await this.db.settings.getKey<AssetSaveFormat>(ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT);
        const ext = format === 'json' ? '.json' : '.ima.json';
        return suggestUniqueFilename(asset_full.title, ext, check_avail);
    }

    async assetsChange(params: AssetChangeDTO, options?: { pid?: string }): Promise<AssetsChangeResult> {
        const change = await this.assetsChangeBatch({
            ops: [
                {
                    set: params.set ?? {},
                    where: params.where
                }
            ]
        }, options)
        return {
            ids: change.ids,
            objects: change.objects,
            total: change.total,
            changeId: change.changeId,
            touchedWIds: change.touchedWIds
        }
    }

    private async _assetsChangeImpl(tx: ProjectFileDbTransaction, changeRecord: HistoryChangeRecord, params: AssetChangeDTO, options?: { pid?: string; }): Promise<{
        ids: string[]
    }> {
        const assets_from_db = await this.searchAssets(params.where);
        const changing_assets_ids = assets_from_db.map(asset => asset.id);
        if (assets_from_db.length > 0) {
            const changing_assets = [...assets_from_db];
            for (let changing_asset of changing_assets) {
                let was_changed = false;
                const undo: AssetSetDTO = {};
                for (const [prop, val] of Object.entries(params.set) as [keyof AssetSetDTO, any][]) {
                    switch (prop) {
                        case 'blocks':
                        case 'delete':
                        case 'restore':
                            continue;
                        default:
                            if ((changing_asset)[prop] !== val) {
                                undo[prop] = (changing_asset)[prop] as any;
                                was_changed = true;
                            }
                    }
                }

                let merge_old_blocks = changing_asset.blocks
                if (params.set.blocks){
                    const full_asset = await this.getAssetFullById(changing_asset.id) 
                    const aug_old_blocks = this._augmentMergeOldBlocks(changing_asset.blocks, full_asset?.blocks, params.set.blocks);
                    merge_old_blocks = this._mergeBlocksToSave(aug_old_blocks, params.set.blocks, undo)
                    was_changed = true;
                }
                
                const new_asset: ProjectFileDbAsset = {
                    ...changing_asset,
                    ...params.set,
                    blocks: merge_old_blocks
                };
                if (params.set.icon !== undefined) {
                    new_asset.ownIcon = params.set.icon;
                }
                if (was_changed) {
                    new_asset.updatedAt = (new Date()).toISOString();
                }

                tx.changeAsset(changing_asset, new_asset);
                changeRecord.addChange(changing_asset.id, undo)
            }
        }
        return {
            ids: changing_assets_ids
        };
    }
    async assetsChangeUndo(params: { changeId: string; }, options?: { pid?: string }): Promise<AssetsChangeResult> {
        const changes = this._sessionChangeHistory.get(params.changeId);
        return this.assetsChangeBatch({
            ops: changes ? changes.changes.map(change => {
                return {
                    where: {
                        id: change.assetId
                    },
                    set: change.undo
                }
            }, options) : []
        })
    }

    async assetsChangeBatch(params: { ops: AssetServiceAssetChangeBatchOpDTO[]; }, options?: { pid?: string; }): Promise<AssetsBatchChangeResultDTO> {
        const changeRecord = new HistoryChangeRecord();
        const createdIds = new Set<string>()
        const updatedIds = new Set<string>()
        const deletedIds = new Set<string>()
        const tx = new ProjectFileDbTransaction(this.db)

        for (const op of params.ops) {
            if (op.create) {
                const res = await this._assetsCreateImpl(tx, changeRecord, {
                    id: (typeof op.create === 'object' ? op.create.id : undefined) ?? undefined,
                    localName: (typeof op.create === 'object' ? op.create.localName : undefined) ?? undefined,
                    set: op.set
                }, options)
                createdIds.add(res.id)
            }
            else if (op.set.delete) {
                assert(op.where, "Where is required for delete actions")
                const res = await this._assetsDeleteImpl(tx, changeRecord, op.where, options)
                for (const id of res.ids) {
                    deletedIds.add(id)
                }
            }
            else if (op.set.restore) {
                assert(op.where, "Where is required for restore actions")
                const res = await this._assetsRestoreImpl(tx, changeRecord, op.where, options)
                for (const id of res.ids) {
                    createdIds.add(id)
                }
            }
            else {
                assert(op.where, "Where is required for update actions")
                const res = await this._assetsChangeImpl(tx, changeRecord, {
                    set: op.set,
                    where: op.where
                }, options)
                for (const id of res.ids) {
                    updatedIds.add(id)
                }

            }
        }

        await tx.commit()
        const updatedOrCreated = await this.assetsGetFull({
            where: {
                id: [...createdIds, ...updatedIds],
            }
        })

        this._sessionChangeHistory.set(changeRecord.changeId, changeRecord)

        return {
            ...updatedOrCreated,
            changeId: changeRecord.changeId,
            createdIds: [...createdIds],
            deletedIds: [...deletedIds],
            updatedIds: [...updatedIds],
            touchedWIds: tx.touchedWIds
        };
    }
    async assetsDelete(where: AssetWhereParams, options?: { pid?: string; }): Promise<AssetDeleteResultDTO> {
        const change = await this.assetsChangeBatch({
            ops: [
                {
                    set: {
                        delete: true
                    },
                    where: where
                }
            ]
        }, options)
        return {
            ids: change.deletedIds,
            changeId: change.changeId,
            touchedWIds: change.touchedWIds
        }
    }

    public deleteOwnAssetFromCollectionOnly(asset_id: string): void {
        const old_entry = this.assets.byId.get(asset_id);
        if (old_entry) {
            const old_parent_id = old_entry.parentIds && old_entry.parentIds.length > 0 ? old_entry.parentIds[0] : null;
            if (old_parent_id) {
                this._removeChildFromParentList(old_parent_id, asset_id);
            }
        }
        this.assets.delete(asset_id)
        const system_asset = this.systemAssets.byId.get(asset_id);
        if (system_asset) {
            this.assets.add({ ...system_asset });
            this.onAssetCollectionUpdated(null, this.assets.byId.get(asset_id) ?? null);
        }
    }

    private async _assetsDeleteImpl(tx: ProjectFileDbTransaction, changeRecord: HistoryChangeRecord, where: AssetWhereParams, options?: { pid?: string; }): Promise<{
        ids: string[],
    }> {
        const deleting_assets = await this.searchAssets({
            ...where,
            isSystem: false
        });
        if (deleting_assets.length > 0) {
            for (const asset of deleting_assets) {
                tx.changeAsset(asset, null);
                changeRecord.addChange(asset.id, {
                    restore: true
                })
            }
        }
        this._sessionDeletedAssets.addMany(deleting_assets)
        const deleting_asset_ids = deleting_assets.map(a => a.id)

        return {
            ids: deleting_asset_ids,
        }
    }
    async assetsRestore(where: AssetWhereParams, options?: { pid?: string; }): Promise<AssetsChangeResult> {
        const change = await this.assetsChangeBatch({
            ops: [
                {
                    set: {
                        restore: true
                    },
                    where: where
                }
            ]
        }, options)
        return {
            ids: change.ids,
            objects: change.objects,
            total: change.total,
            changeId: change.changeId,
            touchedWIds: change.touchedWIds
        }
    }

    private async _assetsRestoreImpl(tx: ProjectFileDbTransaction, changeRecord: HistoryChangeRecord, where: AssetWhereParams, options?: { pid?: string; }): Promise<{
        ids: string[],
    }> {
        const filter = await AssetSearchFilter.Create(where, this.db);
        const result = await filter.apply(this._sessionDeletedAssets.iterate());
        const restoring_assets = result;
        for (const asset_full of restoring_assets) {
            this._sessionDeletedAssets.delete(asset_full.id);
            tx.changeAsset(null, asset_full);
            changeRecord.addChange(asset_full.id, {
                delete: true
            })
        }
        return {
            ids: restoring_assets.map(a => a.id),
        }
    }
    assetsCreateRef(params: CreateRefDTO): Promise<AssetReferencesResult> {
        throw new Error("Method not implemented.");
    }
    assetsDeleteRef(params: CreateRefDTO): Promise<AssetDeleteRefResultDTO> {
        throw new Error("Method not implemented.");
    }
    async assetsMove(params: AssetMoveParams): Promise<AssetMoveResult> {
        const avail_assets = await this.assetsGetShort({
            where: {
                id: params.ids,
                isSystem: false,
            }
        });


        let cur_index: number | null | undefined = undefined;
        let index_step: number = 0;
        const move_result_map = new Map<string, AssetMoveResultItem>();
        if (params.indexFrom !== undefined || params.indexTo !== undefined) {
            if (params.indexTo === null) {
                cur_index = params.indexFrom ?? null;
                index_step = 1;
            }
            else if (params.indexFrom === null) {
                cur_index = params.indexTo !== undefined ? params.indexTo - avail_assets.list.length : null
                index_step = 1;
            }
            else {
                const start_and_step = getIndexRangeStartAndStep(
                    params.indexFrom, params.indexTo, avail_assets.list.length
                )
                cur_index = start_and_step.start;
                index_step = start_and_step.step;
            }
        }
        const ops: AssetChangeBatchOpDTO[] = [];

        const avail_assets_map = new Map(avail_assets.list.map(item => {
            return [item.id, { ...item }]
        }));
        for (const asset_id of params.ids) {
            const avail_asset = avail_assets_map.get(asset_id)
            if (avail_asset) {
                const set: AssetSetDTO = {}
                const avail_asset_result: AssetMoveResultItem = {
                    id: avail_asset.id,
                    index: avail_asset.index,
                    workspaceId: avail_asset.workspaceId
                }
                if (cur_index !== undefined) {
                    avail_asset_result.index = cur_index;
                    set.index = cur_index;
                }
                if (params.workspaceId !== undefined && avail_asset.workspaceId !== params.workspaceId) {
                    avail_asset_result.workspaceId = params.workspaceId;
                    set.workspaceId = params.workspaceId;
                }
                ops.push({
                    set,
                    where: {
                        id: asset_id,
                    }
                })
                if (cur_index !== null && cur_index !== undefined) {
                    cur_index += index_step;
                }
            }
        }
        const res = await this.assetsChangeBatch({
            ops
        })
        return {
            changeId: res.changeId,
            list: res.updatedIds.map(id => {
                const avail_asset_result = move_result_map.get(id);
                return {
                    id,
                    index: avail_asset_result?.index ?? null,
                    workspaceId: avail_asset_result?.workspaceId ?? null
                }
            }),
            touchedWIds: res.touchedWIds
        }
    }
    assetsGetHistory(assetId: string): Promise<ApiResultListWithMore<AssetHistoryDTO>> {
        throw new Error("Method not implemented.");
    }

    async exportToFile(assetId: string, target: string) {
        const assets = await this.getAssetFulls({
            where: {
                id: assetId
            }
        })
        if (assets.list.length === 0) {
            throw new Error('Asset not found')
        }
        await this.saveAssetFileToFile(assets.list[0], target);
    }
    findByLocalPath(localPath: string): ProjectFileDbAsset | null {
        const dirpath = node_path.dirname(localPath);
        const local_name = node_path.basename(localPath);
        const workspace = this.db.workspace.findByLocalDirPath(dirpath);
        if (!workspace) return null;

        const found = this.assets.iterate().find(x => x.localName === local_name && x.workspaceId === workspace.id);
        return found ?? null;
    }


}