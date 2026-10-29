import { createError, defineNuxtRouteMiddleware, navigateTo } from '#app';
import { LOCAL_ROOT_WORKSPACE_ID } from '#bridge/utils/cloud-root';
import DesktopProjectManager from '#logic/managers/DesktopProjectManager';
import { useAppManager } from '../composables/useAppManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';

export default defineNuxtRouteMiddleware(async (to) => {
  const appManager = useAppManager();
  const worspace_id = 
      (to.params.workspaceId
        ? to.params.workspaceId
        : to.params.boardId
      )?.toString()
  const workspace = await appManager
    .get(CreatorAssetManager)
    .getWorkspaceByIdViaCache(
      worspace_id
    );
  if (!workspace) {
    if (worspace_id === LOCAL_ROOT_WORKSPACE_ID){
      const project_root_workspace_id = appManager.get(DesktopProjectManager).getProjectRootWorkpaceId();
      if (project_root_workspace_id !== worspace_id){
        return {
            name: 'project-workspace-by-id',
            params: {
              workspaceId: project_root_workspace_id
            }
        }
      }
    }

    throw createError({
      statusCode: 404,
      message: appManager.$t('pages.pageNotFound'),
    });
  }
  return true;
});
