import type { RouteLocationRaw } from "vue-router";
import type { IAppManager } from "~ims-app-base/logic/managers/IAppManager";

export class DesktopTab {
  constructor(public title: string, public route: RouteLocationRaw){}
}


type DesktopTabHistoryEntry = {
  tab: DesktopTab,
  route: RouteLocationRaw
}

export class DesktopTabController {
    tabs: DesktopTab[] = [];
    private _muteNavigationEvent: boolean = false;
    private _currentTab: DesktopTab | null = null;
    private _history: DesktopTabHistoryEntry[] = [];
    private _historyPointer: number = -1;

    constructor(public appManager: IAppManager) {}

    private async _changeDisplayingRoute(route: RouteLocationRaw, mute: boolean){
      if (mute) {
        this._muteNavigationEvent = true;
      }
      try {
        await this.router.push(route);
      } finally {
        if (mute){
          this._muteNavigationEvent = false;
        }
      }
    }

    get router() {
      return this.appManager.getRouter();
    }

    get currentTab() {
      return this._currentTab;
    }

    get canGoBack(){
      return this._historyPointer > 0;
    }

    get canGoForward(){
      return this._historyPointer < this._history.length - 1;
    }


    async openTab(tab: DesktopTab, use_history: boolean = false) {
      if (this._currentTab !== tab) {
        if (this.tabs.indexOf(tab) < 0) {
          this.tabs.push(tab);
        }
        this._currentTab = tab;
      }
      await this._changeDisplayingRoute(tab.route, use_history);
    }
    
    openNewTab(route?: RouteLocationRaw){
      route = route ? route : {
        name: 'project-new-tab',
        params: {
          projectId: '-',
        }
      };

      if (typeof route === 'string'){        
        window.open(route, '_blank');
        return;
      }

      let title = this.appManager.$t('desktop.newTab.title');

      if (this._currentTab) {
        const current_path = decodeURIComponent(this.router.resolve(this._currentTab.route).fullPath);
        const route_path = decodeURIComponent(this.router.resolve(route).fullPath);

        if (current_path === route_path) {
          title = this._currentTab.title;
        }
      }

      const new_tab = new DesktopTab(title, route);

      this.tabs.push(new_tab);
      this._currentTab = new_tab;

      this._addToHistory(new_tab);
      this._changeDisplayingRoute(this._currentTab.route, true);
    }

    async removeTab(tab: DesktopTab){
      const removed_tab_index = this.tabs.indexOf(tab);
      if (removed_tab_index === -1) return;

      const was_last_tab = this.tabs.length === 1;
        
      this.tabs.splice(removed_tab_index, 1);

      if (this._currentTab === tab) {
        if (was_last_tab) {
          this._currentTab = null;
          this.openNewTab();
          return
        }

        let new_active_tab: DesktopTab;
        if (removed_tab_index >= this.tabs.length) {
          new_active_tab = this.tabs[this.tabs.length - 1];
        } else {
          new_active_tab = this.tabs[removed_tab_index];
        }

        await this.openTab(new_active_tab);
      }
    }

    private _addToHistory(tab: DesktopTab) {
      if (typeof tab.route !== 'string' && 'name' in tab.route && tab.route.name && ['desktop-index', 'project-main'].includes(tab.route.name.toString())) return;
      this._history = this._history.slice(0, this._historyPointer + 1);

      this._history.push({ tab, route: tab.route });
      this._historyPointer = this._history.length - 1;
    }

    pushCurrentTabRoute(route: RouteLocationRaw){
      if (this._muteNavigationEvent){
        return;
      }

      // Prepare route to prevent wrong escaping projectPath
      const prepared_route = typeof route !== 'string' && 'name' in route ? {
        name: route.name,
        params: route.params,
        query: route.query,
        hash: route.hash
      } : route;

      let current_tab = this.currentTab;

      if (!current_tab){
        current_tab = new DesktopTab('', prepared_route)
        this.tabs.push(current_tab);
        this._currentTab = current_tab;
      } else {
        current_tab.route = prepared_route
      }
      
      this._addToHistory(current_tab);
    }

    updateCurrentTabTitle(title: string){
      if (this._muteNavigationEvent){
        return;
      }

      const current_tab = this.currentTab;
      if (!current_tab) return;
      current_tab.title = title;
    }

    async goBack() {
        if (!this.canGoBack) return;

        this._historyPointer--;
        const entry = this._history[this._historyPointer];

        entry.tab.route = entry.route;
        this.openTab(entry.tab, true);
    }

    async goForward() {
        if (!this.canGoForward) return;

        this._historyPointer++;
        const entry = this._history[this._historyPointer];

        entry.tab.route = entry.route;
        this.openTab(entry.tab, true);
    }
}