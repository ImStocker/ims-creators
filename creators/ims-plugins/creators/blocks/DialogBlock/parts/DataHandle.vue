<template>
  <Handle
:id="id"
class="DataHandle" :type="type"
:position="position">
    <svg
      class="DataHandle-svg"
      viewBox="0 0 12 12"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:svg="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      fill="#555555"
      stroke="#ffffff"
      style="stroke-width: 0.744504"
    >
      <ellipse
cx="6"
cy="6" rx="5.5112653"
ry="5.5112658" />
    </svg>
  </Handle>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { type Position, Handle, type HandleType } from '@vue-flow/core';

export default defineComponent({
  name: 'DataHandle',
  components: {
    Handle,
  },
  props: {
    id: { type: String, default: '' },
    type: { type: String as PropType<HandleType> },
    position: { type: String as PropType<Position> },
  },
});
</script>

<style lang="scss" scoped>
.DataHandle {
  background: none;
  border-radius: 0;
  border: none;
}
.DataHandle,
.DataHandle-svg {
  width: 12px;
  height: 12px;
  display: block;
}

.DataHandle:hover .DataHandle-svg {
  stroke: #eed811;
}

.DataHandle {
  &.type-boolean {
    .DataHandle-svg {
      stroke: var(--ims-type-boolean-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-boolean-fill);
    }
  }
  &.type-float {
    .DataHandle-svg {
      stroke: var(--ims-type-float-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-float-fill);
    }
  }
  &.type-integer {
    .DataHandle-svg {
      stroke: var(--ims-type-integer-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-integer-fill);
    }
  }
  &.type-string {
    .DataHandle-svg {
      stroke: var(--ims-type-string-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-string-fill);
    }
  }
  &.type-text {
    .DataHandle-svg {
      stroke: var(--ims-type-text-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-text-fill);
    }
  }
  &.type-asset {
    .DataHandle-svg {
      stroke: var(--ims-type-asset-stroke);
    }
    &:hover .DataHandle-svg {
      fill: var(--ims-type-asset-fill);
    }
  }
}

.DataHandle-svg {
  user-select: none;
  pointer-events: none;
}
</style>
