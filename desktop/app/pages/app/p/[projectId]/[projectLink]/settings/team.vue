<template>
  <CloudProjectPage></CloudProjectPage>
</template>
<script setup lang="ts">
import CloudProjectPage from '#components/Project/CloudProjectPage.vue';
import { definePageMeta, useI18n, usePageHead } from '#imports';
const { t } = useI18n();

definePageMeta({
  name: 'project-settings-team',
});

usePageHead(() => ({
  title: t('desktop.cloudOnlySection.cloudOnlySectionHeader') + ' | ' + 'IMS Creators',
}));
</script>
