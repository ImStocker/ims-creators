<template>
  <div class="Form">
    <form-builder
      :form-schema="formSchemaFiltered.filterFields"
      :form-model="formModel"
    ></form-builder>
    <div class="DesktopSettingsDialog_mcp-status">
      <div class="DesktopSettingsDialog_mcp-status-text">
        <template v-if="serverStatus?.running">
          {{
            $t('desktop.settings.fields.mcp.statusRunning', {
              port: serverStatus.port,
            })
          }}
        </template>
        <template v-else>
          {{ $t('desktop.settings.fields.mcp.statusStopped') }}
        </template>
      </div>
      <div
        v-if="serverError"
        class="DesktopSettingsDialog_mcp-status-error error-message-block"
      >
        {{ serverError }}
      </div>
      <div
        class="Form-row DesktopSettingsDialog_mcp-status-actions use-buttons-action"
      >
        <button
          v-if="serverStatus?.running"
          class="is-button is-button-action-outlined danger"
          :disabled="serverBusy"
          @click="stopServer"
        >
          <i class="ri-stop-fill"></i>
          <span>{{ $t('desktop.settings.fields.mcp.stop') }}</span>
        </button>
        <button
          v-if="!serverStatus?.running"
          class="is-button is-button-action-outlined success"
          :disabled="serverBusy"
          @click="startServer"
        >
          <i class="ri-play-fill"></i>
          <span>{{ $t('desktop.settings.fields.mcp.start') }}</span>
        </button>
        <button
          v-if="needRestart"
          class="is-button"
          :disabled="serverBusy"
          @click="restartServer"
        >
          <i class="ri-restart-line"></i>
          <span>{{ $t('desktop.settings.fields.mcp.restart') }}</span>
        </button>
        <button
          class="is-button is-button-action-outlined"
          :disabled="serverBusy || !mcpUrl"
          @click="copyMcpUrl"
        >
          <i class="ri-file-copy-line"></i>
          <span>{{ $t('desktop.settings.fields.mcp.copyUrl') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { FormSchema } from '~ims-app-base/components/Form/FormBuilderTypes';
import FormBuilder from '~ims-app-base/components/Form/FormBuilder.vue';
import FormBuilderModelBindObject from '~ims-app-base/components/Form/FormBuilderModelBindObject';
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import { clipboardCopyPlainText } from '~ims-app-base/logic/utils/clipboard';

export default defineComponent({
  name: 'DesktopSettingsDialogMcp',
  components: {
    FormBuilder,
  },
  props: {
    search: {
      type: String,
      default: '',
    },
    isEmpty: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:isEmpty'],
  data() {
    return {
      mcpPort: null as number | null,
      mcpAutoStart: true,
      serverStatus: null as { running: boolean; port: number | null } | null,
      serverBusy: false,
      serverError: null as string | null,
    };
  },
  computed: {
    formSchema(): FormSchema {
      return [
        {
          caption: this.$t('desktop.settings.fields.mcp.port'),
          prop: 'mcpPort',
          editor: FormInput,
          editorProps: {
            type: 'number',
            min: 1,
            max: 65535,
          },
        },
        {
          caption: this.$t('desktop.settings.fields.mcp.autoStart'),
          prop: 'mcpAutoStart',
          editor: FormCheckBox,
        },
      ];
    },
    allTabTexts() {
      return [
        this.$t('desktop.settings.fields.mcp.port'),
        this.$t('desktop.settings.fields.mcp.autoStart'),
        this.$t('desktop.settings.fields.mcp.statusRunning', { port: '' }),
        this.$t('desktop.settings.fields.mcp.statusStopped'),
        this.$t('desktop.settings.fields.mcp.start'),
        this.$t('desktop.settings.fields.mcp.stop'),
        this.$t('desktop.settings.fields.mcp.restart'),
        this.$t('desktop.settings.fields.mcp.copyUrl'),
      ];
    },
    formSchemaFiltered() {
      let filterFields: FormSchema = [];
      let answer = false;
      if (this.search) {
        const research = new RegExp('.*' + this.search + '.*', 'i');
        answer = !this.allTabTexts.some((t) => research.test(t.valueOf()));
        filterFields = [...this.formSchema].filter((field) => {
          const caption = field ? (field.caption ? field.caption : '') : '';
          return research.test(caption);
        });
      } else {
        filterFields = [...this.formSchema];
      }
      return { answer, filterFields };
    },
    formModel() {
      return new FormBuilderModelBindObject(this);
    },
    needRestart(): boolean {
      const saved_port = this.parsePort(this.mcpPort);
      if (saved_port == null) return false;
      return (
        !!this.serverStatus?.running && this.serverStatus.port !== saved_port
      );
    },
    mcpUrl(): string | null {
      const port = this.serverStatus?.port ?? this.parsePort(this.mcpPort);
      const localPath = this.projectInfo?.localPath;
      if (!port || !localPath) return null;
      return `http://localhost:${port}/mcp?path=${localPath.replaceAll('\\', '/')}`;
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
  },
  watch: {
    formSchemaFiltered() {
      this.$emit('update:isEmpty', this.formSchemaFiltered.answer);
    },
    async mcpPort(new_val: any) {
      const port = this.parsePort(new_val);
      if (port == null) return;
      await window.imshost.app.setMcpPort(port);
    },
    async mcpAutoStart(new_val: boolean) {
      await window.imshost.app.setMcpAutoStart(new_val);
    },
  },
  async mounted() {
    this.mcpPort = await window.imshost.app.getMcpPort();
    this.mcpAutoStart = await window.imshost.app.getMcpAutoStart();
    await this.refreshStatus();
    this.$emit('update:isEmpty', this.formSchemaFiltered.answer);
  },
  methods: {
    parsePort(val: any): number | null {
      if (val === null || val === undefined || val === '') return null;
      const port = typeof val === 'string' ? parseInt(val, 10) : val;
      if (Number.isNaN(port) || port <= 0 || port > 65535) return null;
      return port;
    },
    async refreshStatus() {
      this.serverStatus = await window.imshost.mcp.getStatus();
    },
    async startServer() {
      this.serverBusy = true;
      this.serverError = null;
      try {
        await window.imshost.mcp.start();
      } catch (err: any) {
        this.serverError = err.message;
      } finally {
        this.serverBusy = false;
        await this.refreshStatus();
      }
    },
    async stopServer() {
      this.serverBusy = true;
      this.serverError = null;
      try {
        await window.imshost.mcp.stop();
      } catch (err: any) {
        this.serverError = err.message;
      } finally {
        this.serverBusy = false;
        await this.refreshStatus();
      }
    },
    async restartServer() {
      this.serverBusy = true;
      this.serverError = null;
      try {
        await window.imshost.mcp.restart();
      } catch (err: any) {
        this.serverError = err.message;
      } finally {
        this.serverBusy = false;
        await this.refreshStatus();
      }
    },
    async copyMcpUrl() {
      const url = this.mcpUrl;
      if (!url) return;
      await clipboardCopyPlainText(url);
      this.$getAppManager()
        .get(UiManager)
        .showSuccess(this.$t('desktop.settings.fields.mcp.copied'));
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DesktopSettingsDialog_mcp-status {
  margin-top: 20px;
}
.DesktopSettingsDialog_mcp-status-text {
  color: #666666;
}
.DesktopSettingsDialog_mcp-status-error {
  margin-top: 10px;
}
.DesktopSettingsDialog_mcp-status-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}
.DesktopSettingsDialog_mcp-status-actions .is-button.success {
  --button-bg-color: transparent;
  --button-border-color: var(--color-success);
  --button-text-color: var(--color-success);

  &:hover {
    --button-bg-color: var(--color-success);
    --button-text-color: #222222;
  }

  &:focus {
    --button-bg-color: var(--color-success);
    --button-text-color: #222222;
    --button-outline-color: var(--color-success);
  }

  &:disabled,
  &.disabled {
    --button-bg-color: #60605E;
    --button-border-color: #60605E;
    --button-text-color: #222222;

    &.loading {
      --button-bg-color: transparent;
      --button-border-color: var(--color-success);
      --button-text-color: var(--color-success);
    }
  }
}
</style>
