export type ProjectFileDbEntity = {
    id: string,
    name: string | null
}

export class ProjectFileDbCollection<T extends ProjectFileDbEntity>{
    byId = new Map<string, T>();
    byName = new Map<string, T>();

    clear(){
        this.byId = new Map<string, T>();
        this.byName = new Map<string, T>();
    }

    delete(id: string){
        const entity = this.byId.get(id);
        if (entity) {
            this.byId.delete(id);
            if (entity?.name){
                this.byName.delete(entity.name)
            }
        }
    }

    replace(entity: T){
        const existing = this.byId.get(entity.id);
        if (existing?.name && existing.name !== entity.name) {
            this.byName.delete(existing.name)
        }
        this.byId.set(entity.id, entity);
        if (entity.name) {
            this.byName.set(entity.name, entity)
        }
    }

    deleteMany(deleting_ids: string[]){
        for(const id of deleting_ids){
            this.delete(id);
        }
    }

    add(entity: T){
        this.byId.set(entity.id, entity);
        if (entity.name) {
            this.byName.set(entity.name, entity)
        }
    }
    
    addMany(entities: T[]){
        for (const entity of entities){
            this.add(entity)
        }
    }

    *iterate(): Generator<T> {
        for (const entity of this.byId.values()){
            yield entity
        }
    }
}