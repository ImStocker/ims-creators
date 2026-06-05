import FileManager from '~ims-app-base/logic/managers/FileManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import type { ThumbParams } from '~ims-app-base/logic/utils/files';
import * as node_path from 'path';

export default class DesktopFileManager extends FileManager {
  override getFileUrl(
    file: AssetPropValueFile,
    thumbParams?: ThumbParams,
  ): string {
    if (file.Store === 'loc-project') {
      const projectLocalPath = this.appManager
        .get(ProjectManager)
        .getProjectInfo()?.localPath;
      return (
        'localfile://' +
        encodeURIComponent(
          node_path.join(projectLocalPath ?? '', file.Dir ?? '', file.Title),
        )
      );
    }

    return super.getFileUrl(file, thumbParams);
  }
}
