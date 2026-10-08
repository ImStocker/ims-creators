import {
  getBetweenIndexWithTimestamp,
  getNextIndexWithTimestamp,
} from '~ims-app-base/components/Asset/Editor/blockUtils';
import { INF_GRID_OBJECT_TYPE } from '../../../canvas/InfiniteGrid';
import { LEVEL_FRAME_OBJECT_TYPE } from '../../../canvas/LevelFrame';
import type { ToolSection } from '../ToolManager';
import SelectionRequiredTool from './base/SelectionRequiredTool';

export default class BringForwardTool extends SelectionRequiredTool {
  name = 'bringForward';
  icon = 'ri-bring-forward';
  section: ToolSection = 'layers';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;

  override onActivate() {
    if (
      !this.controller.blockController.selectionManager.selectedObjectIds.length
    )
      return;

    const active_objects = this.controller.canvas.getActiveObjects();

    for (const active_object of active_objects) {
      const collection = active_object.parent
        ? active_object.parent
        : this.controller.canvas;
      const collection_objects = collection
        .getObjects()
        .filter(
          (obj) =>
            obj.type !== INF_GRID_OBJECT_TYPE &&
            obj.type !== LEVEL_FRAME_OBJECT_TYPE &&
            obj.type !== 'label',
        );

      const current_pos = collection_objects.indexOf(active_object);
      if (current_pos < 0) continue;

      let next_non_active_pos = current_pos + 1;
      while (
        next_non_active_pos < collection_objects.length &&
        active_objects.some(
          (active_obj) =>
            active_obj.id === collection_objects[next_non_active_pos]?.id,
        )
      ) {
        next_non_active_pos++;
      }

      const next_non_active_obj = collection_objects[next_non_active_pos];
      const next_next_non_active_obj =
        collection_objects[next_non_active_pos + 1];

      if (next_non_active_obj && next_next_non_active_obj) {
        const index = getBetweenIndexWithTimestamp(
          next_non_active_obj.index ?? 0,
          next_next_non_active_obj.index ?? 0,
        );
        this.controller.changeShape(
          active_object.id,
          { index },
          { expectPropsChange: false },
        );
      } else if (next_non_active_obj) {
        const index = getNextIndexWithTimestamp(next_non_active_obj.index ?? 0);
        this.controller.changeShape(
          active_object.id,
          { index },
          { expectPropsChange: false },
        );
      }
    }

    this.deactivate();
  }
}
