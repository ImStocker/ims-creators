<template>
  <dialog-content
    class="DesktopSettingsDialog"
  >
    <div class="Dialog-header">{{$t('desktop.settings.header')}}</div>
    <FormSearch
      :value="search ?? ''"
      class="GameDesignMenu-Search"
      @change="search = $event"
    ></FormSearch>
    <div class="DesktopSettingsDialog-tabs">
        <div class="DesktopSettingsDialog-tabs-list">
            <div v-for="tab of settingsGroupTabsNotEmpty"
                  :key="tab.name"
                  class="DesktopSettingsDialog-tabs-list-one"
                  :class="{'state-selected': tab.name === activeTab}"
                  @click="activeTab = tab.name"
            >
                {{$t('desktop.settings.groups.' + tab.name)}}
            </div>
        </div>
        <div class="DesktopSettingsDialog-tabs-content">
            <component v-for="tab of settingsGroupTabs"
                :key="tab.name"
                :is="tab.component"
                :tabOptions="getTabOptions(tab)"
                :search.sync="search" 
                :isEmpty.sync="emptyTabs[tab.name]"  
                :isOpened="activeTab === tab.name"
                @changeActiveTab="changeActiveTab($event)"
                v-show="activeTab === tab.name"
                @update:isEmpty="emptyTabs[tab.name] = $event"
            ></component>
        </div>
    </div>
    <div class="DesktopSettingsDialog-buttons use-buttons-action">
        <button class="is-button accent" @click="close">
          {{ $t('desktop.settings.close') }}
        </button>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import FormBuilder from '~ims-app-base/components/Form/FormBuilder.vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import DesktopSettingsDialog_common from './DesktopSettingsDialog_common.vue';
import DesktopSettingsDialog_other from './DesktopSettingsDialog_other.vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import DesktopSettingsDialog_plugins from './DesktopSettingsDialog_plugins.vue';

type DialogProps = {
    tabOptions: any,
    tab: string
};

type DialogResult = undefined

export default defineComponent({
  name: 'DesktopSettingsDialog',
  components: {
    DialogContent,
    FormBuilder,
    DesktopSettingsDialog_common,
    FormSearch
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data(){
      const tabOptions = {};
      if (this.dialog.state.tabOptions && this.dialog.state.tab){
          tabOptions[this.dialog.state.tab] = this.dialog.state.tabOptions
      }
      return {
        activeTab: 'common',
        search: null,
        emptyTabs: {
          common: false,
          other: false,
          plugins: false,
        },
        tabOptions
      }
  },
  mounted(){
      if (this.dialog.state.tab) {
          this.activeTab = this.dialog.state.tab;
      }
  },
  computed: {
    settingsGroupTabsNotEmpty(){
      return this.settingsGroupTabs.filter(tab => {
          return !this.emptyTabs[tab.name]
      })
    },
    settingsGroupTabs(){
      return [
        {
            name: 'common',
            component: DesktopSettingsDialog_common
        },
        {
            name: 'plugins',
            component: DesktopSettingsDialog_plugins
        },
        {
            name: 'other',
            component: DesktopSettingsDialog_other
        },
      ]
    }
  },
  methods: {
    close() {
      this.dialog.close();
    },
    getTabOptions(tab){
        return this.tabOptions.hasOwnProperty(tab.name) ? 
            this.tabOptions[tab.name] :
            {}
    },
    changeActiveTab(tabInfo){
        if (tabInfo.options){
            this.tabOptions = {
                ...this.tabOptions,
                [tabInfo.name]: tabInfo.options
            }
        }
        this.activeTab = tabInfo.name;
    }
  }
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/devices-mixins';

.DesktopSettingsDialog{
    @include devices-mixins.device-type(pc){
      width: 70vw;
      min-width: 800px;
      max-width: 1000px;
    }
    .Form-row-buttons{
      margin-top: 30px;
    }
}
.DesktopSettingsDialog-tabs{
    min-height: 490px;
    max-height: 490px;
    display: flex;
    margin-top: 10px;
}

.DesktopSettingsDialog-tabs-list{
    border-right: 1px solid var(--local-border-color);
    padding-right: 20px;
    margin-right: 20px;
    width: 200px;
    box-sizing: border-box;
    overflow-y: auto;
}

.DesktopSettingsDialog-tabs-content{
    flex:1;
    max-height: inherit;
    min-height: inherit;
}
.DesktopSettingsDialog-tabs-list-one{
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 2px;
    &:hover{
      background: var(--app-menu-hl-bg-color);
    }
    &.state-selected{
      background: var(--color-accent);
      color: var(--local-text-on-primary-color);
      font-weight: 500;
    }
}

.DesktopSettingsDialog-checkbox-caption{
    flex:1;
    margin-left: 10px;
}
.DesktopSettingsDialog-numberInRow{
    display: flex;
    &>input{
        flex:1;
    }
}

.DesktopSettingsDialog-numberInRow-caption{
    margin-right: 10px;
    position: relative;
    top:5px;
}
</style>

<style lang="scss" rel="stylesheet/scss" >
.DialogHost-component-DesktopSettingsDialog .DialogHostDialog-content{
    min-width: 800px;
}

.DesktopSettingsDialog .FormBuilder-row{
  border-bottom: 1px solid var(--local-border-color);
  padding-bottom: 10px;
  margin-bottom: 10px;
  &:last-child{
    margin-bottom: 0;
  }
}

.DesktopSettingsDialog-tabs-content{
  display: flex;
  &>div{
    flex:1;
    overflow: auto;
  }
}

.DesktopSettingsDialog-buttons{
  display: flex;
  justify-content: center;
}
</style>