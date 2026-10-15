import { AssetPropWhereOpKind } from '~ims-app-base/logic/types/PropsWhere';
import { AssetPropType, type AssetProps } from '~ims-app-base/logic/types/Props';
import { resolveSelectionField } from './asset-selection';
import type { ProjectFileDbAsset, ProjectFileDbAssetBlock } from '../ProjectFileDb';
import { AssetSearchFilter } from './AssetSearchFilter';

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
        computedAt: '2025-01-01T00:00:00.000Z',
    };
}

function makeAsset(id: string, title: string, props: AssetProps): ProjectFileDbAsset {
    return {
        id,
        projectId: 'EWvDFxqn',
        typeIds: [],
        parentIds: [],
        ownTitle: title,
        ownIcon: null,
        name: null,
        icon: null,
        isAbstract: false,
        workspaceId: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        deletedAt: null,
        creatorUserId: null,
        unread: 0,
        rights: 5,
        title,
        index: null,
        lastViewedAt: null,
        hasImage: false,
        blocks: [makeBlock('props', props)],
        comments: [],
        references: [],
    };
}

/**
 * Stands in for ProjectFileDb: AssetSearchFilter only needs computeFullAsset to
 * return the asset it was given (the test fixtures already carry `computed`).
 */
const db_stub = {
    asset: {
        computeFullAsset: async (asset: ProjectFileDbAsset) => asset,
    },
} as unknown as Parameters<typeof AssetSearchFilter.Create>[1];

async function filterIds(where: Record<string, unknown>): Promise<string[]> {
    const filter = await AssetSearchFilter.Create(where as never, db_stub);
    const assets = [
        makeAsset('tracked', 'Tracked', { complete_track: true, name: 'Fire Volley', tags: [0, 1, 2] }),
        makeAsset('untracked', 'Untracked', { complete_track: false, name: 'fire bolt', tags: [0] }),
        makeAsset('nameless', 'Nameless', { tags: [] }),
    ];
    const result = await filter.apply(assets);
    return result.map((asset) => asset.id);
}

/**
 * A sub-object like `gallery|main` is a plain JS object with no prop type of
 * its own, so getAssetPropType returns undefined for it.
 */
async function filterObjectPropIds(op: string, v: unknown): Promise<string[]> {
    const filter = await AssetSearchFilter.Create({
        'props|main': { op, v },
    } as never, db_stub);
    const assets = [
        makeAsset('with_image', 'With image', {
            main: { type: 'file', index: 1, value: { FileId: 'f1', Title: 'a.png', Size: 10, Dir: null, Store: 's' } },
        }),
        makeAsset('without_image', 'Without image', {}),
    ];
    return (await filter.apply(assets)).map((asset) => asset.id);
}

describe('AssetSearchFilter where operators on block props', () => {
    test('CHECKED was unsupported before and now works', async () => {
        expect(await filterIds({
            'props|complete_track': { op: AssetPropWhereOpKind.CHECKED, v: true },
        })).toEqual(['tracked']);

        // a missing or false value is simply not checked
        expect(await filterIds({
            'props|complete_track': { op: AssetPropWhereOpKind.CHECKED, v: false },
        })).toEqual(['untracked', 'nameless']);
    });

    test('CHECKED works on values that are not booleans', async () => {
        // imc_to_boolean(jsonb array) is true regardless of the array length
        expect(await filterIds({
            'props|tags': { op: AssetPropWhereOpKind.CHECKED, v: true },
        })).toEqual(['tracked', 'untracked', 'nameless']);
    });

    test('EMPTY / notEmpty', async () => {
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.EMPTY, v: true },
        })).toEqual(['nameless']);

        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.EMPTY, v: false },
        })).toEqual(['tracked', 'untracked']);
    });

    test('LIKE is a case insensitive substring match', async () => {
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.LIKE, v: 'FIRE' },
        })).toEqual(['tracked', 'untracked']);

        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.LIKE_NOT, v: 'fire' },
        })).toEqual(['nameless']);
    });

    test('LIKE does not treat the pattern as a regexp', async () => {
        // 'Fire.Volley' as a regex would match, as a literal it must not
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.LIKE, v: 'Fire.Volley' },
        })).toEqual([]);
    });

    test('MATCH is a regexp match', async () => {
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.MATCH, v: '^Fire' },
        })).toEqual(['tracked']);
    });

    test('ANY / ANY_NOT', async () => {
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.ANY, v: ['Fire Volley'] },
        })).toEqual(['tracked']);

        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.ANY_NOT, v: ['Fire Volley'] },
        })).toEqual(['untracked', 'nameless']);
    });

    test('LEN_* uses imc_len, so only arrays and strings have a length', async () => {
        expect(await filterIds({
            'props|tags': { op: AssetPropWhereOpKind.LEN_EQUAL, v: 3 },
        })).toEqual(['tracked']);

        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.LEN_MORE, v: 4 },
        })).toEqual(['tracked', 'untracked']);

        // numbers have no length in a block prop, so no LEN_* condition can match
        expect(await filterIds({
            'props|complete_track': { op: AssetPropWhereOpKind.LEN_EQUAL, v: 4 },
        })).toEqual([]);
    });

    test('operand props compare two fields', async () => {
        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.EQUAL, v: { prop: 'props|tags' } },
        })).toEqual([]);

        expect(await filterIds({
            'props|name': { op: AssetPropWhereOpKind.EQUAL_NOT, v: { prop: 'props|tags' } },
        })).toEqual(['tracked', 'untracked', 'nameless']);
    });

    test('comparison operators keep working on typed values', async () => {
        expect(await filterIds({ 'props|name': 'Fire Volley' })).toEqual(['tracked']);
        expect(await filterIds({ 'props|name': { op: AssetPropWhereOpKind.LIKE, v: 'zzz' } })).toEqual([]);
    });
});

describe('AssetSearchFilter on untyped (sub-object) values', () => {
    test('EMPTY / CHECKED treat an object as filled', async () => {
        // imc_is_filled(jsonb object) => true, imc_to_boolean(jsonb object) => true
        expect(await filterObjectPropIds(AssetPropWhereOpKind.EMPTY, true)).toEqual(['without_image']);
        expect(await filterObjectPropIds(AssetPropWhereOpKind.EMPTY, false)).toEqual(['with_image']);
        expect(await filterObjectPropIds(AssetPropWhereOpKind.CHECKED, true)).toEqual(['with_image']);
    });

    test('comparison operators never match an object', async () => {
        // compareAssetPropValues has no ordering for a value with no prop type,
        // so with_image (an object) must not be reported as EQUAL/LESS/MORE
        // anything. without_image is absent rather than untyped, so it does take
        // part in ordinary comparisons.
        for (const [op, v] of [
            [AssetPropWhereOpKind.EQUAL, 'x'],
            [AssetPropWhereOpKind.EQUAL_NOT, 'x'],
            [AssetPropWhereOpKind.LESS, 5],
            [AssetPropWhereOpKind.MORE, 5],
        ] as [string, unknown][]) {
            expect(await filterObjectPropIds(op, v)).not.toContain('with_image');
        }
        expect(await filterObjectPropIds(AssetPropWhereOpKind.EQUAL, 'x')).toEqual([]);
        expect(await filterObjectPropIds(AssetPropWhereOpKind.EQUAL_NOT, 'x')).toEqual(['without_image']);
        expect(await filterObjectPropIds(AssetPropWhereOpKind.LESS, 5)).toEqual(['without_image']);
        expect(await filterObjectPropIds(AssetPropWhereOpKind.MORE, 5)).toEqual([]);
    });
});

describe('AssetSearchFilter operand blocks', () => {
    test('registers the block of a block-prop operand so it gets computed', async () => {
        const asked_for: unknown[] = [];
        const db = {
            asset: {
                computeFullAsset: async (asset: ProjectFileDbAsset, blocks: unknown) => {
                    asked_for.push(blocks);
                    return asset;
                },
            },
        } as unknown as Parameters<typeof AssetSearchFilter.Create>[1];

        const filter = await AssetSearchFilter.Create({
            // value lives in the `props` block, operand lives in `gallery`
            'props|name': { op: AssetPropWhereOpKind.EQUAL, v: { prop: 'gallery|title' } },
        } as never, db);

        expect(filter).toBeTruthy();
        await filter.apply([
            makeAsset('a', 'A', { name: 'x' }),
        ]);
        expect(asked_for[0]).toEqual([
            { blockId: null, blockName: 'props' },
            { blockId: null, blockName: 'gallery' },
        ]);
    });
});

describe('asset-fields value reads used by operand props', () => {
    test('a plain asset field operand resolves through the field descriptor', () => {
        // guards the non-block branch of AssetSearchFilter._readOperandValue
        const field = resolveSelectionField('title');
        expect(field.descriptor?.jsonName).toBe('title');
        expect(field.fieldType).toBe(AssetPropType.STRING);
    });
});
