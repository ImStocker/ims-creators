import { AssetPropType, parseAssetNewBlockPropKeyRef, extractSubObjectAsPlainValue, type AssetPropsPlainObjectValue } from "~ims-app-base/logic/types/Props"
import type { ProjectFileDbAsset } from "./ProjectFileDb"

export type ProjectFileDbAssetFieldDescriptor = {
    jsonName?: string,
    assetName: string,
    type: AssetPropType
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
        jsonName: 'isAbstract',
        assetName: 'isAbstract',
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

export function getFieldDescriptor(prop: string): ProjectFileDbAssetFieldDescriptor | null {
    const ind = ASSET_FIELD_DESCRIPTORS.findIndex(item => item.assetName === prop);
    if(ind > -1) {
        return ASSET_FIELD_DESCRIPTORS[ind];
    }
    else {
        const parsed_prop = parseAssetNewBlockPropKeyRef(prop);
        return {
            assetName: prop,
            type: AssetPropType.STRING,
            get: (asset) => {
                const block = asset.blocks.find(block => {
                    if(parsed_prop.blockId) {
                        return block.id === parsed_prop.blockId;
                    }
                    else if(parsed_prop.blockName){
                        return block.name === parsed_prop.blockName;
                    }
                });
                if (block) {
                    // computed is stored assigned — extract the leaf back to plain
                    const value = extractSubObjectAsPlainValue(
                        block.computed ?? {},
                        parsed_prop.propKey,
                    );
                    return value;
                }
                return null;
                
            },
        }
    }

}