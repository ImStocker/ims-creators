import { AssetPropType, isFilledAssetPropValue, type AssetProps, type AssetPropsPlainObject, type AssetPropsPlainObjectValue, type AssetPropValue } from '~ims-app-base/logic/types/Props';
import { getEntityFieldValue, getFieldDescriptor, readFieldDescriptorValue } from '../asset-fields';
import type { ProjectFileDbAsset, ProjectFileDbAssetBlock } from '../ProjectFileDb';
import {
    applyAssetSelectionFunc,
    computeSelectionFieldValue,
    getSelectionFieldsBlocks,
    isAggregateAssetSelectionFunc,
    resolveOrderItems,
    resolveSelectionField,
    selectionIsFullyAggregate,
    sortByOrder,
    validateAggregateSelection,
} from './asset-selection';

const BLOCK_ID = '00000000-0000-0000-0000-350000000003';

function makeBlock(name: string, computed: AssetProps): ProjectFileDbAssetBlock {
    return {
        id: BLOCK_ID,
        type: 'props',
        name,
        title: null,
        index: 0,
        createdAt: '',
        updatedAt: '',
        ownTitle: null,
        own: true,
        props: {},
        computed,
        inherited: null,
    };
}

function makeAsset(props: {
    id: string,
    title?: string,
    index?: number | null,
    createdAt?: string,
    blocks?: ProjectFileDbAssetBlock[],
}): ProjectFileDbAsset {
    return {
        id: props.id,
        projectId: 'EWvDFxqn',
        typeIds: [],
        parentIds: [],
        ownTitle: props.title ?? null,
        ownIcon: null,
        name: null,
        icon: null,
        isAbstract: false,
        workspaceId: null,
        createdAt: props.createdAt ?? '2025-01-01T00:00:00.000Z',
        updatedAt: props.createdAt ?? '2025-01-01T00:00:00.000Z',
        deletedAt: null,
        creatorUserId: null,
        unread: 0,
        rights: 5,
        title: props.title ?? null,
        index: props.index ?? null,
        lastViewedAt: null,
        hasImage: false,
        blocks: props.blocks ?? [],
        comments: [],
        references: [],
    };
}

/** Mirrors the abilities from the test project: cooldown lives in the `props` block. */
function makeAbilityAsset(id: string, title: string, cooldown: number): ProjectFileDbAsset {
    return makeAsset({
        id,
        title,
        blocks: [makeBlock('props', { cooldown })],
    });
}

function resolveField(prop: string, func?: string) {
    return func ? resolveSelectionField({ prop, func }) : resolveSelectionField(prop);
}

describe('getFieldDescriptor', () => {
    test('resolves known asset fields case-insensitively', () => {
        expect(getFieldDescriptor('createdAt')).toMatchObject({
            jsonName: 'createdAt',
            assetName: 'createdat',
        });
        expect(getFieldDescriptor('createdat')).toMatchObject({ jsonName: 'createdAt' });
        expect(getFieldDescriptor('isAbstract')).toMatchObject({ jsonName: 'isAbstract' });
        expect(getFieldDescriptor('workspaceid')).toMatchObject({ jsonName: 'workspaceId' });
        expect(getFieldDescriptor('typeids')).toMatchObject({ jsonName: 'typeIds' });
    });

    test('resolves block prop refs and exposes the block they need', () => {
        const by_name = getFieldDescriptor('props|cooldown');
        expect(by_name?.block).toEqual({ blockId: null, blockName: 'props' });
        expect(by_name?.propKey).toBe('cooldown');

        const by_id = getFieldDescriptor(`props@${BLOCK_ID}|cooldown`);
        expect(by_id?.block).toEqual({ blockId: BLOCK_ID, blockName: 'props' });

        expect(getFieldDescriptor('gallery|main\\value')?.propKey).toBe('main\\value');
    });

    test('returns null instead of throwing for names that are neither', () => {
        expect(getFieldDescriptor('unknown_field')).toBeNull();
        expect(getFieldDescriptor('query')).toBeNull();
        expect(getFieldDescriptor('')).toBeNull();
        // not a `block|prop` ref at all
        expect(getFieldDescriptor('props')).toBeNull();
    });

    test('a bare `block|` ref resolves to the whole block props', () => {
        expect(getFieldDescriptor('props|')).toMatchObject({
            block: { blockId: null, blockName: 'props' },
            propKey: '',
        });
    });

    test('reads block values out of block.computed', () => {
        const ability = makeAbilityAsset('a1', 'Fire Volley', 300);
        expect(readFieldDescriptorValue(ability, getFieldDescriptor('props|cooldown'))).toBe(300);
        expect(readFieldDescriptorValue(ability, getFieldDescriptor('props|missing'))).toBeNull();
        expect(readFieldDescriptorValue(ability, getFieldDescriptor('title'))).toBe('Fire Volley');
        expect(readFieldDescriptorValue(ability, null)).toBeNull();
    });
});

describe('getEntityFieldValue', () => {
    test('reads known asset fields, block props and unknown names', () => {
        const ability = makeAbilityAsset('a1', 'Fire Volley', 300);
        expect(getEntityFieldValue(ability, 'id')).toBe('a1');
        expect(getEntityFieldValue(ability, 'title')).toBe('Fire Volley');
        expect(getEntityFieldValue(ability, 'createdat')).toBe('2025-01-01T00:00:00.000Z');
        expect(getEntityFieldValue(ability, 'props|cooldown')).toBe(300);
        // nothing to read and nothing to fall back to
        expect(getEntityFieldValue(ability, 'nothing_like_this')).toBeNull();
    });

    test('falls back to a plain property read for non-asset fields', () => {
        // workspaces are sorted through this helper and carry fields that are
        // not asset fields, e.g. parentId / localName
        const workspace = { parentId: 'w-parent', localName: 'Abilities.imw.json' };
        expect(getEntityFieldValue(workspace as any, 'parentId')).toBe('w-parent');
        expect(getEntityFieldValue(workspace as any, 'localName')).toBe('Abilities.imw.json');
        expect(getEntityFieldValue(workspace as any, 'missing')).toBeNull();
    });
});

describe('ordering', () => {
    test('ascending is ascending and desc is the mirror image', () => {
        // compareAssetPropValues already returns negative when a < b, so the
        // descending branch has to flip the sign. Getting this backwards made
        // desc sort exactly like asc.
        const value = (item: { v: AssetPropValue }) => item.v;
        const asc = (items: { v: AssetPropValue }[]) =>
            sortByOrder(items, resolveOrderItems(['x']), value).map((i) => i.v);
        const desc = (items: { v: AssetPropValue }[]) =>
            sortByOrder(items, resolveOrderItems([{ prop: 'x', desc: true }]), value).map((i) => i.v);

        const numbers: { v: AssetPropValue }[] = [{ v: 10 }, { v: 2 }, { v: null }, { v: 3 }];
        expect(asc(numbers)).toEqual([2, 3, 10, null]);
        expect(desc(numbers)).toEqual([null, 10, 3, 2]);

        const strings: { v: AssetPropValue }[] = [{ v: 'Zeta' }, { v: 'alpha' }, { v: null }, { v: 'Beta' }];
        expect(asc(strings)).toEqual(['alpha', 'Beta', 'Zeta', null]);
        expect(desc(strings)).toEqual([null, 'Zeta', 'Beta', 'alpha']);

        expect(asc(strings)).not.toEqual(desc(strings));
    });

    test('sorts assets by a block prop in both directions', () => {
        const abilities = [
            makeAbilityAsset('a4', 'Ice Armor', 400),
            makeAbilityAsset('a6', 'Phantom Roar', 50),
            makeAbilityAsset('a1', 'Fire Volley', 300),
            makeAbilityAsset('a2', 'Frost Spike', 350),
        ];
        const order_field = resolveField('props|cooldown');

        const by_asc = sortByOrder(abilities, resolveOrderItems([{ prop: 'props|cooldown' }]),
            (asset, field) => readFieldDescriptorValue(asset, field.descriptor));
        expect(by_asc.map((a) => a.title)).toEqual(['Phantom Roar', 'Fire Volley', 'Frost Spike', 'Ice Armor']);

        const by_desc = sortByOrder(abilities, resolveOrderItems([{ prop: 'props|cooldown', desc: true }]),
            (asset, field) => readFieldDescriptorValue(asset, field.descriptor));
        expect(by_desc.map((a) => a.title)).toEqual(['Ice Armor', 'Frost Spike', 'Fire Volley', 'Phantom Roar']);
        expect(order_field.descriptor?.block).toEqual({ blockId: null, blockName: 'props' });
    });

    test('falls through to the next order item when values are equal', () => {
        const assets = [
            makeAsset({ id: 'x', title: 'B' }),
            makeAsset({ id: 'y', title: 'A' }),
            makeAsset({ id: 'z', title: 'C' }),
        ];
        assets[0].index = 1;
        assets[1].index = 1;
        assets[2].index = 0;
        const sorted = sortByOrder(assets, resolveOrderItems(['index', 'title']),
            (asset, field) => readFieldDescriptorValue(asset, field.descriptor));
        expect(sorted.map((a) => a.title)).toEqual(['C', 'A', 'B']);
    });

    test('keeps input order when there is nothing to sort by', () => {
        const assets = [makeAsset({ id: 'x', title: 'B' }), makeAsset({ id: 'y', title: 'A' })];
        const sorted = sortByOrder(assets, [], () => null);
        expect(sorted.map((a) => a.title)).toEqual(['B', 'A']);
        expect(assets.map((a) => a.title)).toEqual(['B', 'A']);
    });

    test('collects the blocks needed to resolve order fields', () => {
        const items = resolveOrderItems([
            'index',
            { prop: 'props|cooldown' },
            { prop: `props@${BLOCK_ID}|damage` },
        ]);
        expect(getSelectionFieldsBlocks(items)).toEqual([
            { blockId: null, blockName: 'props' },
            { blockId: BLOCK_ID, blockName: 'props' },
        ]);
        expect(getSelectionFieldsBlocks(resolveOrderItems(['title', 'index']))).toEqual([]);
    });
});

describe('value casts (block props vs declared column types)', () => {
    // a block prop has no declared type (null) and takes it from the value
    const block_prop = resolveField('props|x').fieldType;
    // a column field reports its declared type
    const column = resolveField('index').fieldType;

    test('a block prop has no declared type, a column field does', () => {
        expect(block_prop).toBeNull();
        expect(column).toBe(AssetPropType.INTEGER);
        expect(getFieldDescriptor('props|cooldown')?.type).toBeNull();
        expect(getFieldDescriptor('index')?.type).toBe(AssetPropType.INTEGER);
    });

    test('isFilled (shared isFilledAssetPropValue)', () => {
        expect(isFilledAssetPropValue(0)).toBe(true);
        expect(isFilledAssetPropValue(false)).toBe(true);
        expect(isFilledAssetPropValue('')).toBe(false);
        expect(isFilledAssetPropValue('   ')).toBe(false);   // trimmed, unlike imc_is_filled
        expect(isFilledAssetPropValue([0])).toBe(true);
        expect(isFilledAssetPropValue([])).toBe(false);
        expect(isFilledAssetPropValue(null)).toBe(false);
        expect(isFilledAssetPropValue({ Str: '', Ops: [] })).toBe(false); // TEXT is inspected
        expect(isFilledAssetPropValue({ FileId: 'f', Title: 'a', Size: 1, Dir: null, Store: 's' })).toBe(true);
    });
});

describe('selection funcs', () => {
    const num = (value: AssetPropsPlainObjectValue, func: string) =>
        applyAssetSelectionFunc(value, resolveField('props|x', func));

    test('scalar funcs', () => {
        expect(num(300, 'string')).toBe('300');
        expect(num('12.7', 'double')).toBe(12.7);
        expect(num(12.6, 'int')).toBe(13);
        expect(num(0, 'bool')).toBe(false);
        expect(num(1, 'bool')).toBe(true);
        // castAssetPropValueToBoolean folds a missing value into false; the
        // server's imc_to_boolean would return NULL here
        expect(num(null, 'bool')).toBe(false);
        expect(num({}, 'bool')).toBe(true);
        expect(num('', 'notEmpty')).toBe(false);
        expect(num(0, 'notEmpty')).toBe(true);
        expect(num('', 'empty')).toBe(true);
        expect(num(0, 'empty')).toBe(false);
        expect(num(null, 'notEmpty')).toBe(false);
        expect(num(null, 'empty')).toBe(true);
    });

    test('date funcs', () => {
        const ts = '2026-01-02T03:04:05.500Z';
        expect(num(ts, 'year')).toBe(2026);
        expect(num(ts, 'month')).toBe('2026-01');
        expect(num(ts, 'quarter')).toBe('2026-Q1');
        expect(num(ts, 'date')).toBe('2026-01-02');
        expect(num(ts, 'datePrecise6')).toBe('2026-01-02T03:04:05.500000Z');
        expect(num(null, 'year')).toBeNull();
        expect(num(null, 'date')).toBeNull();

        const before = Date.now();
        const elapsed = num('2020-01-01T00:00:00.000Z', 'elapsed') as number;
        expect(elapsed).toBeGreaterThanOrEqual((before - Date.parse('2020-01-01T00:00:00.000Z')) / 1000);
        expect(num(null, 'elapsed')).toBeNull();
    });

    test('unknown funcs are rejected like the server does', () => {
        expect(() => resolveField('props|x', 'definitely_not_a_func')).toThrow(/Unknow function/);
    });
});

describe('aggregate funcs', () => {
    const agg = (values: AssetPropValue[], func: string) =>
        computeSelectionFieldValue(values, resolveField('props|x', func));

    test('count/sum/min/max/avg', () => {
        expect(agg([1, 2, null, 3], 'count')).toBe(3);
        expect(agg([1, 2, 3], 'sum')).toBe(6);
        expect(agg([1, 2, 3], 'min')).toBe(1);
        expect(agg([1, 2, 3], 'max')).toBe(3);
        expect(agg([1, 2, 3], 'avg')).toBe(2);
        expect(agg(['2', '4'], 'sum')).toBe(6);
    });

    test('empty result set behaves like SQL', () => {
        expect(agg([], 'count')).toBe(0);
        expect(agg([], 'sum')).toBeNull();
        expect(agg([], 'min')).toBeNull();
        expect(agg([], 'avg')).toBeNull();
        expect(agg([null, null], 'count')).toBe(0);
        expect(agg([null, null], 'sum')).toBeNull();
    });

    test('len funcs skip values with no length', () => {
        expect(agg(['ab', 'abcd', null], 'min_len')).toBe(2);
        expect(agg(['ab', 'abcd'], 'max_len')).toBe(4);
        expect(agg(['ab', 'abcd'], 'sum_len')).toBe(6);
        expect(agg(['ab', 'abcd'], 'avg_len')).toBe(3);
        expect(agg([null, null], 'sum_len')).toBeNull();
    });

    test('date funcs', () => {
        expect(agg(['2026-01-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z'], 'min_date'))
            .toBe('2026-01-02T00:00:00.000Z');
        expect(agg(['2026-01-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z'], 'max_date'))
            .toBe('2026-05-02T00:00:00.000Z');
        expect(agg(['2026-01-02T00:00:00.000Z'], 'avg_date')).toBe('2026-01-02T00:00:00.000Z');
        expect(agg([], 'min_date')).toBeNull();
    });

    test('aggregate funcs are flagged as aggregate', () => {
        expect(isAggregateAssetSelectionFunc('count')).toBe(true);
        expect(isAggregateAssetSelectionFunc('sum')).toBe(true);
        expect(isAggregateAssetSelectionFunc('min_len')).toBe(true);
        expect(isAggregateAssetSelectionFunc('notEmpty')).toBe(false);
        expect(isAggregateAssetSelectionFunc(null)).toBe(false);
    });
});

describe('grouping', () => {
    test('accepts a query that only selects aggregates', () => {
        const select = [resolveField('id', 'count'), resolveField('__meta|complete_comp', 'sum')];
        expect(selectionIsFullyAggregate(select)).toBe(true);
        expect(() => validateAggregateSelection([], select, [])).not.toThrow();
    });

    test('rejects mixing aggregates with plain fields', () => {
        expect(() => validateAggregateSelection(
            [],
            [resolveField('id'), resolveField('__meta|complete_comp', 'sum')],
            [],
        )).toThrow(/Cannot use both aggregated values and not without group/);
    });

    test('requires plain select fields to be part of the group', () => {
        expect(() => validateAggregateSelection(
            [resolveField('workspaceid')],
            [resolveField('workspaceid'), resolveField('id', 'count')],
            [],
        )).not.toThrow();
        expect(() => validateAggregateSelection(
            [resolveField('workspaceid')],
            [resolveField('title')],
            [],
        )).toThrow(/Cannot use not aggregated prop with group/);
    });

    test('rejects aggregates inside group', () => {
        expect(() => validateAggregateSelection([resolveField('id', 'count')], [], []))
            .toThrow(/Group cannot contain agg funcitons/);
    });
});

describe('applyAssetSelectionFunc on non-aggregate fields', () => {
    test('a field without func is passed through untouched', () => {
        const field = resolveField('props|cooldown');
        expect(applyAssetSelectionFunc(300, field)).toBe(300);
        expect(computeSelectionFieldValue([300, 400], field)).toBe(300);
    });

    test('an aggregate func on a field with a single value reduces over one value', () => {
        expect(computeSelectionFieldValue([300], resolveField('props|cooldown', 'count'))).toBe(1);
        expect(computeSelectionFieldValue([], resolveField('props|cooldown', 'count'))).toBe(0);
    });

    test('descriptor type is used for column casts', () => {
        expect(resolveField('index').fieldType).toBe(AssetPropType.INTEGER);
        expect(resolveField('isabstract').fieldType).toBe(AssetPropType.BOOLEAN);
        expect(resolveField('typeids').fieldType).toBe(AssetPropType.ARRAY);
    });
});
