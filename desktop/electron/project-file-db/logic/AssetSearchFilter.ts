
import isUUID from 'validator/es/lib/isUUID';
import type { AssetQueryWhere } from "~ims-app-base/logic/types/AssetsType";
import { AssetPropWhereOpKind, getAssetPropWhereProp, type AssetPropWhereCondition, type AssetPropWhereOp, type AssetPropWhereOpAnd, type AssetPropWhereValue } from '~ims-app-base/logic/types/PropsWhere';
import { escapeRegExp } from "~ims-app-base/logic/utils/stringUtils";
import type { ProjectFileDb, ProjectFileDbAsset } from "../ProjectFileDb";
import { AssetPropType, castAssetPropValueToFloat, castAssetPropValueToInt, castAssetPropValueToString, compareAssetPropValues, getAssetPropType, parseAssetNewBlockPropKeyRef, type AssetBlockIdWithName, type AssetPropsPlainObject, type AssetPropsPlainObjectValue, type AssetPropValue } from '~ims-app-base/logic/types/Props';

function testAssetPropValueByWhereCondition(val: AssetPropValue, where: AssetPropWhereOp): boolean {
    const oprnd_prop = getAssetPropWhereProp(where.v as AssetPropWhereCondition);
    if (oprnd_prop){
        throw new Error('Operand props not supported')
    }

    switch (where.op){
        case AssetPropWhereOpKind.EQUAL:
        case AssetPropWhereOpKind.EQUAL_NOT:
        case AssetPropWhereOpKind.LESS:
        case AssetPropWhereOpKind.LESS_EQUAL:
        case AssetPropWhereOpKind.MORE:
        case AssetPropWhereOpKind.MORE_EQUAL:
        {
            let converted_val = val;
            const where_val_type = getAssetPropType(where.v as AssetPropValue);
            switch (where_val_type){
                case AssetPropType.INTEGER:
                    converted_val = castAssetPropValueToInt(val);
                    break
                case AssetPropType.FLOAT:
                    converted_val = castAssetPropValueToFloat(val);
                    break
                case AssetPropType.STRING:
                    converted_val = castAssetPropValueToString(val);
                    break
            }

            const compare = compareAssetPropValues(converted_val, where.v as AssetPropValue);
                switch (where.op){
                    case AssetPropWhereOpKind.EQUAL:
                        return compare === 0;
                    case AssetPropWhereOpKind.EQUAL_NOT:
                        return compare !== 0;
                    case AssetPropWhereOpKind.LESS:
                        return compare < 0;
                    case AssetPropWhereOpKind.LESS_EQUAL:
                        return compare <= 0;
                    case AssetPropWhereOpKind.MORE:
                        return compare > 0;
                    case AssetPropWhereOpKind.MORE_EQUAL:
                        return compare >= 0;
                }
        }

        default:{
            throw new Error('Operator not supported')
        }
    }
}


export class AssetSearchFilter{
    private _filterIsSystem: boolean | null = null;
    private _filterTypeIds: string[] | null = null
    private _filterInsideWorkspaceIds: string[] | null = null;
    private _filterQuery: RegExp | null = null;
    private _subFiltersAnds: AssetSearchFilter[] = [];
    private _subFiltersOrs: AssetSearchFilter[][] = [];
    private _resultNothing: boolean = false;
    private _propFilters: {block: AssetBlockIdWithName, propPath: string[], value: AssetPropWhereOp}[] = [];

    static async Create(where: AssetQueryWhere, db: ProjectFileDb ){
        const res = new AssetSearchFilter(where, db);
        await res._init();
        return res;
    }
    
    private constructor(public where: AssetQueryWhere, public db: ProjectFileDb ){
    }

    private async _init(){
        if (this.where.typeids){
            this._filterTypeIds = typeof this.where.typeids === 'string' ? [this.where.typeids] : this.where.typeids        
        }
        // TODO: add intersection check with this.where.typeids
        if (this.where.type){
            if (isUUID(this.where.type)){
                this._filterTypeIds = [this.where.type]
            }
            else {
                const type_asset = this.db.asset.assets.byName.get(this.where.type);
                if (!type_asset){
                    this._resultNothing = true;
                }
                else {
                    this._filterTypeIds = [type_asset.id];
                }
            }
        }
        
        if (this.where.workspaceids){
            this._filterInsideWorkspaceIds = typeof this.where.workspaceids === 'string' ? [this.where.workspaceids] : this.where.workspaceids        
        }
        // TODO: add intersection check with this.where.workspaceids
        if (this.where.inside){
            if (isUUID(this.where.inside)){
                this._filterInsideWorkspaceIds = [this.where.inside]
            }
            else {
                const inside_workspace = this.db.workspace.workspaces.byName.get(this.where.inside);
                if (!inside_workspace){
                    this._resultNothing = true;
                }
                else {
                    this._filterInsideWorkspaceIds = [inside_workspace.id];
                }
            }
        }


        this._filterIsSystem = this.where.isSystem !== undefined ? this.where.isSystem : (this.where.issystem !== undefined ? this.where.issystem : null );
        this._filterQuery = this.where.query ? new RegExp('.*' + escapeRegExp(this.where.query) + '.*' , 'i') : null;
        
        if (!this._filterQuery && this.where.search && this.where.search.v){
           this._filterQuery = this.where.search.v.length > 0 ? new RegExp('.*' + escapeRegExp(this.where.search.v[0].query) + '.*' , 'i') : null;
        }


        for (const [where_key, where_cond] of Object.entries(this.where)){
            let handled = false;
            if(where_cond && typeof where_cond === 'object'){
                if ((where_cond as AssetPropWhereOp).op === AssetPropWhereOpKind.AND){
                    for (const v of (where_cond as AssetPropWhereOpAnd).v){
                        this._subFiltersAnds.push(new AssetSearchFilter(v, this.db))
                    }
                    handled = true;
                }
                else if ((where_cond as AssetPropWhereOp).op === AssetPropWhereOpKind.OR){
                    const ors: AssetSearchFilter[] =  [];
                    for (const v of (where_cond as AssetPropWhereOpAnd).v){
                        ors.push(await AssetSearchFilter.Create(v, this.db))
                    }
                    this._subFiltersOrs.push(ors);
                    handled = true;
                }
            }
             if (!handled && where_key.includes('|')){
                const where_key_parsed = parseAssetNewBlockPropKeyRef(where_key);
                const where_cond_op = where_cond && (where_cond as AssetPropWhereOp).op ? 
                    where_cond : 
                    {
                        op:AssetPropWhereOpKind.EQUAL,
                        v: where_cond
                    }
                this._propFilters.push({
                    block: {
                        blockId: where_key_parsed.blockId,
                        blockName: where_key_parsed.blockName
                    },
                    propPath: where_key_parsed.propKey.split("\\"),
                    value: where_cond_op
                })
            }
        }
    }

    private *_applySelf(assets: Iterable<ProjectFileDbAsset>): Generator<ProjectFileDbAsset>{
        if (this._resultNothing){
            return;
        }
        for (const asset of assets) {
            let is_passed = true;

            const where_workspace_id = this.where.workspaceId ? this.where.workspaceId : this.where.workspaceid;
            if (is_passed && where_workspace_id) {
                if (Array.isArray(where_workspace_id)){
                    if (!where_workspace_id.includes(asset.workspaceId)) {
                        is_passed = false;
                    }
                }
                else {
                    if (asset.workspaceId !== where_workspace_id) {
                        is_passed = false;
                    }
                }
            }
            if (is_passed && this._filterInsideWorkspaceIds){
                if (!asset.workspaceId) is_passed = false;
                else {
                    const parents = this.db.workspace.getWorkspaceParentsById(asset.workspaceId);
                    is_passed = this._filterInsideWorkspaceIds.some(workspace_id => parents.has(workspace_id));
                }
            }
            if (is_passed && this.where.id) {
                if (Array.isArray(this.where.id)){
                    if (!this.where.id.includes(asset.id)) {
                        is_passed = false;
                    }
                }
                else {
                    if (this.where.id !== asset.id) {
                        is_passed = false;
                    }
                }
            }
            if (is_passed && this._filterTypeIds) {
                const filter_type_ids = this._filterTypeIds;
                is_passed = asset.typeIds.some(r => filter_type_ids.includes(r));
            }
            if (is_passed && this._filterIsSystem !== null) {
                if (this._filterIsSystem) {
                    is_passed = asset.projectId !== this.db.info.id;
                }
                else {
                    is_passed = asset.projectId === this.db.info.id;
                }
            }
            if (is_passed && this.where.name !== undefined) {
                is_passed = asset.name === this.where.name;
            }
            if (is_passed && this._filterQuery) {
                is_passed = this._filterQuery.test(asset.title ?? '');
            }

            if(is_passed && this.where.ownblocks !== undefined){
                const ownblocks_op = this.where.ownblocks;
                if (ownblocks_op && (ownblocks_op as AssetPropWhereOp).op === AssetPropWhereOpKind.EQUAL_NOT){
                    is_passed = !asset.blocks.some(block => block.name === (ownblocks_op as AssetPropWhereOp).v  && block.own)
                }
                else {
                    throw new Error("Method not implemented.");
                }
            }

            let prop_filter_i = 0;
            while (is_passed && prop_filter_i < this._propFilters.length){
                const prop_filter = this._propFilters[prop_filter_i];
                let asset_prop_value: AssetPropsPlainObjectValue = null;
                if (prop_filter.block.blockId){
                    const block = asset.blocks.find(b => b.id === prop_filter.block.blockId);
                    if (block) asset_prop_value = block.computed;
                }
                else if (prop_filter.block.blockName){
                    const block = asset.blocks.find(b => b.name === prop_filter.block.blockName);
                    if (block) asset_prop_value = block.computed;
                }
                for (const prop_key_part of prop_filter.propPath){
                    if (asset_prop_value === null) break;
                    if (typeof asset_prop_value !== 'object'){
                        asset_prop_value = null;
                    }
                    else {
                        const asset_prop_value_type = getAssetPropType(asset_prop_value as AssetPropValue);
                        if (asset_prop_value_type){
                            asset_prop_value = null;
                        }
                        else {
                            asset_prop_value = (asset_prop_value as AssetPropsPlainObject)[prop_key_part];
                        }
                    }
                }
                
                const final_asset_prop_value_type = getAssetPropType(asset_prop_value as AssetPropValue);
                if (!final_asset_prop_value_type){
                    is_passed = false;
                }
                else {
                    is_passed = testAssetPropValueByWhereCondition(
                        asset_prop_value as AssetPropValue, 
                        prop_filter.value
                    );
                }
                
                prop_filter_i++;
            }

            if (is_passed) {
                yield asset;
            }
        }
    }

    apply(assets: Iterable<ProjectFileDbAsset>): Generator<ProjectFileDbAsset>{
        let res = this._applySelf(assets);
        for (const subfilter of this._subFiltersAnds){
            res = subfilter.apply(res);
        }
        if (this._subFiltersOrs.length > 0){           
            for (const subfilter_or of this._subFiltersOrs){                    
                const current_res = [...res]

                let or_res_set = new Set<ProjectFileDbAsset>();
                let or_index = 0;
                for (const or_subfilter of subfilter_or){
                    const left = or_index > 0 ? current_res.filter(a => !or_res_set.has(a)) : current_res;
                    for (const asset of or_subfilter.apply(left)){
                        or_res_set.add(asset);
                    }
                    or_index++;
                }    

                res = (function* (arr: Set<ProjectFileDbAsset>) {
                    yield* arr;
                })(or_res_set);      
            }
            
        }
        return res;
    }
}