
import isUUID from 'validator/es/lib/isUUID';
import type { AssetQueryWhere } from "~ims-app-base/logic/types/AssetsType";
import { AssetPropWhereOpKind, getAssetPropWhereProp, type AssetPropWhereCondition, type AssetPropWhereOp, type AssetPropWhereOpAnd } from '~ims-app-base/logic/types/PropsWhere';
import { escapeRegExp } from "~ims-app-base/logic/utils/stringUtils";
import type { ProjectFileDb, ProjectFileDbAsset } from "../ProjectFileDb";
import { AssetPropType, castAssetPropPlainObjectValueToString, castAssetPropValueToBoolean, castAssetPropValueToFloat, castAssetPropValueToInt, castAssetPropValueToString, compareAssetPropValues, convertAssetPropsToPlainObject, getAssetPropType, getAssetPropValueLen, isFilledAssetPropValue, parseAssetNewBlockPropKeyRef, type AssetBlockIdWithName, type AssetPropsPlainObject, type AssetPropsPlainObjectValue, type AssetPropValue } from '~ims-app-base/logic/types/Props';
import { getFieldDescriptor, readFieldDescriptorValue } from '../asset-fields';

function testAssetPropValueByWhereCondition(
    val: AssetPropValue,
    where: AssetPropWhereOp,
    fieldType: AssetPropType | null,
    operand_value?: AssetPropValue,
): boolean {
    switch (where.op) {
        case AssetPropWhereOpKind.EQUAL:
        case AssetPropWhereOpKind.EQUAL_NOT:
        case AssetPropWhereOpKind.LESS:
        case AssetPropWhereOpKind.LESS_EQUAL:
        case AssetPropWhereOpKind.MORE:
        case AssetPropWhereOpKind.MORE_EQUAL: {
            // Operand props compare two fields, so both sides are cast the same way
            const compare_val = operand_value !== undefined
                ? operand_value
                : where.v as AssetPropValue;
            // A nested plain object has no prop type, and compareAssetPropValues
            // has no ordering for one, so comparisons must never match it. The
            // other operators below do define object behaviour (imc_is_filled,
            // imc_len, imc_to_string), which is why the rule lives here rather
            // than in the filter loop.
            if (!getAssetPropType(val)) {
                return false;
            }
            let converted_val = val;
            switch (getAssetPropType(compare_val)) {
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

            const compare = compareAssetPropValues(converted_val, compare_val);
            switch (where.op) {
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
                default:
                    return false;
            }
        }
        case AssetPropWhereOpKind.ANY:
        case AssetPropWhereOpKind.ANY_NOT: {
            const values = (where.v ?? []) as AssetPropValue[];
            const passed = values.some(candidate =>
                testAssetPropValueByWhereCondition(val, {
                    op: AssetPropWhereOpKind.EQUAL,
                    v: candidate,
                } as AssetPropWhereOp, fieldType),
            );
            return where.op === AssetPropWhereOpKind.ANY ? passed : !passed;
        }
        case AssetPropWhereOpKind.LIKE:
        case AssetPropWhereOpKind.LIKE_NOT: {
            const str = castAssetPropPlainObjectValueToString(val);
            const passed = new RegExp(escapeRegExp((where.v as string).toString()), 'i').test(str);
            return where.op === AssetPropWhereOpKind.LIKE ? passed : !passed;
        }
        case AssetPropWhereOpKind.MATCH: {
            const str = castAssetPropPlainObjectValueToString(val);
            return new RegExp((where.v as string).toString()).test(str);
        }
        case AssetPropWhereOpKind.LEN_EQUAL:
        case AssetPropWhereOpKind.LEN_EQUAL_NOT:
        case AssetPropWhereOpKind.LEN_LESS:
        case AssetPropWhereOpKind.LEN_LESS_EQUAL:
        case AssetPropWhereOpKind.LEN_MORE:
        case AssetPropWhereOpKind.LEN_MORE_EQUAL: {
            const len = getAssetPropValueLen(val);
            if (len === null) return false;
            const expected = where.v as number;
            switch (where.op) {
                case AssetPropWhereOpKind.LEN_EQUAL:
                    return len === expected;
                case AssetPropWhereOpKind.LEN_EQUAL_NOT:
                    return len !== expected;
                case AssetPropWhereOpKind.LEN_LESS:
                    return len < expected;
                case AssetPropWhereOpKind.LEN_LESS_EQUAL:
                    return len <= expected;
                case AssetPropWhereOpKind.LEN_MORE:
                    return len > expected;
                case AssetPropWhereOpKind.LEN_MORE_EQUAL:
                    return len >= expected;
                default:
                    return false;
            }
        }
        case AssetPropWhereOpKind.EMPTY: {
            const filled = isFilledAssetPropValue(val);
            return where.v ? !filled : filled;
        }
        case AssetPropWhereOpKind.CHECKED: {
            // A missing or falsy value is simply not checked, so normalising to
            // 0/1 is enough to tell checked=true from checked=false
            return (where.v ? 1 : 0) === (castAssetPropValueToBoolean(val) ? 1 : 0);
        }
        default: {
            throw new Error('Operator not supported')
        }
    }
}


export type AssetSearchFilterPropFilter = {
    block: AssetBlockIdWithName,
    propPath: string[],
    value: AssetPropWhereOp,
};

export class AssetSearchFilter {
    private _filterIsSystem: boolean | null = null;
    private _filterTypeIds: string[] | null = null
    private _filterInsideWorkspaceIds: string[] | null = null;
    private _filterQuery: RegExp | null = null;
    private _subFiltersAnds: AssetSearchFilter[] = [];
    private _subFiltersOrs: AssetSearchFilter[][] = [];
    private _resultNothing: boolean = false;
    private _propFilters: AssetSearchFilterPropFilter[] = [];
    private _propFilterBlocks: AssetBlockIdWithName[] = [];
    private _operandBlocks = new Map<string, AssetBlockIdWithName>();

    static async Create(where: AssetQueryWhere, db: ProjectFileDb) {
        const res = new AssetSearchFilter(where, db);
        await res._init();
        return res;
    }

    private constructor(public where: AssetQueryWhere, public db: ProjectFileDb) {
    }

    private async _init() {
        if (this.where.typeids) {
            this._filterTypeIds = typeof this.where.typeids === 'string' ? [this.where.typeids] : this.where.typeids
        }
        // TODO: add intersection check with this.where.typeids
        if (this.where.type) {
            if (isUUID(this.where.type, 'loose')) {
                this._filterTypeIds = [this.where.type]
            }
            else {
                const type_asset = this.db.asset.assets.byName.get(this.where.type);
                if (!type_asset) {
                    this._resultNothing = true;
                }
                else {
                    this._filterTypeIds = [type_asset.id];
                }
            }
        }

        if (this.where.workspaceids) {
            this._filterInsideWorkspaceIds = typeof this.where.workspaceids === 'string' ? [this.where.workspaceids] : this.where.workspaceids
        }
        // TODO: add intersection check with this.where.workspaceids
        if (this.where.inside) {
            if (isUUID(this.where.inside, 'loose')) {
                this._filterInsideWorkspaceIds = [this.where.inside]
            }
            else {
                const inside_workspace = this.db.workspace.workspaces.byName.get(this.where.inside);
                if (!inside_workspace) {
                    this._resultNothing = true;
                }
                else {
                    this._filterInsideWorkspaceIds = [inside_workspace.id];
                }
            }
        }


        this._filterIsSystem = this.where.isSystem !== undefined ? this.where.isSystem : (this.where.issystem !== undefined ? this.where.issystem : null);
        this._filterQuery = this.where.query ? new RegExp('.*' + escapeRegExp(this.where.query) + '.*', 'i') : null;

        if (!this._filterQuery && this.where.search && this.where.search.v) {
            this._filterQuery = this.where.search.v.length > 0 ? new RegExp('.*' + escapeRegExp(this.where.search.v[0].query) + '.*', 'i') : null;
        }


        for (const [where_key, where_cond] of Object.entries(this.where)) {
            let handled = false;
            if (where_cond && typeof where_cond === 'object') {
                if ((where_cond as AssetPropWhereOp).op === AssetPropWhereOpKind.AND) {
                    for (const v of (where_cond as AssetPropWhereOpAnd).v) {
                        this._subFiltersAnds.push(await AssetSearchFilter.Create(v, this.db))
                    }
                    handled = true;
                }
                else if ((where_cond as AssetPropWhereOp).op === AssetPropWhereOpKind.OR) {
                    const ors: AssetSearchFilter[] = [];
                    for (const v of (where_cond as AssetPropWhereOpAnd).v) {
                        ors.push(await AssetSearchFilter.Create(v, this.db))
                    }
                    this._subFiltersOrs.push(ors);
                    handled = true;
                }
            }
            if (!handled && where_key.includes('|')) {
                const where_key_parsed = parseAssetNewBlockPropKeyRef(where_key);
                const where_cond_op = where_cond && (where_cond as AssetPropWhereOp).op ?
                    where_cond :
                    {
                        op: AssetPropWhereOpKind.EQUAL,
                        v: where_cond
                    }
                this._propFilters.push({
                    block: {
                        blockId: where_key_parsed.blockId,
                        blockName: where_key_parsed.blockName
                    },
                    propPath: where_key_parsed.propKey.split("\\"),
                    value: where_cond_op,
                })
            }
        }

        for (const prop_filter of this._propFilters) {
            if (!this._propFilterBlocks.some(existing =>
                existing.blockId === prop_filter.block.blockId && existing.blockName === prop_filter.block.blockName
            )) {
                this._propFilterBlocks.push({ blockId: prop_filter.block.blockId, blockName: prop_filter.block.blockName });
            }
            // An operand prop read from the same block needs no extra block, but
            // one from another block has to be resolved before evaluation.
            const operand_prop = getAssetPropWhereProp(
                prop_filter.value.v as AssetPropWhereCondition,
            );
            if (operand_prop && operand_prop.includes('|')) {
                const operand_parsed = parseAssetNewBlockPropKeyRef(operand_prop);
                const operand_block: AssetBlockIdWithName = {
                    blockId: operand_parsed.blockId,
                    blockName: operand_parsed.blockName,
                };
                this._operandBlocks.set(operand_prop, operand_block);
                const already_resolved =
                    operand_parsed.blockId === prop_filter.block.blockId &&
                    operand_parsed.blockName === prop_filter.block.blockName;
                if (!already_resolved && !this._propFilterBlocks.some(existing =>
                    existing.blockId === operand_block.blockId && existing.blockName === operand_block.blockName
                )) {
                    this._propFilterBlocks.push(operand_block);
                }
            }
        }
    }

    private _findBlock(asset: ProjectFileDbAsset, block_ref: AssetBlockIdWithName | null) {
        if (!block_ref) return undefined;
        return asset.blocks.find(block => {
            if (block_ref.blockId) return block.id === block_ref.blockId;
            if (block_ref.blockName) return block.name === block_ref.blockName;
            return false;
        });
    }

    private _readPropFilterValue(
        asset: ProjectFileDbAsset | null,
        prop_filter: AssetSearchFilterPropFilter,
    ): AssetPropsPlainObjectValue {
        if (!asset) return null;
        const block = this._findBlock(asset, prop_filter.block);
        if (!block || !block.computedAt) return null;
        // computed is stored assigned — convert to plain for the propPath walk
        let value: AssetPropsPlainObjectValue = block.computed
            ? convertAssetPropsToPlainObject(block.computed)
            : null;
        for (const prop_key_part of prop_filter.propPath) {
            if (value === null) break;
            if (typeof value !== 'object') {
                value = null;
            }
            else {
                const value_type = getAssetPropType(value as AssetPropValue);
                if (value_type) {
                    value = null;
                }
                else {
                    value = (value as AssetPropsPlainObject)[prop_key_part];
                }
            }
        }
        return value;
    }

    /**
     * `{op: '<', v: {prop: 'other_field'}}` compares two fields. Block prop
     * operands have to be resolved before the row is evaluated, so their blocks
     * are registered alongside the filtered blocks during _init.
     */
    private _readOperandValue(
        asset: ProjectFileDbAsset | null,
        operand_prop: string,
        operand_block: AssetBlockIdWithName | null,
    ): AssetPropsPlainObjectValue {
        if (!operand_block) {
            return asset
                ? readFieldDescriptorValue(asset, getFieldDescriptor(operand_prop))
                : null;
        }
        return this._readPropFilterValue(asset, {
            block: operand_block,
            propPath: (parseAssetNewBlockPropKeyRef(operand_prop).propKey).split('\\'),
            value: { op: AssetPropWhereOpKind.EQUAL, v: null },
        });
    }

    private async *_applySelf(assets: Iterable<ProjectFileDbAsset>): AsyncGenerator<ProjectFileDbAsset> {
        if (this._resultNothing) {
            return;
        }
        for (const asset of assets) {
            let is_passed = true;

            const where_workspace_id = this.where.workspaceId ? this.where.workspaceId : this.where.workspaceid;
            if (is_passed && where_workspace_id) {
                if (Array.isArray(where_workspace_id)) {
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
            if (is_passed && this._filterInsideWorkspaceIds) {
                if (!asset.workspaceId) is_passed = false;
                else {
                    const parents = this.db.workspace.getWorkspaceParentsById(asset.workspaceId);
                    is_passed = this._filterInsideWorkspaceIds.some(workspace_id => parents.has(workspace_id));
                }
            }
            if (is_passed && this.where.id) {
                if (Array.isArray(this.where.id)) {
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
            if (is_passed && this.where.title !== undefined) {
                is_passed = asset.title === this.where.title;
            }
            if (is_passed && this._filterQuery) {
                is_passed = this._filterQuery.test(asset.title ?? '');
            }

            if (is_passed && this.where.ownblocks !== undefined) {
                const ownblocks_op = this.where.ownblocks;
                if (ownblocks_op && (ownblocks_op as AssetPropWhereOp).op === AssetPropWhereOpKind.EQUAL_NOT) {
                    is_passed = !asset.blocks.some(block => block.name === (ownblocks_op as AssetPropWhereOp).v && block.own)
                }
                else {
                    throw new Error("Method not implemented.");
                }
            }

            if (is_passed && this._propFilters.length > 0){
                const partial_full = await this.db.asset.computeFullAsset(asset, this._propFilterBlocks);

                let prop_filter_i = 0;
                while (is_passed && prop_filter_i < this._propFilters.length) {
                    const prop_filter = this._propFilters[prop_filter_i];
                    const asset_prop_value = this._readPropFilterValue(partial_full, prop_filter);

                    let operand_value: AssetPropValue | undefined = undefined;
                    const operand_prop = getAssetPropWhereProp(
                        prop_filter.value.v as AssetPropWhereCondition,
                    );
                    if (operand_prop) {
                        operand_value = this._readOperandValue(
                            partial_full,
                            operand_prop,
                            this._operandBlocks.get(operand_prop) ?? null,
                        ) as AssetPropValue;
                    }

                    is_passed = testAssetPropValueByWhereCondition(
                        asset_prop_value as AssetPropValue,
                        prop_filter.value,
                        // prop filters are always block props, so they have no declared type
                        null,
                        operand_value,
                    );

                    prop_filter_i++;
                }
            }

            if (is_passed) {
                yield asset;
            }
        }
    }

    async apply(assets: Iterable<ProjectFileDbAsset>): Promise<ProjectFileDbAsset[]> {
        const result: ProjectFileDbAsset[] = [];
        for await (const asset of this._applySelf(assets)) {
            result.push(asset);
        }
        let res = result;
        for (const subfilter of this._subFiltersAnds) {
            res = await subfilter.apply(res);
        }
        if (this._subFiltersOrs.length > 0) {
            for (const subfilter_or of this._subFiltersOrs) {
                const current_res = res;

                const or_res_set = new Set<ProjectFileDbAsset>();
                let or_index = 0;
                for (const or_subfilter of subfilter_or) {
                    const left = or_index > 0 ? current_res.filter(a => !or_res_set.has(a)) : current_res;
                    const or_result = await or_subfilter.apply(left);
                    for (const asset of or_result) {
                        or_res_set.add(asset);
                    }
                    or_index++;
                }

                res = [...or_res_set];
            }

        }
        return res;
    }
}