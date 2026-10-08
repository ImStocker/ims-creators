import {
  getBetweenIndexWithTimestamp,
  getPreviousIndexWithTimestamp,
} from '~ims-app-base/components/Asset/Editor/blockUtils';
import { INF_GRID_OBJECT_TYPE } from '../../../canvas/InfiniteGrid';
import { LEVEL_FRAME_OBJECT_TYPE } from '../../../canvas/LevelFrame';
import type { ToolSection } from '../ToolManager';
import SelectionRequiredTool from './base/SelectionRequiredTool';

export default class SendBackwardTool extends SelectionRequiredTool {
  name = 'sendBackward';
  icon = 'ri-send-backward';
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

      let prev_non_active_pos = current_pos - 1;
      while (
        prev_non_active_pos >= 0 &&
        active_objects.some(
          (active_obj) =>
            active_obj.id === collection_objects[prev_non_active_pos]?.id,
        )
      ) {
        prev_non_active_pos--;
      }

      const prev_non_active_object = collection_objects[prev_non_active_pos];
      const prev_prev_non_active_object =
        collection_objects[prev_non_active_pos - 1];

      if (prev_non_active_object && prev_prev_non_active_object) {
        const index = getBetweenIndexWithTimestamp(
          prev_prev_non_active_object.index ?? 0,
          prev_non_active_object.index ?? 0,
        );
        this.controller.changeShape(
          active_object.id,
          { index },
          { expectPropsChange: false },
        );
      } else if (prev_non_active_object) {
        const index = getPreviousIndexWithTimestamp(
          prev_non_active_object.index ?? 0,
        );
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
