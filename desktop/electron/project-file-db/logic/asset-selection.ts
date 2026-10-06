import ApiError, { ApiErrorCodes } from '~ims-app-base/logic/types/ApiError';
import {
    AssetPropType,
    castAssetPropPlainObjectValueToString,
    castAssetPropValueToBoolean,
    castAssetPropValueToFloat,
    castAssetPropValueToInt,
    castAssetPropValueToString,
    castAssetPropValueToTimestamp,
    compareAssetPropValues,
    getAssetPropType,
    getAssetPropValueLen,
    isFilledAssetPropValue,
    type AssetBlockIdWithName,
    type AssetPropsPlainObjectValue,
    type AssetPropValue,
    type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import type {
    AssetPropsSelectionBase,
    AssetPropsSelectionField,
    AssetPropsSelectionOrder,
} from '~ims-app-base/logic/types/PropsSelection';
import { getFieldDescriptor, type ProjectFileDbAssetFieldDescriptor } from '../asset-fields';

function pad(value: number, length: number): string {
    return Math.abs(value).toString().padStart(length, '0');
}

function formatUtcDate(date: Date): string {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function formatUtcDateTime(date: Date): string {
    return `${formatUtcDate(date)}T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`;
}

function numbersOrNull(values: (number | null)[]): number[] {
    return values.filter((v): v is number => v !== null);
}

function reduceNumbers(
    values: (number | null)[],
    reducer: (acc: number, cur: number) => number,
): number | null {
    const nums = numbersOrNull(values);
    if (nums.length === 0) return null;
    return nums.reduce(reducer);
}

export type AssetSelectionFuncDef = {
    /** Aggregate functions may only be used when the query groups its results. */
    agg: boolean;
    cast?: (value: AssetPropsPlainObjectValue) => AssetPropValue;
    reduce?: (values: AssetPropsPlainObjectValue[]) => AssetPropValue;
};

/**
 * Same names and same agg flags as the server's ASSET_VIEW_QUERY_FUNCS.
 */
export const ASSET_SELECTION_FUNCS = new Map<string, AssetSelectionFuncDef>();
export function registerAssetSelectionFunc(name: string, def: AssetSelectionFuncDef): void {
    ASSET_SELECTION_FUNCS.set(name, def);
}
export function getAssetSelectionFunc(name: string | undefined | null): AssetSelectionFuncDef | null {
    if (!name) return null;
    return ASSET_SELECTION_FUNCS.get(name) ?? null;
}
export function isAggregateAssetSelectionFunc(name: string | undefined | null): boolean {
    return getAssetSelectionFunc(name)?.agg ?? false;
}

registerAssetSelectionFunc('count', {
    agg: true,
    reduce: (values) => values.filter((v) => v !== null && v !== undefined).length,
});

registerAssetSelectionFunc('min', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => castAssetPropValueToFloat(v)), (a, b) => Math.min(a, b)),
});
registerAssetSelectionFunc('max', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => castAssetPropValueToFloat(v)), (a, b) => Math.max(a, b)),
});
registerAssetSelectionFunc('sum', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => castAssetPropValueToFloat(v)), (a, b) => a + b),
});
registerAssetSelectionFunc('avg', {
    agg: true,
    reduce: (values) => {
        const nums = numbersOrNull(values.map((v) => castAssetPropValueToFloat(v)));
        if (nums.length === 0) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
});

registerAssetSelectionFunc('min_len', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => getAssetPropValueLen(v)), (a, b) => Math.min(a, b)),
});
registerAssetSelectionFunc('max_len', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => getAssetPropValueLen(v)), (a, b) => Math.max(a, b)),
});
registerAssetSelectionFunc('sum_len', {
    agg: true,
    reduce: (values) =>
        reduceNumbers(values.map((v) => getAssetPropValueLen(v)), (a, b) => a + b),
});
registerAssetSelectionFunc('avg_len', {
    agg: true,
    reduce: (values) => {
        const nums = numbersOrNull(values.map((v) => getAssetPropValueLen(v)));
        if (nums.length === 0) return null;
        return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
});

function reduceDates(
    values: (number | null)[],
    reducer: (acc: number, cur: number) => number,
): AssetPropValue {
    const reduced = reduceNumbers(values, reducer);
    return reduced === null ? null : new Date(reduced * 1000).toISOString();
}

registerAssetSelectionFunc('min_date', {
    agg: true,
    reduce: (values) =>
        reduceDates(values.map((v) => castAssetPropValueToTimestamp(v)?.Ts ?? null), (a, b) => Math.min(a, b)),
});
registerAssetSelectionFunc('max_date', {
    agg: true,
    reduce: (values) =>
        reduceDates(values.map((v) => castAssetPropValueToTimestamp(v)?.Ts ?? null), (a, b) => Math.max(a, b)),
});
registerAssetSelectionFunc('avg_date', {
    agg: true,
    reduce: (values) => {
        const nums = numbersOrNull(values.map((v) => castAssetPropValueToTimestamp(v)?.Ts ?? null));
        if (nums.length === 0) return null;
        return new Date(nums.reduce((a, b) => a + b, 0) * 1000 / nums.length).toISOString();
    },
});

function dateParts(
    value: AssetPropsPlainObjectValue
): { date: Date; year: number; quarter: number; month: string } | null {
    const ts = castAssetPropValueToTimestamp(value);
    if (ts === null) return null;
    const date = new Date(ts.Ts * 1000);
    const monthIndex = date.getUTCMonth();
    return {
        date,
        year: date.getUTCFullYear(),
        quarter: Math.floor(monthIndex / 3) + 1,
        month: `${date.getUTCFullYear()}-${pad(monthIndex + 1, 2)}`,
    };
}

registerAssetSelectionFunc('year', {
    agg: false,
    cast: (value) => dateParts(value)?.year ?? null,
});
registerAssetSelectionFunc('month', {
    agg: false,
    cast: (value) => dateParts(value)?.month ?? null,
});
registerAssetSelectionFunc('quarter', {
    agg: false,
    cast: (value) => {
        const parts = dateParts(value);
        return parts ? `${parts.year}-Q${parts.quarter}` : null;
    },
});
registerAssetSelectionFunc('date', {
    agg: false,
    cast: (value) => {
        const parts = dateParts(value);
        return parts ? formatUtcDate(parts.date) : null;
    },
});
registerAssetSelectionFunc('datePrecise6', {
    agg: false,
    cast: (value) => {
        const parts = dateParts(value);
        if (!parts) return null;
        return `${formatUtcDateTime(parts.date)}.${pad(parts.date.getUTCMilliseconds() * 1000, 6)}Z`;
    },
});
registerAssetSelectionFunc('string', {
    agg: false,
    cast: (value) => castAssetPropPlainObjectValueToString(value),
});
registerAssetSelectionFunc('int', {
    agg: false,
    cast: (value) => {
        const double = castAssetPropValueToFloat(value);
        return double === null ? null : Math.round(double);
    },
});
registerAssetSelectionFunc('bool', {
    agg: false,
    cast: (value) => castAssetPropValueToBoolean(value),
});
registerAssetSelectionFunc('double', {
    agg: false,
    cast: (value) => castAssetPropValueToFloat(value),
});
registerAssetSelectionFunc('elapsed', {
    agg: false,
    cast: (value) => {
        const ts = castAssetPropValueToTimestamp(value);
        return ts === null ? null : (Date.now() - ts.Ts * 1000) / 1000;
    },
});
registerAssetSelectionFunc('empty', {
    agg: false,
    cast: (value) => !isFilledAssetPropValue(value as AssetPropValue),
});
registerAssetSelectionFunc('notEmpty', {
    agg: false,
    cast: (value) => isFilledAssetPropValue(value as AssetPropValue),
});

export type ResolvedSelectionField = {
    prop: string;
    func: string | null;
    as: string;
    descriptor: ProjectFileDbAssetFieldDescriptor | null;
    fieldType: AssetPropType | null;
};

export type ResolvedOrderItem = ResolvedSelectionField & {
    desc: boolean;
};

export type ResolvedGroupField = ResolvedSelectionField;

function paramError(message: string, payload: any): ApiError {
    return new ApiError(message, ApiErrorCodes.PARAM_BAD_VALUE, payload);
}

export function resolveSelectionField(field: AssetPropsSelectionField): ResolvedSelectionField {
    const prop = typeof field === 'string' ? field : field.prop;
    const func = typeof field === 'string' ? null : field.func ?? null;
    const as = typeof field === 'string' ? prop : field.as ?? prop;
    if (func && !getAssetSelectionFunc(func)) {
        throw paramError('Unknow function in asset selection', { field });
    }
    const descriptor = getFieldDescriptor(prop);
    return {
        prop,
        func,
        as,
        descriptor,
        fieldType: descriptor?.type ?? null,
    };
}

export function resolveSelectionFields(fields: AssetPropsSelectionField[]): ResolvedSelectionField[] {
    return fields.map(resolveSelectionField);
}

export function resolveOrderItems(order: AssetPropsSelectionOrder[]): ResolvedOrderItem[] {
    return order.map(order_item => {
        if (typeof order_item === 'string') {
            return { ...resolveSelectionField(order_item), desc: false };
        }
        return { ...resolveSelectionField(order_item), desc: order_item.desc ?? false };
    });
}

export function getSelectionFieldsBlocks(fields: ResolvedSelectionField[]): AssetBlockIdWithName[] {
    const blocks: AssetBlockIdWithName[] = [];
    for (const field of fields) {
        const block = field.descriptor?.block;
        if (!block) continue;
        if (!blocks.some((b) => b.blockId === block.blockId && b.blockName === block.blockName)) {
            blocks.push({ blockId: block.blockId, blockName: block.blockName });
        }
    }
    return blocks;
}

function castFieldValue(value: AssetPropsPlainObjectValue, type: AssetPropType | null): AssetPropsPlainObjectValue{
    switch (type){
        case AssetPropType.TIMESTAMP:
            return castAssetPropValueToTimestamp(value)
        case AssetPropType.STRING:
            return castAssetPropValueToString(value)
        case AssetPropType.BOOLEAN:
            return castAssetPropValueToBoolean(value)
        case AssetPropType.INTEGER:
            return castAssetPropValueToInt(value)
        case AssetPropType.FLOAT:
            return castAssetPropValueToFloat(value)
    }
    return value;
}

/**
 * Applies a non-aggregate `func` to a single value. Aggregate funcs are a
 * no-op here — they only make sense through `reduceAssetSelectionFunc`.
 */
export function applyAssetSelectionFunc(
    value: AssetPropsPlainObjectValue,
    field: Pick<ResolvedSelectionField, 'func' | 'fieldType'>,
): AssetPropsPlainObjectValue {
    const func = getAssetSelectionFunc(field.func);
    if (!func || func.agg || !func.cast) {
        return value;
    }
    return func.cast(castFieldValue(value, field.fieldType));
}

export function reduceAssetSelectionFunc(
    values: AssetPropsPlainObjectValue[],
    field: Pick<ResolvedSelectionField, 'func' | 'fieldType'>,
): AssetPropsPlainObjectValue {
    const func = getAssetSelectionFunc(field.func);
    if (!func || !func.agg || !func.reduce) {
        return values.length > 0 ? values[0] : null;
    }
    return func.reduce(values.map(v => castFieldValue(v, field.fieldType)));
}

export function computeSelectionFieldValue(
    values: AssetPropsPlainObjectValue[],
    field: ResolvedSelectionField,
): AssetPropsPlainObjectValue {
    if (isAggregateAssetSelectionFunc(field.func)) {
        return reduceAssetSelectionFunc(values, field);
    }
    return applyAssetSelectionFunc(values.length > 0 ? values[0] : null, field);
}

/**
 * compareAssetPropValues is a plain comparator (negative when a < b), so a
 * descending item has to flip its sign.
 */
export function compareValuesByOrder<T>(
    a: T,
    b: T,
    items: ResolvedOrderItem[],
    getValue: (subject: T, field: ResolvedSelectionField) => AssetPropValue,
): number {
    for (const item of items) {
        const res = compareAssetPropValues(getValue(a, item) ?? null, getValue(b, item) ?? null);
        if (res !== 0) {
            return item.desc ? -res : res;
        }
    }
    return 0;
}

export function sortByOrder<T>(
    items: T[],
    order_items: ResolvedOrderItem[],
    getValue: (subject: T, field: ResolvedSelectionField) => AssetPropValue,
): T[] {
    if (order_items.length === 0) return [...items];
    return [...items].sort((a, b) => compareValuesByOrder(a, b, order_items, getValue));
}

export type AggregateSelectionValidation = {
    groupKeys: Set<string>;
    hasAgg: boolean;
    hasNoAgg: boolean;
};

/**
 * Ports AssetSelectorQuery._checkAggMixing so bad queries fail the same way on
 * desktop as they do on the server instead of silently returning garbage.
 */
export function validateAggregateSelection(
    group: ResolvedSelectionField[],
    select: ResolvedSelectionField[],
    order: ResolvedSelectionField[],
): AggregateSelectionValidation {
    const groupKeys = new Set<string>();
    for (const g of group) {
        if (isAggregateAssetSelectionFunc(g.func)) {
            throw paramError('Group cannot contain agg funcitons', { field: g.prop });
        }
        groupKeys.add(`\\${g.prop}`);
    }

    const res: AggregateSelectionValidation = { groupKeys, hasAgg: false, hasNoAgg: false };
    for (const sel of [...select, ...order]) {
        const func = getAssetSelectionFunc(sel.func);
        if (func && func.agg) {
            res.hasAgg = true;
            continue;
        }
        res.hasNoAgg = true;
        if (group.length > 0 && !groupKeys.has(`\\${sel.prop}`)) {
            throw paramError('Cannot use not aggregated prop with group', { field: sel.prop });
        }
    }
    if (group.length === 0 && res.hasAgg && res.hasNoAgg) {
        throw paramError('Cannot use both aggregated values and not without group', {});
    }
    return res;
}

export function selectionIsFullyAggregate(fields: ResolvedSelectionField[]): boolean {
    return fields.length > 0 && fields.every((f) => isAggregateAssetSelectionFunc(f.func));
}

export function selectionOrderOrDefault(
    order: AssetPropsSelectionBase['order'],
    default_order: AssetPropsSelectionOrder[],
): AssetPropsSelectionOrder[] {
    return order && order.length > 0 ? order : default_order;
}
