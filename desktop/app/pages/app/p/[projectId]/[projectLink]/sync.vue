<template>
  <NewTab></NewTab>
</template>
<script setup lang="ts">
import { definePageMeta, navigateTo, useI18n, useRoute } from '#imports';
import NewTab from '../../../../../components/Project/NewTab.vue';
const route = useRoute();
await navigateTo({
  name: 'project-autoexport',
  params: route.params
} as any, {
  replace: true
})

definePageMeta({
  name: 'project-sync',
})
</script>
