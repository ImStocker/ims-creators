<template>
  <div class="Form">
    <div class="StudioSettingsDialog_other-header"
        v-if="formSchemaFiltered.filterMaintenance.length < maintenance.length"
    >
        {{$t('desktop.settings.fields.maintenance')}}
    </div>
    <div class="Form-row StudioSettingsDialog-row  use-buttons-action">
        <button v-if="showButton('openLogsFolder')" class="is-button"
                @click="openLogsFolder"
        >{{$t('desktop.settings.fields.openLogsFolder')}}</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormBuilder from '~ims-app-base/components/Form/FormBuilder.vue';

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
        maintenance:[
            'openLogsFolder'
        ]
    }
  },
  computed: {
    allTabTexts(){
        const texts = [
            this.$t('desktop.settings.fields.maintenance'),
            this.$t('desktop.settings.fields.openLogsFolder'),
        ]
        for(const setting of this.maintenance){
            texts.push(this.$t('desktop.settings.' + setting))
        }
        return texts;
    },
    formSchemaFiltered(){
        let answer=false;
        let filterMaintenance =[];
        if(this.search)
        {
            const research = new RegExp(".*"+this.search+".*",'i');
            const somethingMatch = this.allTabTexts.some(t => research.test(t.valueOf()))
            if (!somethingMatch) {
                answer = true;
            }
            for(const setting of this.maintenance){
                if(!research.test(this.$t('desktop.settings.' + setting).valueOf())){
                    filterMaintenance.push(setting);
                }
            }
        }
        return {answer,filterMaintenance};
    }
  },
  methods: {
    async openLogsFolder(){
        const file = await window.imshost.app.getLogFileLocation();
        if (file) window.imshost.shell.showItemInFolder(file)
    },
    showButton(title: string){
        return !this.formSchemaFiltered.filterMaintenance.includes(title);
    },
  },
  watch:{
    formSchemaFiltered(){
        this.$emit('update:isEmpty', this.formSchemaFiltered.answer)
    }
  }
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.StudioSettingsDialog_other-header{
    margin-bottom: 15px;
    color: #666666;
    font-weight: bold;
}
</style>
