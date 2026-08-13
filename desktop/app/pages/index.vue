<template>
  <div />
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  name: 'desktop-index',
  middleware: async () => {
    const args = await window.imshost.window.getArgs();

    const last_project =
      await window.imshost.storage.getItem<string>('last-project');
    if (args.localPath) {
      window.imshost.storage.setItem<string>('last-project', args.localPath);

      return {
        name: 'project-main',
        params: {
          projectId: '-',
          projectLink: args.localPath,
        },
      };
    } else if (args.localPath === null) {
      return {
        name: 'desktop-start',
      };
    } else if (last_project) {
      await window.imshost.window.maximizeWindow();
      return {
        name: 'project-main',
        params: {
          projectId: '-',
          projectLink: last_project,
        },
      };
    } else {
      return {
        name: 'desktop-start',
      };
    }
  },
});
</script>
