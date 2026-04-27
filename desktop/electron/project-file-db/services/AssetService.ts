/* eslint-disable @typescript-eslint/no-unused-vars */
import { getFieldDescriptor } from "../asset-fields";
import { type ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbAssetBlock } from "../ProjectFileDb";
import { ProjectFileDbCollection } from "../ProjectFileDbCollection";
import fs from 'node:fs';
import * as node_path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AssetSearchFilter } from "../logic/AssetSearchFilter";
import { applyImsFileLocationChange, getAssetLocalPath, getAssetLocalPathById, getIndexRangeStartAndStep, getWorkspaceLocalPathById, prepareFileBasenameByEntityTitle } from "../utils/files";
import isUUID from 'validator/es/lib/isUUID';
import { once } from "node:events";
import type { Writable } from "node:stream";
import { HistoryChangeRecord } from "../logic/HistoryChangeRecord";
import { shell, ipcMain } from 'electron';
import { BLOCK_NAME_META } from "~ims-app-base/logic/constants";
import type { AssetHistoryDTO } from "~ims-app-base/logic/types/AssetHistory";
import type { AssetQueryWhere, AssetsShortResult, AssetShort, AssetsFullResult, AssetsGraphItem, AssetsGraph, AssetBlockParamsDTO, AssetSetDTO, AssetCreateDTO, AssetsChangeResult, AssetChangeDTO, AssetChangeBatchOpDTO, AssetsBatchChangeResultDTO, AssetWhereParams, AssetDeleteResultDTO, CreateRefDTO, AssetReferencesResult, AssetDeleteRefResultDTO, AssetMoveParams, AssetMoveResult, AssetFull } from "~ims-app-base/logic/types/AssetsType";
import type { AssetBlockEntity } from "~ims-app-base/logic/types/BlocksType";
import type { IProjectDatabaseAsset, ProjectContentChangeEventArg } from "~ims-app-base/logic/types/IProjectDatabase";
import type { ApiRequestList, ApiResultListWithTotal, ApiResultListWithMore, ChangesStreamRequest, ChangesStreamResponse } from "~ims-app-base/logic/types/ProjectTypes";
import { type AssetPropsPlainObjectValue, type AssetPropsPlainObject, type AssetPropValue, compareAssetPropValues, assignPlainValueToAssetProps, extractRemapParentProps, type AssetProps, remapAssetProps, convertAssetPropsToPlainObject, type AssetPropValueText, walkAssetPropValueTextOps, type AssetPropValueAsset, parseAssetNewBlockRef, applyPropsChange, diffAssetPropObjects, stringifyAssetNewBlockRef, getAssetPropType } from "~ims-app-base/logic/types/Props";
import type { AssetPropsSelectionField, AssetPropsSelectionOrder, AssetPropsSelection } from "~ims-app-base/logic/types/PropsSelection";
import { AssetRights } from "~ims-app-base/logic/types/Rights";
import { generateNextUniqueNameNumber } from "~ims-app-base/logic/utils/stringUtils";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import { ASSET_BASE_ORDERING } from "../project-db-constants";

import { SQLITE_NOW_STM } from "./SyncService/SyncService";
   
export class AssetService implements IProjectDatabaseAsset{


    private _sessionChangeHistory = new Map<string, HistoryChangeRecord>()
    private _sessionDeletedAssets = new ProjectFileDbCollection<ProjectFileDbAsset>();
    assets = new ProjectFileDbCollection<ProjectFileDbAsset>();
    systemAssets = new ProjectFileDbCollection<ProjectFileDbAsset>();
    
    constructor(public db: ProjectFileDb){

    }

    private _getAssetProp(asset: ProjectFileDbAsset, assetName: string): AssetPropsPlainObjectValue {
        const prop = getFieldDescriptor(assetName);
        if(prop){
            if(prop.get){
                return prop.get(asset);
            }
            else if(prop.jsonName){
                return (asset as any)[prop.jsonName];
            }
        }
        return null;
    }
    
    private _readAssetPropBySelectField(target: AssetPropsPlainObject, asset: ProjectFileDbAsset, prop: AssetPropsSelectionField){
        if(typeof prop === 'string'){
            target[prop] = this._getAssetProp(asset, prop);
        }
        else {
            let val = this._getAssetProp(asset, prop.prop);
            if (prop.func === 'notEmpty'){
                val = !!val;
            }
            target[prop.as ?? prop.prop] = val
        }
    }


    public async searchAssets(where: AssetQueryWhere): Promise<ProjectFileDbAsset[]>{
        if (Object.keys(where).length === 0){
            return [...this.assets.iterate()]
        }

        const filter = await AssetSearchFilter.Create(where, this.db);
        const result = filter.apply(this.assets.iterate());
        return [...result];
    }
    
    public getAssetField(asset: ProjectFileDbAsset, field: string): AssetPropValue{
        return (asset as unknown as Record<string, AssetPropValue>)[field]
    }

    private async _sortAssets(assets: ProjectFileDbAsset[], order: AssetPropsSelectionOrder[]): Promise<ProjectFileDbAsset[]>{
        const order_items = order ? order : ASSET_BASE_ORDERING;
        return assets.sort((a,b) => {
            for(const order_item of order_items){
                let order_field: string;
                let order_desc = false;
                if(typeof order_item === 'object'){
                    order_field = order_item.prop;
                    order_desc = order_item.desc ?? false;
                }
                else {
                    order_field = order_item;
                }
                const a_val = this.getAssetField(a, order_field);
                const b_val = this.getAssetField(b, order_field);
                const res = compareAssetPropValues(a_val, b_val);
                if(res !== 0){
                    return order_desc ? res : -res;
                }
            }
            return 0;
        });
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
                { prop: 'gallery|main\\value', as: 'hasImage', func: 'notEmpty'}
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

    private async _getAssetFullById(asset_id: string): Promise<ProjectFileDbAsset | null> {
        const db_asset = this.assets.byId.get(asset_id);
        if(!db_asset) return null;
        let asset = {...db_asset};

        const parent_id = db_asset.parentIds && db_asset.parentIds.length > 0 ? db_asset.parentIds[0] : null
        const parent_asset = parent_id ? await this._getAssetFullById(parent_id) : null;
        if(parent_asset) {

            asset.typeIds = [parent_asset.id, ...parent_asset.typeIds]

            if(!asset.ownIcon) {
                asset.icon = parent_asset.icon;
            }

            for(const parent_block of parent_asset.blocks){
                let ind = -1
                if (parent_block.name) ind = asset.blocks.findIndex(b => b.name === parent_block.name)
                if (ind < 0) ind = asset.blocks.findIndex(b => b.id === parent_block.id);
                let asset_block;
                if(ind === -1){
                    asset_block = {
                        ...parent_block,
                        props: {},
                        inherited: {...parent_block.computed},
                    }
                }
                else {
                    asset_block = {
                        ...asset.blocks[ind],
                        inherited: {...parent_block.computed},
                    }
                }
                const old_block_props = assignPlainValueToAssetProps({}, asset_block.props ?? {});
                const old_block_inherited = asset_block?.inherited ? assignPlainValueToAssetProps({}, asset_block.inherited ?? {}) : null;
                const {normalProps, remapParentProps} = extractRemapParentProps(old_block_props);
                let computed_props: AssetProps = {};
                if (old_block_inherited) {
                    if (remapParentProps){
                        computed_props = remapAssetProps(old_block_inherited, remapParentProps);
                    }
                    else {
                        computed_props = old_block_inherited;
                    }
                }
                computed_props = { ...computed_props, ...normalProps};
                asset_block.computed = convertAssetPropsToPlainObject(computed_props);
                if(ind === -1){
                    asset.blocks.push(asset_block);
                }
                else {
                    asset.blocks[ind] = asset_block;
                }
            }            
        }
        const existing_blocks: ProjectFileDbAssetBlock[] = [];
        for(const block of asset.blocks){
            if(!block.delete){
                existing_blocks.push({
                    ...block,
                    computed: convertAssetPropsToPlainObject({
                        ...(block.inherited ? assignPlainValueToAssetProps({}, block.inherited) : {}),
                        ...assignPlainValueToAssetProps({}, block.props)
                    })
                });
            }
        }
        asset.blocks = existing_blocks;

        return asset;
    }

    async getAssetFulls(query: ApiRequestList<AssetQueryWhere>): Promise<{
        list: ProjectFileDbAsset[],
        total: number
    }>{
        let list = await this.searchAssets(query.where  ? query.where : {}) 
        list = await this._sortAssets(list, query.order ?? []);
        const total = list.length;
        if(query.count || query.offset){
            list = list.slice(query.offset ?? 0, query.count);
        }
        const actual_list = [];
        for(let asset of list){
            const actual_asset = await this._getAssetFullById(asset.id);
            assert(actual_asset);
            actual_list.push(actual_asset);
        }
        return {
            list: actual_list,
            total
        }
    }

    async assetsGetFull(query: ApiRequestList<AssetQueryWhere>): Promise<AssetsFullResult> {
        const {list, total} = await this.getAssetFulls(query);
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
                    for(const block of asset.blocks){
                        new_blocks.push({
                            ...block,
                            rights: 5,
                            props: assignPlainValueToAssetProps({}, block.props),
                            inherited: block.inherited ? assignPlainValueToAssetProps({}, block.inherited) : null,
                            computed: assignPlainValueToAssetProps({}, block.computed),
                        })
                    }

                    const changed_asset = {...asset};
                    delete (changed_asset as any)['values'];
                    
                    this._readAssetPropBySelectField(changed_asset, asset, { prop: 'gallery|main\\value', as: 'hasImage', func: 'notEmpty'})
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
  
    async getAssetLocalPath(asset_id: string){
        return getAssetLocalPathById(asset_id, this.db);
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
        const {list, total} = await this.getAssetFulls(query);
        const res = {
            list: list.map(asset => {
                const view: AssetPropsPlainObject = {};
                for(const prop of query.select){
                    this._readAssetPropBySelectField(view, asset, prop)
                }
                if (!options?.folded){
                    return assignPlainValueToAssetProps({}, view) as T;
                }
                return view as T;
            }),
            total,
        }
        return res;
    }

    private _checkLinksInAssetBlockProps(asset: ProjectFileDbAsset): AssetsGraphItem[] {
        const list: AssetsGraphItem[] = [];
        for(const asset_block of asset.blocks){
            const props: AssetPropsPlainObject = assignPlainValueToAssetProps({}, asset_block.props);
            for (const [prop, val] of Object.entries(props)) {
                if (!val) continue;

                if ((val as AssetPropValueText).Ops) {
                    for (const op_struct of walkAssetPropValueTextOps(
                        (val as AssetPropValueText).Ops,
                    )) {
                        if (
                            op_struct.attributeAsset &&
                            isUUID(op_struct.attributeAsset.value.AssetId)
                        ) {
                            list.push({
                                source: asset.id,
                                target: op_struct.attributeAsset.value.AssetId,
                                type: 'mention',
                            });
                        }
                        if (
                            op_struct.insertTask &&
                            isUUID(op_struct.insertTask.value.AssetId)
                        ) {
                            list.push({
                                source: asset.id,
                                target: op_struct.insertTask.value.AssetId,
                                type: 'mention',
                            });
                        }
                        if (
                            op_struct.insertProp &&
                            op_struct.insertProp.value &&
                            isUUID((op_struct.insertProp.value as AssetPropValueAsset).AssetId)
                        ) {
                            list.push({
                                source: asset.id,
                                target: (op_struct.insertProp.value as AssetPropValueAsset)
                                .AssetId,
                                type: 'mention',
                            });
                        }
                    }
                } else if ((val as AssetPropValueAsset).AssetId) {
                    if (isUUID((val as AssetPropValueAsset).AssetId)) {
                        list.push({
                            source: asset.id,
                            target: (val as AssetPropValueAsset).AssetId,
                            type: 'mention',
                        });
                    }
                }
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
        for(const graph_asset of assets.list){
            //input links and parents
            for(const parent_id of graph_asset.parentIds){
               const graph_item: AssetsGraphItem = {
                    source: graph_asset.id,
                    target: parent_id,
                    type: 'inherit'
                }
                list.push(graph_item);
            }
            list = [...list, ...this._checkLinksInAssetBlockProps(graph_asset)]
            // output links and children
            for(const asset of this.db.asset.assets.iterate()){
                for(const parent_id of asset.parentIds){
                    if(parent_id === graph_asset.id) {
                        const graph_item: AssetsGraphItem = {
                            source: asset.id,
                            target: graph_asset.id,
                            type: 'inherit'
                        }
                        list.push(graph_item);
                    }
                }
                const links = this._checkLinksInAssetBlockProps(asset).filter(item => item.target === graph_asset.id).map(item => {return {
                    source: item.target,
                    target: item.source,
                    type: item.type
                }});
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
        graph_assets.list.forEach(asset => graph_assets_obj[asset.id] = {...asset})
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
    ): ProjectFileDbAssetBlock[]
    {
        const result: ProjectFileDbAssetBlock[] = [];
        const changed_block_ids = new Set();
        for(const [block_key, new_block] of Object.entries(new_blocks)){
            const { blockId, blockName } = parseAssetNewBlockRef(block_key);
            const old_block = old_blocks.find(block => {
                if(blockId) {
                    return block.id === blockId;
                }
                else if (blockName) {
                    return block.name === blockName;
                }
            });
            let block_undo: AssetBlockParamsDTO | undefined;
            if (undo){
                if (!undo.blocks) undo.blocks = {};
                if (blockId) {
                    undo.blocks[`@${blockId}`] = {};
                    block_undo = undo.blocks[`@${blockId}`]
                }
                else if (blockName){
                    undo.blocks[blockName] = {};
                    block_undo = undo.blocks[blockName]
                }
            }
            const result_block = this._prepareBlockToSave(
                block_key, 
                old_block ? old_block : null, 
                new_block,
                block_undo
            );
            if(result_block){
                result.push(result_block);
                changed_block_ids.add(result_block.id);
            }
            if(old_block) changed_block_ids.add(old_block.id);
        }
        for(const old_block of old_blocks) {
            if(!changed_block_ids.has(old_block.id)){
                result.push(old_block);
            }
        }
        return result.sort((a, b) => {
            return a.index - b.index;
        });
    }

    private _prepareBlockToSave(
        block_key: string,
        old_block: Partial<ProjectFileDbAssetBlock> | null,
        new_block: AssetBlockParamsDTO,
        block_undo?: AssetBlockParamsDTO
    ): ProjectFileDbAssetBlock | null
    {
        const { blockId, blockName } = parseAssetNewBlockRef(block_key);
        if(!(old_block?.type || new_block.type)){
            throw new Error("Type is not set");
        }
        const old_block_props = assignPlainValueToAssetProps({}, old_block?.props ?? {});
        const old_block_inherited = old_block?.inherited ? assignPlainValueToAssetProps({}, old_block.inherited ?? {}) : null;
       
        let result_props = old_block_props;
        let result_props_undo: AssetProps[] | undefined
        if (new_block.props){
            const new_block_props_change = (Array.isArray(new_block.props) ? new_block.props : [new_block.props]);
            const result_props_applied_change = applyPropsChange(old_block_props, old_block_inherited ?? {}, new_block_props_change)
            result_props = result_props_applied_change.props
            result_props_undo = result_props_applied_change.undo;
        }
        
        const {normalProps, remapParentProps} = extractRemapParentProps(result_props);
        let computed_props: AssetProps = {};
        if (old_block_inherited) {
            if (remapParentProps){
                computed_props = remapAssetProps(old_block_inherited, remapParentProps);
            }
            else {
                computed_props = old_block_inherited;
            }
        }
        computed_props = { ...computed_props, ...normalProps};


        const block_entity: ProjectFileDbAssetBlock = {
            id: blockId ?? old_block?.id ?? uuidv4(),
            name: new_block.name ?? old_block?.name ?? blockName,
            index: new_block.index ?? old_block?.index ?? 0,
            type: (new_block.type ?? old_block?.type) as string,
            title: new_block.title ?? old_block?.title ?? null,
            ownTitle: new_block.title ?? old_block?.ownTitle ?? null,
            createdAt: old_block?.createdAt ?? (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
            own: old_block?.own ?? true,
            inherited: old_block_inherited ? convertAssetPropsToPlainObject(old_block_inherited) : null,
            computed: convertAssetPropsToPlainObject(computed_props),
            props: convertAssetPropsToPlainObject(result_props),
        };

        if (block_undo){
            
            if(new_block.delete || new_block.reset){
                if (old_block){
                    block_undo = {                    
                        index: old_block.index,
                        name: old_block.name,
                        title: old_block.title,
                        props: assignPlainValueToAssetProps({}, old_block.props ??{}),
                        type: old_block.type,
                    }
                }
            }
            else {

                if (old_block){                
                    if (block_undo){
                        for (const [prop, val] of Object.entries(new_block) as [keyof AssetBlockParamsDTO, any][]){
                            switch (prop){
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
                }
                else {
                    if (block_undo){
                        block_undo = {
                            delete: true
                        }
                    }
                }
            }
        }

        if(new_block.delete){
            if(old_block?.inherited) {
                block_entity.delete = true;
                block_entity.props = {}
                block_entity.computed = {}
            }
            else return null;
        }
        else if (new_block.reset){
            block_entity.props = {}
            block_entity.computed = {...block_entity.inherited}
        }

        return block_entity;
    }   
    
    async assetsCreate(params: AssetCreateDTO, options?:{ fsProcessed?: true}): Promise<AssetsChangeResult> {
        const change = await this.assetsChangeBatch({
            ops: [
                {
                    create: params.id ? { id: params.id } : true,
                    set: params.set ?? {}
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

    private async _assetsCreateImpl(changeRecord: HistoryChangeRecord, params: AssetCreateDTO, options?: { fsProcessed?: true }): Promise<{
        id: string,
        touchedWIds: string[]
    }> {
        let parent_props: ProjectFileDbAssetBlock[] = [];
        let type_ids: string[] = [];
        const touchedWIds: string[] = [];

        const asset_id = params.id ?? uuidv4();
        const system_asset = this.systemAssets.byId.get(asset_id);
        let asset_name = null;
        let asset_title = null;
        let asset_icon = null;
        let asset_is_abstract = false;
        let asset_index = null;
        let asset_parent_ids: string[] = [];
        if(system_asset){
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
            if(params.set?.parentIds && params.set?.parentIds.length > 0){
                if(params.set?.parentIds.length > 1){
                    throw new Error("Need be 1 parent");
                }
                const parent_asset = this.assets.byId.get(params.set?.parentIds[0])
                if(!parent_asset){
                    throw new Error("Parent with this id is not found");
                }
                for(const block of parent_asset.blocks){
                    parent_props.push({
                        ...block,
                        inherited: {...block.props},
                        computed: {...block.props},
                        props: {},
                    })
                }
                if(parent_asset.typeIds){
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
            localName: undefined,
        };
        let parent_workspace_path = this.db.localPath;
        if(asset_full.workspaceId) {
            parent_workspace_path = getWorkspaceLocalPathById(asset_full.workspaceId, this.db);
            touchedWIds.push(asset_full.workspaceId)
        }
        const suggest_title = this.getAssetFileSavingFilename(
            asset_full,
            (name) => !fs.existsSync(node_path.join(parent_workspace_path, name))
        )
        asset_full.localName = suggest_title;
        this.assets.add(asset_full);

        if(!options?.fsProcessed){
            await this.saveAssetFile(asset_full)
        }
        
        changeRecord.addChange(asset_id, {
            delete: true
        })
        return {
            id: asset_id,
            touchedWIds
        }
    }

    private _checkIsMdFile(asset_full: ProjectFileDbAsset){
        const meta_block = asset_full.blocks.find(block => block.name === BLOCK_NAME_META && block.computed.format === 'md');
        return !!meta_block;
    }

    async saveAssetFile(asset_full: ProjectFileDbAsset){
        assert(asset_full.localName)
        const local_path = getAssetLocalPath(asset_full, this.db);
        await this.saveAssetFileToFile(asset_full, local_path);
    }

    async saveAssetFileToFile(asset_full: ProjectFileDbAsset, file_path: string){  
        await this.db.fileSystem.expectFsChange([file_path], async () => {
            const writableStream = fs.createWriteStream(file_path);
            this.saveAssetFileToStream(asset_full, writableStream);
            writableStream.end();
            await once(writableStream, 'finish');
            await new Promise<void>((resolve, reject) => writableStream.close((err) => {
                if (err) reject(err)
                else resolve();
            }));
        })      
    }

    saveAssetFileToStream(asset_full: ProjectFileDbAsset, target: Writable){
        if(this._checkIsMdFile(asset_full)) {
            const md_block = asset_full.blocks.find(block => block.type === 'markdown');
            target.write( md_block ? (md_block.computed.value ?? '').toString() : '')
            return;
        }
        
        // Save as ima.json
        const ima_asset = {
            ...asset_full,
            localPath: undefined,
            rights: undefined,
            lastViewedAt: undefined,
            unread: undefined,
            deletedAt: undefined,
            hasImage: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            values: {} as {[key: string]: AssetPropsPlainObject}
        }
        const blocks_for_values = asset_full.blocks.filter((block) => block.name && !block.name.startsWith('__'));      
        for (const block of blocks_for_values) {
            if (!block.name){
                continue;
            }
            const values_block_props = { ...block.props };
            const block_props_keys = Object.keys(values_block_props);
            for (const block_props_key of block_props_keys) {
                if (/^(__|~).+/.test(block_props_key)) {
                    delete values_block_props[block_props_key];
                }
            }
            ima_asset.values[block.name] = values_block_props
        }
        target.write(JSON.stringify(ima_asset, null, 1))
    }

    getAssetFileSavingFilename(asset_full: ProjectFileDbAsset, check_avail: (val: string) => boolean){
        let ext = '.ima.json'
        if(this._checkIsMdFile(asset_full)) {
            ext = '.md'
        }
        return generateNextUniqueNameNumber(
            prepareFileBasenameByEntityTitle(asset_full.title ?? 'untitled'),
            check_avail,
            ' - ',
            ext
        );
    }

    async assetsChange(params: AssetChangeDTO, options?: { pid?: string; fsProcessed?: true}): Promise<AssetsChangeResult> {
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
    
    private async _assetsChangeImpl(changeRecord: HistoryChangeRecord, params: AssetChangeDTO, options?: { pid?: string; fsProcessed?: true }): Promise<{
        ids: string[],
        touchedWIds: string[]
    }> {
        const touchedWIds: string[] = []
        const assets_from_db = await this.searchAssets(params.where);
        const changing_assets_ids = assets_from_db.map(asset => asset.id);
        if(assets_from_db.length > 0){
            const changing_assets = [...assets_from_db];
            for(let changing_asset of changing_assets){
                const undo: AssetSetDTO = {};
                for (const [prop, val] of Object.entries(params.set) as [keyof AssetSetDTO, any][]){
                    switch (prop){
                        case 'blocks':
                        case 'delete':
                        case 'restore':
                            continue;
                        default:
                            if ((changing_asset)[prop] !== val){
                                undo[prop] = (changing_asset)[prop] as any;
                            }
                    }
                }


                const old_path = getAssetLocalPath(changing_asset, this.db);
                const old_workspace_id = changing_asset.workspaceId;
                const old_title = changing_asset.title;
                changing_asset = {
                    ...changing_asset,
                    ...params.set,
                    blocks: params.set.blocks ? this._mergeBlocksToSave(changing_asset.blocks, params.set.blocks, undo) : changing_asset.blocks,
                }

                const workspace_id_changed = params.set.workspaceId !== undefined  && old_workspace_id !== params.set.workspaceId !== undefined ;
                const title_changed = params.set.title !== undefined && old_title !== params.set.title
                if(workspace_id_changed || title_changed) {
                    const local_path = await applyImsFileLocationChange(changing_asset, old_path, this.db);
                    changing_asset.localName = node_path.basename(local_path);
                    if(workspace_id_changed){
                        if (old_workspace_id){
                            touchedWIds.push(old_workspace_id)
                        }
                        if (params.set.workspaceId){
                            touchedWIds.push(params.set.workspaceId)
                        }
                    }
                }
                this.assets.replace(changing_asset);
                if(!options?.fsProcessed){
                    await this.saveAssetFile(changing_asset)
                }
                changeRecord.addChange(changing_asset.id, undo)
            }
        }
        return {
            ids: changing_assets_ids,
            touchedWIds
        };
    }
    async assetsChangeUndo(params: { changeId: string; }, options?: { pid?: string; fsProcessed?: true}): Promise<AssetsChangeResult> {
        const changes = this._sessionChangeHistory.get(params.changeId);
        return this.assetsChangeBatch({
            ops: changes ? changes.changes.map(change => {
                return {
                    where: {
                        id: change.assetId
                    },
                    set: change.undo
                }
            }, options): []
        })
    }

    async assetsChangeBatch(params: { ops: AssetChangeBatchOpDTO[]; }, options?: { pid?: string; fsProcessed?: true }): Promise<AssetsBatchChangeResultDTO> {
        const changeRecord = new HistoryChangeRecord();
        const createdIds = new  Set<string>()
        const updatedIds = new  Set<string>()
        const deletedIds = new  Set<string>()
        let touchedWIds: string[] = [];

        for (const op of params.ops){
            if (op.create){
                const res = await this._assetsCreateImpl(changeRecord, {
                    id: (typeof op.create === 'object' ? op.create.id : undefined) ?? undefined,
                    set: op.set
                }, options)
                if (res.touchedWIds.length > 0){
                    touchedWIds = touchedWIds.concat(res.touchedWIds);
                }
                createdIds.add(res.id)
            }
            else if (op.set.delete){
                assert(op.where, "Where is required for delete actions")
                const res = await this._assetsDeleteImpl(changeRecord, op.where, options)
                if (res.touchedWIds.length > 0){
                    touchedWIds = touchedWIds.concat(res.touchedWIds);
                }
                for (const id of res.ids){
                    deletedIds.add(id)
                }
            }
            else if (op.set.restore) {
                assert(op.where, "Where is required for restore actions")
                const res = await this._assetsRestore(changeRecord, op.where, options)
                if (res.touchedWIds.length > 0){
                    touchedWIds = touchedWIds.concat(res.touchedWIds);
                }
                for (const id of res.ids){
                    createdIds.add(id)
                }
            }
            else {
                assert(op.where, "Where is required for update actions")
                const res = await this._assetsChangeImpl(changeRecord, {
                    set: op.set,
                    where: op.where
                }, options)
                if (res.touchedWIds.length > 0){
                    touchedWIds = touchedWIds.concat(res.touchedWIds);
                }
                for (const id of res.ids){
                    updatedIds.add(id)
                }

            }
        }

        const updatedOrCreated = await this.assetsGetFull({
            where: {
                id: [...createdIds, ...updatedIds],
            }
          })

        if(updatedOrCreated.ids.length > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO assets (id, title, need_sync)
                VALUES ` + updatedOrCreated.ids.map(i => `(?,?, ${SQLITE_NOW_STM})`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM};
            `, updatedOrCreated.ids.map(id => 
                [id, updatedOrCreated.objects.assetFulls[id].title]).flat());
        }
        if(deletedIds.size > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO assets (id, need_sync)
                VALUES ` + [...deletedIds].map(i => `(?, ${SQLITE_NOW_STM})`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM};
            `, [...deletedIds]);
        }
        this._sessionChangeHistory.set(changeRecord.changeId, changeRecord)

        this.db.sendProjectChange({
            aUpsIds: [...(new Set([...createdIds, ...updatedIds]))],
            aDelIds: [...deletedIds],
            wUpsIds: [],
            wDelIds: [],
            wTchIds: [...new Set(touchedWIds)],
            instigator: null
        });

        return {
            ...updatedOrCreated,
            changeId: changeRecord.changeId,
            createdIds: [...createdIds],
            deletedIds:  [...deletedIds],
            updatedIds: [...updatedIds],
            touchedWIds: [...new Set(touchedWIds)]
        };
    }
    async assetsDelete(where: AssetWhereParams, options?: { pid?: string; fsProcessed?: true }): Promise<AssetDeleteResultDTO> {
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
        this.assets.delete(asset_id)
        const system_asset = this.systemAssets.byId.get(asset_id);
        if(system_asset){
            this.assets.add({...system_asset});
        }
    }

    private async _deleteAssetFileFromFilesystem(asset: ProjectFileDbAsset){
        if (!asset.localName) return;
        const local_path = getAssetLocalPath(asset, this.db)
        await this.db.fileSystem.expectFsChange([
            local_path
        ], async () => {
            try {
                await shell.trashItem(local_path);
            }
            catch (err: any){
                // Ignore error
            }
        })
    }

    private async _assetsDeleteImpl(changeRecord: HistoryChangeRecord, where: AssetWhereParams, options?: { pid?: string; fsProcessed?: true }): Promise<{
        ids: string[], 
        touchedWIds: string[]
    }> {
        const touchedWIds: string[] = []
        const deleting_assets = await this.searchAssets({
            ...where,
            isSystem: false
        });
        if(deleting_assets.length > 0){
            for(const asset of deleting_assets){
                if (asset.workspaceId){
                    touchedWIds.push(asset.workspaceId)
                }
                this.deleteOwnAssetFromCollectionOnly(asset.id);
                
                if(!options?.fsProcessed){
                    await this._deleteAssetFileFromFilesystem(asset);
                }

                changeRecord.addChange(asset.id, {
                    restore: true
                })
            }
        }
        this._sessionDeletedAssets.addMany(deleting_assets)
        const deleting_asset_ids = deleting_assets.map(a => a.id)

        return {
            ids: deleting_asset_ids,
            touchedWIds
        }
    }
   async assetsRestore( where: AssetWhereParams, options?: { pid?: string; fsProcessed?: true }): Promise<AssetsChangeResult> {
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
    
   private async _assetsRestore(changeRecord: HistoryChangeRecord,where: AssetWhereParams, options?: { pid?: string; fsProcessed?: true }): Promise<{ 
        ids: string[],    
        touchedWIds: string[]
    }> {
        const touchedWIds: string[] = []
        const filter = await AssetSearchFilter.Create(where, this.db);
        const result = filter.apply(this._sessionDeletedAssets.iterate());
        const restoring_assets = [...result];
        for (const asset_full of restoring_assets){
            this.assets.add(asset_full);
            this._sessionDeletedAssets.delete(asset_full.id);
            if(!options?.fsProcessed){
                await this.saveAssetFile(asset_full)
            }
            changeRecord.addChange(asset_full.id, {
                delete: true
            })
            if (asset_full.workspaceId){
                touchedWIds.push(asset_full.workspaceId)
            }
        }
        return {
            ids: restoring_assets.map(a => a.id),
            touchedWIds
        }
    }
    assetsCreateRef(params: CreateRefDTO): Promise<AssetReferencesResult> {
        throw new Error("Method not implemented.");
    }
    assetsDeleteRef(params: CreateRefDTO): Promise<AssetDeleteRefResultDTO> {
        throw new Error("Method not implemented.");
    }
    async assetsMove(params: AssetMoveParams, options?: { fsProcessed?: true}): Promise<AssetMoveResult> {
        const avail_assets = await this.assetsGetShort({
            where: {
                id: params.ids,
                isSystem: false,
            }
        });


        let cur_index: number | null | undefined = undefined;
        let index_step: number = 0;
        if (params.indexFrom !== undefined || params.indexTo !== undefined){
            if (params.indexFrom === null){
                cur_index = null
            }
            else if (params.indexTo === null){
                cur_index = params.indexFrom;
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
            return [item.id, {...item}]
        }));
        for (const asset_id of params.ids) {
            const avail_asset = avail_assets_map.get(asset_id)
            if (avail_asset) {
                const set: AssetSetDTO = {}
                if (cur_index !== undefined){
                    avail_asset.index = cur_index;
                    set.index = cur_index;
                }
                if (params.workspaceId !== undefined && avail_asset.workspaceId !== params.workspaceId){
                    avail_asset.workspaceId = params.workspaceId;
                    set.workspaceId = params.workspaceId;
                }
                ops.push({
                    set,
                    where: {
                        id: asset_id,
                    }
                })
                if (cur_index !== null && cur_index !== undefined){
                    cur_index += index_step;
                }
            }
        }
        const res = await this.assetsChangeBatch({
            ops
        }, options);
        return {
            changeId: res.changeId,
            list: res.updatedIds.map(id => {
                const avail_asset = avail_assets_map.get(id);
                return {
                    id,
                    index: avail_asset?.index ?? null,
                    workspaceId: avail_asset?.workspaceId ?? null
                }
            }),
            touchedWIds: res.touchedWIds
        }
    }
    assetsGetHistory(assetId: string): Promise<ApiResultListWithMore<AssetHistoryDTO>> {
        throw new Error("Method not implemented.");
    }

    async exportToFile(assetId: string, target: string){
        const assets = await this.getAssetFulls({
            where: {
                id: assetId
            }
        })
        if (assets.list.length === 0){
            throw new Error('Asset not found')
        }
        await this.saveAssetFileToFile(assets.list[0], target);
    }
    findByLocalPath(localPath: string): ProjectFileDbAsset| null {
        const dirpath = node_path.dirname(localPath);
        const local_name = node_path.basename(localPath);
        const workspace = this.db.workspace.findByLocalDirPath(dirpath);
        if (!workspace) return null;

        const found = this.assets.iterate().find(x => x.localName === local_name && x.workspaceId === workspace.id);
        return found ?? null;
    }

}