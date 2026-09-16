<template>
  <div />
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports';

definePageMeta({
  name: 'desktop-index',
  middleware: async () => {
    const args = await window.imshost.window.getArgs();

    if (args.localPath) {
      window.imshost.storage.setItem<string>('last-project', args.localPath);

      return {
        name: 'project-main',
        params: {
          projectId: '-',
          projectLink: args.localPath,
        },
      };
    }

    if (args.localPath === null) {
      return {
        name: 'desktop-start',
      };
    }

    const last_project =
      await window.imshost.storage.getItem<string>('last-project');
    if (last_project) {
      const exists = await window.imshost.fs.exists(last_project);
      if (exists) {
        await window.imshost.window.maximizeWindow();
        return {
          name: 'project-main',
          params: {
            projectId: '-',
            projectLink: last_project,
          },
        };
      }
      await window.imshost.storage.removeItem('last-project');
    }

    return {
      name: 'desktop-start',
    };
  },
});
</script>
