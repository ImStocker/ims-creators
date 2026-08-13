<template>
  <div v-show="isOpen" class="DesktopAiPanel">
    <AiChatPanel
      :title="t('aiAssistant.title')"
      storage-key="DesktopAiPanel.width"
      @close="$emit('close')"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '#imports';
import AiChatPanel from '~ims-app-base/components/ai/AiChatPanel.vue';

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
});

defineEmits(['close']);

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.DesktopAiPanel {
  flex-shrink: 0;
  display: flex;
}
</style>
