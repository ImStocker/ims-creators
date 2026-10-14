<template>
  <div class="Form ProjectMoveForm">
    <div class="Form-row">
      <div class="Form-row-caption">
        {{ $t('desktop.settings.project.location') }}
      </div>
      <div class="Form-row-value">
        <SelectFolderForm
          :value="location"
          :placeholder="$t('desktop.settings.project.location')"
          @update="location = $event"
        ></SelectFolderForm>
      </div>
    </div>
    <div class="Form-row">
      <div class="Form-row-caption">
        {{ $t('desktop.settings.project.folderName') }}
      </div>
      <div class="Form-row-value">
        <FormInput
          :value="folderName"
          :disabled="busy"
          @input="folderName = $event"
        ></FormInput>
      </div>
    </div>
    <div v-if="targetExistsWarning" class="ProjectMoveForm-warning">
      <i class="ri-error-warning-fill"></i>
      {{ $t('desktop.settings.project.targetExists') }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import SelectFolderForm from '../Common/SelectFolderForm.vue';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';

// Renderer `path` is a POSIX polyfill, so it cannot handle Windows separators.
// Use separator-agnostic helpers for OS paths instead.
function splitOsPath(p: string): { dir: string; name: string } {
  if (!p) return { dir: '', name: '' };
  const normalized = p.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return { dir: '', name: p };
  return { dir: p.slice(0, idx), name: p.slice(idx + 1) };
}

function joinOsPath(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes('\\') ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + name;
}

function pathKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export default defineComponent({
  name: 'ProjectMoveForm',
  components: {
    FormInput,
    SelectFolderForm,
  },
  props: {
    localPath: {
      type: String,
      default: '',
    },
    busy: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['submit', 'update:canSubmit'],
  data() {
    return {
      location: '',
      folderName: '',
      targetExists: false,
      checkPathDebounce: null as any,
    };
  },
  computed: {
    originalLocation(): string {
      return splitOsPath(this.localPath).dir;
    },
    originalFolderName(): string {
      return splitOsPath(this.localPath).name;
    },
    targetPath(): string {
      if (!this.location || !this.folderName) return '';
      return joinOsPath(this.location, this.folderName);
    },
    targetChanged(): boolean {
      return (
        !!this.targetPath &&
        pathKey(this.targetPath) !== pathKey(this.localPath)
      );
    },
    targetExistsWarning(): boolean {
      return this.targetChanged && this.targetExists;
    },
    canMove(): boolean {
      return (
        !!this.location &&
        !!this.folderName &&
        this.targetChanged &&
        !this.targetExists
      );
    },
  },
  watch: {
    localPath: {
      immediate: true,
      handler() {
        this.location = this.originalLocation;
        this.folderName = this.originalFolderName;
      },
    },
    targetPath(new_val: string) {
      if (this.checkPathDebounce) {
        this.checkPathDebounce(new_val);
      }
    },
    canMove: {
      immediate: true,
      handler(val: boolean) {
        this.$emit('update:canSubmit', val);
      },
    },
  },
  mounted() {
    this.location = this.originalLocation;
    this.folderName = this.originalFolderName;
    this.checkPathDebounce = debounceForThis(async function (
      this: any,
      val: string,
    ) {
      this.targetExists = !!val && (await window.imshost.fs.exists(val));
    }, 200);
  },
  methods: {
    submit() {
      if (!this.canMove) return;
      this.$emit('submit', this.targetPath);
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.ProjectMoveForm-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-main-error);
  margin-bottom: 10px;
}
</style>
