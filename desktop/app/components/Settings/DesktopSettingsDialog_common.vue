<template>
  <div class="Form">
    <form-builder
        :form-schema="formSchemaFiltered"
        :form-model="formModel"
    ></form-builder>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { FormSchema } from "~ims-app-base/components/Form/FormBuilderTypes"
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import FormBuilder from '~ims-app-base/components/Form/FormBuilder.vue';
import FormBuilderModelBindObject from "~ims-app-base/components/Form/FormBuilderModelBindObject"
import UiManager from "~ims-app-base/logic/managers/UiManager"
import type { LangStr } from '~ims-app-base/logic/types/ProjectTypes';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import DesktopSyncManager from '#logic/managers/DesktopSyncManager';
import { assert } from '~ims-app-base/logic/utils/typeUtils';

export default defineComponent({
  name: 'DesktopSettingsDialog_common',
  components: {
    FormBuilder
  },
  props:{
    search: {},
    isEmpty: {}
  },
  data(){
    return {
        syncWithCloud: 60,
    }
  },
  async mounted(){
    const project_path = this.projectInfo?.localPath;
    assert(project_path, 'Need project path')
    this.syncWithCloud = await window.imshost.settings.getKey(project_path, 'syncWithCloud', 60)
  },
  computed: {
    formSchema(): FormSchema {
        const schema = [
            {
                caption: this.$t('desktop.settings.fields.language'),
                prop: 'appLanguage',
                editor: ImsSelect,
                editorProps: {
                    getOptionLabel: (opt: any) => opt.title,
                    reduce: (opt: any) => opt.value,
                    options: [
                        {
                            value: 'en',
                            title: 'English - English'
                        }, 
                        {
                            value: 'ru',
                            title: 'Русский - Russian'
                        }, 
                        {
                            value: 'de',
                            title: 'Deutsche - German'
                        }
                    ]
                }
            },
            {
                caption: this.$t('desktop.settings.fields.theme'),
                prop: 'currentTheme',
                editor: ImsSelect,
                editorProps: {
                    getOptionLabel: (opt: any) => opt.title,
                    reduce: (opt: any) => opt.value,
                    options: [                         
                        {
                            value: 'ims-light',
                            title: this.$t('desktop.settings.fields.lightTheme')
                        },
                        {
                            value: 'ims-dark',
                            title: this.$t('desktop.settings.fields.darkTheme')
                        },
                    ]
                }
            },
            {
                caption: this.$t('desktop.settings.fields.autoUpdate'),
                prop: 'needAutoUpdate',
                editor: FormCheckBox,
                editorProps: {
                    value: this.needAutoUpdate,
                },
            },
        ]
        if(this.projectInfo?.id){
            schema.push({
                caption: this.$t('desktop.settings.fields.syncWithCloud'),
                prop: 'syncWithCloud',
                editor: ImsSelect,
                editorProps: {
                    getOptionLabel: (opt: any) => opt.title,
                    reduce: (opt: any) => opt.value,
                    options: [30, 60, 300, -1].map(value => 
                        {
                            return {
                                value: value as any,
                                title: this.$t('desktop.settings.fields.syncWithCloudTime.every' + value)
                            }
                        }
                    )
                }
            })
        }
        return schema;
    },
    formSchemaFiltered(){
        if(this.search)
        {
            const search = new RegExp(".*"+this.search+".*",'i');
            return [...this.formSchema].filter(field => {
                const caption = field ? (field.caption ? field.caption : "") : "";
                if (search.test(caption)) return true;
                const options = field.editorProps && field.editorProps.options;
                if (options) {
                    for (const opt of options) {
                        const label = opt.title || opt.label || '';
                        if (search.test(label)) return true;
                    }
                }
                return false;
            })
        }
        else return [...this.formSchema];
    },
    formModel(){
        return new FormBuilderModelBindObject(this);
    },
    appLanguage: {
        get(){
            return this.$getAppManager().get(UiManager).getLanguage();
        },
        set(val: LangStr){
            return this.$getAppManager().get(UiManager).setLanguage(val);
        }
    },
    currentTheme: {
      get() {
        return this.$getAppManager().get(UiManager).getColorTheme();
      },
      set(val: string) {
        this.$getAppManager().get(UiManager).setColorTheme(val);
      },
    },
    needAutoUpdate: {
      get() {
        return this.$getAppManager().get(UiPreferenceManager).getPreference('settings.autoUpdateCheck', true);
      },
      set(val: boolean) {
        this.$getAppManager().get(UiPreferenceManager).setPreference('settings.autoUpdateCheck', val);
      }, 
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
  },
  watch:{
    formSchemaFiltered(){
        this.$emit('update:isEmpty', this.formSchemaFiltered.length === 0)
    },
    async syncWithCloud(new_val: number){
        await this.$getAppManager().get(DesktopSyncManager).changeAutoSynchronization(new_val);
    }
  }
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>

</style>
