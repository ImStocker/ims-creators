import CreatorAssetManager from "~ims-app-base/logic/managers/CreatorAssetManager";

export class DesktopCreatorAssetManager extends CreatorAssetManager {
    setProjectIdToFiles(projectId: string) {
        const entities = [
            this._shortAssetsCache ?? null,
            this._fullAssetsCache ?? null,
            this._workspacesCache ?? null
        ];
        for(const entity of entities){
            if(entity) {
                for(let item of entity.entries()){
                    if(item.value) {
                        item.value.projectId = projectId;
                    }
                }  
            }
        }
    }

}