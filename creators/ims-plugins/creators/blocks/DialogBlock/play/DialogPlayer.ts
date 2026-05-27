import type { GraphNode } from '@vue-flow/core';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { FlowViewportHelper } from '../editor/FlowViewportHelper';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { ScriptPlayNode, ScriptPlayNodeProps } from './ScriptPlayNode';
import {
  convertAssetPropsToPlainObject,
  type AssetPropsPlainObjectValue,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import DialogManager, {
  type DialogHandler,
} from '~ims-app-base/logic/managers/DialogManager';
import PlayerDialog from './PlayerDemoDialog.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import type { ImscScriptPlayerSpeech } from 'imsc-script';
import { ImscScriptPlayer } from 'imsc-script';
import type {
  ImscScriptGraphNodeTrigger,
  ImscScriptGraphNodeSpeech,
} from 'imsc-script/Graph';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { reactive } from 'vue';
import { getActionNodeParams } from '../logic/nodeParams';

type DialogPlayingState = {
  history: ScriptPlayNode[];
  historyPointer: number;
  stop: boolean;
  moveInterrupted: boolean;
  debug: boolean;
  dialog: DialogHandler<void, any> | null;
};

export class DialogPlayer {
  private _playingState: DialogPlayingState | null = null;
  private _debugNodeSwitchTime = 1000;
  private _player!: ImscScriptPlayer;
  private _waitingForSpeech = false;
  private _triggerResolve: ((outputs: Record<string, any>) => void) | null =
    null;
  private _triggerOutputs: Record<string, AssetPropValue> = {};
  private _externalPause = false;
  private _scriptEnded = false;

  private constructor(
    protected appManager: IAppManager,
    protected dialogController: DialogBlockController,
    protected viewportHelper: FlowViewportHelper,
    protected projectContext: IProjectContext,
  ) {}

  postCreate() {
    assert(this.dialogController.resolvedBlock?.assetId);
    const prepared_asset = {
      id: this.dialogController.resolvedBlock.assetId,
      blocks: [
        {
          ...this.dialogController.resolvedBlock,
          computed: {
            ...convertAssetPropsToPlainObject(
              this.dialogController.resolvedBlock.computed,
            ),
          },
        },
      ],
    };

    const defaultVariableValues = this.dialogController.getVariables().reduce(
      (acc, variable) => {
        acc[variable.name] = variable.default;
        return acc;
      },
      {} as Record<string, AssetPropValue>,
    );

    this._player = new ImscScriptPlayer(prepared_asset, {
      blockName: this.dialogController.resolvedBlock.name ?? undefined,
      initialVariables: defaultVariableValues,
      events: {
        onSpeech: (speech, node) => this._onSpeech(speech, node),
        onTrigger: (subject, inputs, node) =>
          this._onTrigger(subject, inputs, node),
        onNodeEnter: (nodeId, node) => this._onNodeEnter(nodeId, node),
      },
    });
  }

  static CreateInstance(
    appManager: IAppManager,
    dialogController: DialogBlockController,
    viewportHelper: FlowViewportHelper,
    projectContext: IProjectContext,
  ): DialogPlayer {
    const raw = new DialogPlayer(
      appManager,
      dialogController,
      viewportHelper,
      projectContext,
    );
    const res = reactive(raw);
    res.postCreate();
    return res as unknown as DialogPlayer;
  }

  get isPlaying() {
    return !!this._playingState;
  }

  get isPaused() {
    if (!this._playingState) return false;
    return this._externalPause;
  }

  get isPlayDebug() {
    return !!this._playingState?.debug;
  }

  get canResume() {
    if (!this._playingState) return false;
    if (this._externalPause) return true;
    if (this._waitingForSpeech)
      return this._getFirstAvailableChoice() !== false;
    if (this._triggerResolve) return true;
    return false;
  }

  get scriptEnded() {
    return this._scriptEnded;
  }

  get canHistoryBack() {
    return !!this._playingState && this._playingState.historyPointer > 0;
  }

  get canHistoryForward() {
    return (
      !!this._playingState &&
      this._playingState.historyPointer < this._playingState.history.length - 1
    );
  }

  private _getFirstAvailableChoice(): number | null | false {
    const node = this.currentPlayingNode;
    if (!node) return false;
    if (node.type !== 'speech' || !node.options?.length) {
      return null;
    }
    for (
      let optionIndex = 0;
      optionIndex < node.options.length;
      optionIndex++
    ) {
      const optionValues = node.options[optionIndex].values;
      if (
        !optionValues ||
        optionValues.condition === undefined ||
        optionValues.condition
      ) {
        return optionIndex;
      }
    }
    return false;
  }

  get currentPlayingNode(): ScriptPlayNode | null {
    if (
      !this._playingState ||
      this._playingState.historyPointer < 0 ||
      this._playingState.history.length === 0
    ) {
      return null;
    }
    return this._playingState.history[this._playingState.historyPointer];
  }

  getLastPlayNode(nodeId: string): ScriptPlayNode | null {
    if (!this._playingState) return null;
    for (let p = this._playingState.historyPointer; p >= 0; p--) {
      if (this._playingState.history[p].id === nodeId) {
        return this._playingState.history[p];
      }
    }
    return null;
  }

  getFlowEdgePlayState(
    sourceId: string,
    targetId: string,
  ): 'current' | 'visited' | null {
    if (!this._playingState) return null;
    for (
      let targetH = this._playingState.historyPointer;
      targetH >= 1;
      targetH--
    ) {
      const sourceH = targetH - 1;
      const targetContext = this._playingState.history[targetH];
      if (targetContext.id !== targetId) continue;
      const sourceContext = this._playingState.history[sourceH];
      if (sourceContext.id !== sourceId) continue;
      return targetH === this._playingState.historyPointer
        ? 'current'
        : 'visited';
    }
    return null;
  }

  goHistoryBack() {
    if (!this._playingState || !this.canHistoryBack) return;
    this._externalPause = true;
    this._playingState.historyPointer--;
    this._moveViewportToNode(
      this._playingState.history[this._playingState.historyPointer].id,
    );
  }

  goHistoryForward() {
    if (!this._playingState || !this.canHistoryForward) return;
    this._externalPause = true;
    this._playingState.historyPointer++;
    this._moveViewportToNode(
      this._playingState.history[this._playingState.historyPointer].id,
    );
  }

  public pause() {
    if (!this._playingState) return;
    this._externalPause = true;
  }

  public resume() {
    if (!this._playingState) return;
    this._externalPause = false;
    if (this._waitingForSpeech) {
      const option = this._getFirstAvailableChoice();
      if (option !== false) {
        this.playChoose(option);
      }
    }
  }

  public stop() {
    if (!this._playingState) return;
    this._player.end();
    this._destroyDemoMode();
    this._playingState = null;
    this._waitingForSpeech = false;
    this._triggerResolve = null;
    this._externalPause = false;
    this._scriptEnded = false;
  }

  public finishPlay() {
    this.stop();
  }

  public async restart() {
    const wasDebug = !!this._playingState?.debug;
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1));
    await this.play(wasDebug);
  }

  public async playChoose(choice: number | null) {
    if (this._triggerResolve) {
      const outputs = { ...this._triggerOutputs };
      this._triggerOutputs = {};
      const resolve = this._triggerResolve;
      this._triggerResolve = null;
      this._waitingForSpeech = false;
      resolve(outputs);
    } else if (this._waitingForSpeech) {
      this._waitingForSpeech = false;
      this._player.continue(choice ?? undefined);
    }
  }

  public playGetCurrentNodeParam(param: string): AssetPropValue {
    return this._triggerOutputs[param] ?? null;
  }

  public playSetCurrentNodeParam(param: string, value: AssetPropValue): void {
    this._triggerOutputs[param] = value;
  }

  private _initDemoMode() {
    if (!this._playingState) return;
    this._playingState.dialog = this.appManager
      .get(DialogManager)
      .create(PlayerDialog, {
        dialogPlayer: this,
        dialogController: this.dialogController,
        projectContext: this.projectContext,
      });
    this._playingState.dialog.open();
  }

  private _destroyDemoMode() {
    if (!this._playingState) return;
    if (this._playingState.dialog) {
      this._playingState.dialog.close();
      this._playingState.dialog = null;
    }
  }

  public setPlayMode(debug: boolean) {
    if (!this._playingState) return;
    if (this._playingState.debug === debug) return;
    this._playingState.debug = debug;
    if (debug) {
      this._destroyDemoMode();
      const currentNode = this.currentPlayingNode;
      this._playingState.moveInterrupted = false;
      if (currentNode) {
        this._moveViewportToNode(currentNode.id);
      }
    } else {
      this._initDemoMode();
    }
  }

  private async _moveViewportToNode(nodeId: string) {
    const flowNode = this.dialogController.state.nodes.find(
      (n) => n.id === nodeId,
    ) as GraphNode | undefined;
    if (flowNode) {
      return await this.viewportHelper.moveToNodes([flowNode], {
        duration: this._debugNodeSwitchTime,
        interpolate: 'linear',
        maxZoom: Math.min(
          this.viewportHelper.zoom,
          this.viewportHelper.maxZoom,
        ),
      });
    }
    return false;
  }

  private _onSpeech(
    speech: ImscScriptPlayerSpeech,
    node: ImscScriptGraphNodeSpeech,
  ) {
    if (!this._playingState) return;

    const isDebug = this._playingState.debug;

    if (isDebug && (!node.options || node.options.length === 0)) {
      this._waitingForSpeech = false;
      setTimeout(() => {
        this._player.continue();
      }, this._debugNodeSwitchTime);
    } else {
      this._waitingForSpeech = true;
    }
  }

  private _onTrigger(
    subject: string,
    inputs: Record<string, AssetPropsPlainObjectValue>,
    node: ImscScriptGraphNodeTrigger,
  ): void | Record<string, any> | Promise<Record<string, any> | void> {
    if (!this._playingState) return;

    const isDebug = this._playingState.debug;
    const params = getActionNodeParams(
      (node.params as any | undefined) ?? { in: [], out: [] },
      subject,
      this.dialogController.getActions(),
      node.values as any,
    );
    const hasOutputParams = params.outputParameters.length;
    const needWait = !isDebug || hasOutputParams;

    if (needWait) {
      this._triggerOutputs = {};
      return new Promise<Record<string, any>>((resolve) => {
        this._triggerResolve = resolve;
      });
    }

    return {};
  }

  private _onNodeEnter(nodeId: string, node: any) {
    if (!this._playingState) return;
    const playingState = this._playingState;

    const playNode: ScriptPlayNode = {
      id: nodeId,
      type: node.type,
      subject: node.subject,
      values: node.values as ScriptPlayNodeProps | undefined,
      next: node.next,
      options: node.options?.map((o: any) => ({
        values: o.values as ScriptPlayNodeProps | undefined,
        next: o.next,
      })),
      params: node.params,
    };
    this._pushHistory(playNode);

    if (playingState.debug && playingState.moveInterrupted) {
      setTimeout(() => {}, this._debugNodeSwitchTime);
    } else if (playingState.debug) {
      const flowNode = this.dialogController.state.nodes.find(
        (n) => n.id === nodeId,
      ) as GraphNode | undefined;
      if (flowNode) {
        playingState.moveInterrupted = !this.viewportHelper.moveToNodes(
          [flowNode],
          {
            duration: this._debugNodeSwitchTime,
            interpolate: 'linear',
            maxZoom: Math.min(
              this.viewportHelper.zoom,
              this.viewportHelper.maxZoom,
            ),
          },
        );
      }
    }
  }

  private _pushHistory(playNode: ScriptPlayNode) {
    if (!this._playingState) return;
    const pointer = ++this._playingState.historyPointer;
    this._playingState.history.splice(pointer);
    this._playingState.history.push(playNode);
  }

  public async play(debug: boolean = false) {
    if (this._playingState) return;

    this._waitingForSpeech = false;
    this._triggerResolve = null;
    this._triggerOutputs = {};
    this._externalPause = false;

    this._playingState = {
      history: [],
      historyPointer: -1,
      stop: false,
      moveInterrupted: false,
      debug,
      dialog: null,
    };

    if (!debug) {
      this._initDemoMode();
    }

    try {
      await this._player.play();
    } finally {
      if (this._playingState && !this._playingState.stop) {
        this._scriptEnded = true;
      }
    }
  }
}
