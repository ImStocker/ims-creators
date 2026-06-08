<template>
  <div class="GraphTextNode GraphEditorNode" :style="nodeStyle">
    <div class="GraphTextNode-header GraphEditorNode-header">
      <i :class="nodeDescriptor.icon"></i>
      <span class="GraphTextNode-header-title">{{
        $t('graphBlock.node.title')
      }}</span>
    </div>
    <div class="GraphTextNode-body GraphEditorNode-body">
      <imc-editor
        v-if="!readonly"
        v-model="localValue"
        class="GraphTextNode-editor nodrag nopan"
        :multiline="true"
        toolbar="inline"
        :placeholder="$t('graphBlock.node.placeholder')"
        @update:model-value="onValueChange"
      ></imc-editor>
      <imc-presenter
        v-else
        :value="localValue"
        class="GraphTextNode-presenter"
      ></imc-presenter>
    </div>
    <div class="GraphTextNode-footer"></div>
    <Handle
      id="source-top"
      type="source"
      :position="Position.Top"
      class="GraphTextNode-handle"
    />
    <Handle
      id="source-right"
      type="source"
      :position="Position.Right"
      class="GraphTextNode-handle"
    />
    <Handle
      id="source-bottom"
      type="source"
      :position="Position.Bottom"
      class="GraphTextNode-handle"
    />
    <Handle
      id="source-left"
      type="source"
      :position="Position.Left"
      class="GraphTextNode-handle"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType, ref, watch } from 'vue';
import { Position, Handle } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import type { GraphBlockController } from '../editor/GraphBlockController';
import ImcEditor from '~ims-app-base/components/ImcText/ImcEditor.vue';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';

export default defineComponent({
  name: 'GraphTextNode',
  components: { Handle, ImcEditor, ImcPresenter },
  props: {
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    data: {
      type: Object as PropType<{
        value?: any;
        width?: number;
        height?: number;
        index?: number;
      }>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    dialogController: {
      type: Object as PropType<GraphBlockController>,
      required: true,
    },
  },
  emits: ['change-type'],
  setup(props) {
    const localValue = ref(props.data?.value ?? null);

    watch(
      () => props.data?.value,
      (val) => {
        localValue.value = val ?? null;
      },
    );

    function onValueChange(val: any) {
      localValue.value = val;
      const node = props.dialogController.state.nodes.find(
        (n) => n.id === props.id,
      );
      if (node) {
        (node.data as any).value = val;
        props.dialogController.savePropsDelayed();
      }
    }

    return {
      Position,
      localValue,
      onValueChange,
    };
  },
  computed: {
    nodeStyle() {
      const w = (this.data as any)?.width;
      const h = (this.data as any)?.height;
      return {
        width: w ? w + 'px' : undefined,
        minHeight: h ? h + 'px' : undefined,
      };
    },
  },
});
</script>

<style lang="scss" scoped>
.GraphTextNode {
  min-width: 180px;
}

.GraphTextNode-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  position: relative;
}

.GraphTextNode-header-title {
  flex: 1;
}

.GraphTextNode-body {
  padding: 4px;
}

.GraphTextNode-footer {
  display: flex;
  justify-content: space-between;
  padding: 2px 10px;
  position: relative;
}

.GraphTextNode-editor {
  min-height: 36px;
  font-size: 13px;
  line-height: 1.4;
}

.GraphTextNode-presenter {
  padding: 4px 6px;
  font-size: 13px;
  line-height: 1.4;
  min-height: 36px;
}

.GraphTextNode-handle {
  width: 8px;
  height: 8px;
  background: #888;
  border: 2px solid #fff;
  border-radius: 50%;
}
</style>
