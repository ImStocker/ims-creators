import TaskManager, { type TaskBoardColumn } from "~ims-app-base/logic/managers/TaskManager";
import type { AssetSetDTO } from "~ims-app-base/logic/types/AssetsType";
import type { TaskEntity, TaskQueryDTOWhere } from "~ims-app-base/logic/types/BoardTypes";
import type { AssetPropValueAccount } from "~ims-app-base/logic/types/Props";

export default class DesktopTaskManager extends TaskManager {
    override async getTaskViaCache(id: string): Promise<TaskEntity | null> {
        return null;
    }
    override getTaskViaCacheSync(id: string): TaskEntity | null | undefined {
        return null;
    }
    override async requestTasksInCache(ids: string[]): Promise<void> {
    }
    override async requestTaskInCache(id: string): Promise<void> {
        
    }
    override setTaskIsCompleted(id: string, val: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    override setTasksAreCompleted(
        filter: { ids: string[] }, 
        val: boolean
    ): Promise<void> {
        throw new Error("Method not implemented.");
    }
    override showCreateTaskDialog(options?: AssetSetDTO, post_created_hook?: (task: TaskEntity) => Promise<void>): Promise<TaskEntity | undefined> {
        throw new Error("Method not implemented.");
    }
    override openTaskPreviewDialog(taskId: string, options: { deleteRef?: (silent?: boolean) => Promise<boolean> | boolean; }): Promise<void> {
        throw new Error("Method not implemented.");
    }
    override async getBacklogWorkspaceId(): Promise<string | null> {
        return null;
    }
    override async getTaskBoardsWorkspaceId(): Promise<string | null> {
        return null;
    }
}


