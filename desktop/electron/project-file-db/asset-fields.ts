import {
    AssetPropType,
    parseAssetNewBlockPropKeyRef,
    extractSubObjectAsPlainValue,
    type AssetBlockIdWithName,
    type AssetPropsPlainObjectValue,
    type AssetPropValue,
} from "~ims-app-base/logic/types/Props"
import type { ProjectFileDbAsset } from "./ProjectFileDb"

export type ProjectFileDbAssetFieldDescriptor = {
    jsonName?: string,
    assetName: string,
    /**
     * Declared column type. `null` for `block|prop` fields: those have no
     * declared type, so the type is taken from the value at read time.
     */
    type: AssetPropType | null,
    /**
     * Present only for `block|prop` fields. Lets callers batch-resolve the
     * blocks a query actually needs before reading values out of them.
     */
    block?: AssetBlockIdWithName,
    propKey?: string,
    get?: (asset: ProjectFileDbAsset) => AssetPropsPlainObjectValue

}

export const ASSET_FIELD_DESCRIPTORS: ProjectFileDbAssetFieldDescriptor[] = [
    {
        jsonName: 'id',
        assetName: 'id',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'createdAt',
        assetName: 'createdat',
        type: AssetPropType.TIMESTAMP,
    },
    {
        jsonName: 'icon',
        assetName: 'icon',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'ownIcon',
        assetName: 'ownicon',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'isAbstract',
        assetName: 'isabstract',
        type: AssetPropType.BOOLEAN,
    },
    {
        jsonName: 'name',
        assetName: 'name',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'typeIds',
        assetName: 'typeids',
        type: AssetPropType.ARRAY,
    },
    {
        assetName: 'unread',
        type: AssetPropType.INTEGER,
        get: (asset) => 0,
    },
    {
        jsonName: 'rights',
        assetName: 'rights',
        type: AssetPropType.INTEGER,
    },
    {
        jsonName: 'deletedAt',
        assetName: 'deletedat',
        type: AssetPropType.TIMESTAMP,
    },
    {
        jsonName: 'title',
        assetName: 'title',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'ownTitle',
        assetName: 'owntitle',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'updatedAt',
        assetName: 'updatedat',
        type: AssetPropType.TIMESTAMP,
    },
    {
        jsonName: 'workspaceId',
        assetName: 'workspaceid',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'index',
        assetName: 'index',
        type: AssetPropType.INTEGER,
    },
    {
        jsonName: 'creatorUserId',
        assetName: 'creatoruserid',
        type: AssetPropType.STRING,
    },
    {
        jsonName: 'projectId',
        assetName: 'projectid',
        type: AssetPropType.STRING,
    },
    /*{
        jsonName: 'hasImage',
        assetName: 'hasImage',
        type: AssetPropType.BOOLEAN,
    },*/
]

const ASSET_FIELD_DESCRIPTORS_MAP = new Map<string, ProjectFileDbAssetFieldDescriptor>();
for (const descriptor of ASSET_FIELD_DESCRIPTORS) {
    ASSET_FIELD_DESCRIPTORS_MAP.set(descriptor.assetName, descriptor);
}

function makeBlockFieldDescriptor(prop: string): ProjectFileDbAssetFieldDescriptor | null {
    if (!prop.includes('|')) {
        return null;
    }
    let parsed_prop: ReturnType<typeof parseAssetNewBlockPropKeyRef>;
    try {
        parsed_prop = parseAssetNewBlockPropKeyRef(prop);
    }
    catch {
        return null;
    }
    return {
        assetName: prop,
        type: null,
        block: {
            blockId: parsed_prop.blockId,
            blockName: parsed_prop.blockName,
        },
        propKey: parsed_prop.propKey,
        get: (asset) => {
            const block = asset.blocks.find(block => {
                if (parsed_prop.blockId) {
                    return block.id === parsed_prop.blockId;
                }
                else if (parsed_prop.blockName) {
                    return block.name === parsed_prop.blockName;
                }
                return false;
            });
            if (block) {
                // computed is stored assigned — extract the leaf back to plain
                return extractSubObjectAsPlainValue(
                    block.computed ?? {},
                    parsed_prop.propKey,
                );
            }
            return null;
        },
    };
}

/**
 * Resolves any asset field name accepted by the API: a known asset field
 * (case-insensitively, like the server does) or a `block|prop` reference.
 * Returns null for names that match neither, so callers can decide what to do
 * instead of getting an exception out of a plain lookup miss.
 */
export function getFieldDescriptor(prop: string): ProjectFileDbAssetFieldDescriptor | null {
    const exact = ASSET_FIELD_DESCRIPTORS_MAP.get(prop);
    if (exact) {
        return exact;
    }
    const insensitive = ASSET_FIELD_DESCRIPTORS_MAP.get(prop.toLowerCase());
    if (insensitive) {
        return insensitive;
    }
    return makeBlockFieldDescriptor(prop);
}

export function readFieldDescriptorValue(
    asset: ProjectFileDbAsset,
    descriptor: ProjectFileDbAssetFieldDescriptor | null,
): AssetPropsPlainObjectValue {
    if (!descriptor) return null;
    if (descriptor.get) {
        return descriptor.get(asset);
    }
    if (descriptor.jsonName) {
        return (asset as any)[descriptor.jsonName];
    }
    return null;
}

/**
 * Reads a named field off any row-like entity — an asset or a workspace.
 *
 * Known field names go through the descriptor table, which is also what
 * resolves `block|prop` references. Workspaces carry fields that are not asset
 * fields (parentId, localName, ...), so an unrecognised name falls back to a
 * plain property read instead of resolving to null.
 */
export function getEntityFieldValue(
    entity: ProjectFileDbAsset,
    field: string,
): AssetPropValue {
    const descriptor = getFieldDescriptor(field);
    if (descriptor) {
        return readFieldDescriptorValue(entity, descriptor) as AssetPropValue;
    }
    return (entity as unknown as Record<string, AssetPropValue>)[field] ?? null;
}
