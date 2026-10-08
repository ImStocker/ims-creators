<template>
  <level-editor-side-panel
    class="LevelEditorSidePropertiesPanel"
    :header="$t('levelEditor.sections.properties')"
  >
    <div class="LevelEditorSidePropertiesPanel-content-sections">
      <div
        v-for="(section, i) of propertySections"
        :key="section.name"
        class="LevelEditorSidePropertiesPanel-content-section"
      >
        <div
          v-for="field of section.fields"
          :key="field.title"
          class="LevelEditorSidePropertiesPanel-content-section-field"
          :class="field.cssClass"
        >
          <div
            v-if="field.showTitle === undefined || field.showTitle"
            class="LevelEditorSidePropertiesPanel-content-section-field-title"
          >
            {{ $t('levelEditor.properties.fields.' + field.title) }}
          </div>
          <div
            class="LevelEditorSidePropertiesPanel-content-section-field-props"
            :class="{ 'is-group': field.props.length > 1 }"
          >
            <div
              v-for="prop of field.props"
              :key="prop.key"
              class="LevelEditorSidePropertiesPanel-content-section-field-prop"
            >
              <component
                :is="prop.editorComponent"
                :model-value="getValue(prop)"
                :readonly="readonly"
                v-bind="prop.editorProps"
                @update:model-value="setValue(prop, $event)"
              />
            </div>
          </div>
        </div>

        <hr
          v-if="i < propertySections.length - 1"
          class="LevelEditorSidePropertiesPanel-section-divider"
        />
      </div>
    </div>
  </level-editor-side-panel>
</template>
<script lang="ts">
import { defineComponent, type PropType, type UnwrapRef } from 'vue';
import type LevelEditorCanvasController from '../LevelEditorCanvasController';
import AsyncComponent from '~ims-app-base/components/Common/AsyncComponent.vue';
import {
  groupDescriptorsIntoSections,
  type ShapePropertyDescriptor,
} from '../shapes/shapePropertyDescriptors';
import { getShapeControllers } from '../shapes/controllers';
import LevelEditorSidePanel from './LevelEditorSidePanel.vue';

export default defineComponent({
  name: 'LevelEditorSidePropertiesPanel',
  components: {
    AsyncComponent,
    LevelEditorSidePanel,
  },
  props: {
    canvasController: {
      type: Object as PropType<UnwrapRef<LevelEditorCanvasController>>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    selectedObjects() {
      if (!this.canvasController.blockController.shapes) return [];
      return this.canvasController.blockController.selectionManager.selectedObjectIds.map(
        (id) => this.canvasController.blockController.shapes[id],
      );
    },
    propertySections() {
      if (!this.selectedObjects?.length) {
        return [];
      }

      const controllers = this.selectedObjects
        .filter((x) => x)
        .map((obj) => getShapeControllers(this.$getAppManager()).map[obj.type])
        .filter((controller) => controller);

      const all_descriptors = controllers.map((controller) =>
        controller.getPropertyDescriptors(),
      );

      const common_descriptors = this.getCommonDescriptors(all_descriptors);

      return groupDescriptorsIntoSections(common_descriptors);
    },
  },
  methods: {
    getCommonDescriptors(
      all_descriptors: ShapePropertyDescriptor[][],
    ): ShapePropertyDescriptor[] {
      if (all_descriptors.length === 0) return [];

      const base_descriptors = all_descriptors[0];
      const common_descriptors: ShapePropertyDescriptor[] = [];

      for (const descriptor of base_descriptors) {
        const is_common = all_descriptors.every((descriptors) =>
          descriptors.some(
            (d) => d.key === descriptor.key && d.section === descriptor.section,
          ),
        );

        if (is_common) {
          const new_common_descriptor: ShapePropertyDescriptor = {
            ...descriptor,
            get: (_shape, _controller) => this.getMixedValue(descriptor),
            set: (shape, value, _controller) =>
              this.setMixedValue(descriptor, value),
          };
          common_descriptors.push(new_common_descriptor);
        }
      }
      return common_descriptors;
    },
    getMixedValue(descriptor: ShapePropertyDescriptor) {
      const values = this.selectedObjects.map((obj) =>
        descriptor.get(
          obj,
          this.canvasController as LevelEditorCanvasController,
        ),
      );

      const first_value = values[0];

      const are_values_equal = values.every(
        (value) => JSON.stringify(value) === JSON.stringify(first_value),
      );

      return are_values_equal ? first_value : 'Mixed';
    },
    setMixedValue(descriptor: ShapePropertyDescriptor, value: any) {
      for (const selected_object of this.selectedObjects) {
        descriptor.set(
          selected_object,
          value,
          this.canvasController as LevelEditorCanvasController,
        );
      }
    },
    setValue(prop: ShapePropertyDescriptor, value: any) {
      prop.set(
        this.selectedObjects[0],
        value,
        this.canvasController as LevelEditorCanvasController,
      );
    },
    getValue(prop: ShapePropertyDescriptor) {
      return prop.get(
        this.selectedObjects[0],
        this.canvasController as LevelEditorCanvasController,
      );
    },
  },
});
</script>
<style lang="scss" scoped>
@use './LevelEditorSidePanel.scss';

.LevelEditorSidePropertiesPanel {
  --LevelEditorSidePanel-horizontalFieldsGap: 15px;
}

.LevelEditorSidePropertiesPanel-content-sections {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.LevelEditorSidePropertiesPanel-content-section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.LevelEditorSidePropertiesPanel-content-section-field {
  &.group-color {
    .is-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
  }
}
.LevelEditorSidePropertiesPanel-content-section-field-title {
  @include LevelEditorSidePanel.LevelEditorSidePanel-property;
}
.LevelEditorSidePropertiesPanel-content-section-field-props {
  width: 100%;
  &.is-group {
    min-width: 0;
    display: flex;
    gap: var(--LevelEditorSidePanel-horizontalFieldsGap);

    .LevelEditorSidePropertiesPanel-content-section-field-prop {
      flex: 1;
      display: flex;
      min-width: 0;
      flex-shrink: 0;
      max-width: calc(
        50% - var(--LevelEditorSidePanel-horizontalFieldsGap) / 2
      );
    }
  }
}
.LevelEditorSidePropertiesPanel-section-divider {
  height: 1px;
  border-color: var(--local-border-color);
  width: 100%;
}
</style>
