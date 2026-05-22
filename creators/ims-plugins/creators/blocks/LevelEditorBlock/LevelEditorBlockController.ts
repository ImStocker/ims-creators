import { reactive, watch } from 'vue';
import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import type { LevelEditorShape } from './editor/LevelEditor';
import {
  assignPlainValueToAssetProps,
  extractSubObjectAsPlainValue,
  makeBlockRef,
} from '~ims-app-base/logic/types/Props';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { getShapeControllers } from './editor/shapes/controllers';
import { shapeValueToString } from './canvas/DecorationLabel';
import SelectionManager from './editor/SelectionManager';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';

export type LevelEditorBlockContentUserData = {};
export default class LevelEditorBlockController extends BlockEditorController {
  shapes!: Map<string, LevelEditorShape>;
  selectionManager: SelectionManager;

  constructor(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ) {
    super(appManager, getResolvedBlock);

    this.selectionManager = reactive(
      new SelectionManager(this),
    ) as SelectionManager;
  }

  override postCreate(): void {
    super.postCreate();
    watch(
      () => this.resolvedBlock?.computed,
      () => this._onBlockUpdated(),
      {
        immediate: true,
      },
    );
  }

  private _onBlockUpdated() {
    if (!this.resolvedBlock) {
      return;
    }
    this.shapes = extractSubObjectAsPlainValue(
      this.resolvedBlock.computed,
      'objects',
    ) as unknown as Map<string, LevelEditorShape>;
  }

  get changer(): AssetChanger | null {
    return this.assetBlockEditor ? this.assetBlockEditor.assetChanger : null;
  }

  createShape(
    shape: LevelEditorShape,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    const changer = this.changer;
    if (!changer) return;
    if (!this.resolvedBlock) {
      return;
    }

    const prepared_object = assignPlainValueToAssetProps(
      {},
      shape,
      `objects\\${shape.id}`,
    );

    const op = params?.opId ? params.opId : changer.makeOpId();
    changer.setBlockPropKeys(
      this.resolvedBlock.assetId,
      makeBlockRef(this.resolvedBlock),
      null,
      prepared_object,
      op,
    );
  }
  removeShape(
    id: string,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    const changer = this.changer;
    if (!changer) return;
    if (!this.resolvedBlock) {
      return;
    }

    const op = params?.opId ? params.opId : changer.makeOpId();

    changer.deleteBlockPropKey(
      this.resolvedBlock.assetId,
      makeBlockRef(this.resolvedBlock),
      null,
      `objects\\${id}`,
      op,
    );
  }

  changeShape(
    shapeId: string,
    data: Partial<LevelEditorShape>,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    const changer = this.changer;
    if (!changer) return;
    if (!this.resolvedBlock) {
      return;
    }

    const prepared_changes = assignPlainValueToAssetProps(
      {},
      data,
      `objects\\${shapeId}`,
    );

    const op = params?.opId ? params.opId : changer.makeOpId();
    changer.setBlockPropKeys(
      this.resolvedBlock.assetId,
      makeBlockRef(this.resolvedBlock),
      null,
      prepared_changes,
      op,
    );
  }

  override getContentItems(): BlockContentItem<LevelEditorBlockContentUserData>[] {
    if (!this.resolvedBlock) {
      return [];
    }
    const root_anchor: BlockContentItem<LevelEditorBlockContentUserData> = {
      blockId: this.resolvedBlock.id,
      itemId: 'root',
      title: this.resolvedBlock.title
        ? this.resolvedBlock.title
        : this.appManager.$t('blockTypes.titles.leveleditor'),
      children: [],
    };

    if (this.shapes) {
      const shapes = Object.values(this.shapes);

      const sorted_shapes = shapes.sort((a, b) => {
        return (a?.index ?? 0) - (b?.index ?? 0);
      });

      const menu_items_by_shape_id = new Map<
        string,
        BlockContentItem<LevelEditorBlockContentUserData>
      >();

      assert(root_anchor.children);

      for (const shape of sorted_shapes) {
        const shape_controller = getShapeControllers(this.appManager).map[
          shape.type
        ];

        const title =
          shapeValueToString(shape.value) ??
          this.appManager.$t('levelEditor.shapes.' + shape_controller.name);

        const menu_item = {
          blockId: this.resolvedBlock.id,
          itemId: 'shape-' + shape.id,
          title,
          anchor: 'shape-' + shape.id,
          selectable: !shape.locked && !shape.parentId,
          icon: shape_controller.icon ? shape_controller.icon : undefined,
          userData: {
            type: 'shape',
            id: shape.id,
          },
        };

        menu_items_by_shape_id.set(shape.id, menu_item);
      }

      for (const shape of sorted_shapes) {
        const menu_item = menu_items_by_shape_id.get(shape.id);
        if (!menu_item) continue;

        if (!shape.parentId) {
          root_anchor.children.push(menu_item);
        } else {
          const parent_menu_item = menu_items_by_shape_id.get(shape.parentId);

          if (parent_menu_item) {
            if (!parent_menu_item.children) {
              parent_menu_item.children = [];
            }
            parent_menu_item.children.push(menu_item);
          } else {
            root_anchor.children.push(menu_item);
          }
        }
      }
    }

    return [root_anchor];
  }

  override getSelectedContentItemIds(): string[] {
    const content_item_ids: string[] = [];

    for (const shape_id of this.selectionManager.selectedObjectIds) {
      content_item_ids.push('shape-' + shape_id);
    }

    return content_item_ids;
  }

  override setSelectedContentItemIds(itemIds: string[]): void {
    const selected_shape_ids = new Set<string>();
    for (const item_id of itemIds) {
      if (item_id.startsWith('shape-')) {
        const shape_id = item_id.substring('shape-'.length);
        if (shape_id) {
          selected_shape_ids.add(shape_id);
        }
      }
    }

    this.selectionManager.selectShapes(Array.from(selected_shape_ids));
  }

  revealBlockContentItems(itemIds: string[]) {
    if (!this.assetBlockEditor) {
      return;
    }
    if (!this.resolvedBlock) {
      return;
    }
    this.assetBlockEditor.revealBlockContentIds(this.resolvedBlock.id, itemIds);
  }
}
