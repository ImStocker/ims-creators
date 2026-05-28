import type { GraphNode } from '@vue-flow/core';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { FlowViewportHelper } from '../editor/FlowViewportHelper';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
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
import type {
  ImscScriptPlayerEvaluatedNode,
  ImscScriptPlayerSpeech,
  ImscScriptPlayerState,
} from 'imsc-script';
import { ImscScriptPlayer } from 'imsc-script';
import type {
  ImscScriptGraphNodeTrigger,
  ImscScriptGraphNodeSpeech,
  ImscScriptGraph,
} from 'imsc-script/Graph';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { getActionNodeParams } from '../logic/nodeParams';
import {
  type ScriptPlayNode,
  getScriptPlayNodeFromState,
} from './ScriptPlayNode';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';

type DialogPlayingState = {
  history: ImscScriptPlayerState[];
  historyPointer: number;
  stop: boolean;
  moveInterrupted: boolean;
  debug: boolean;
  dialog: DialogHandler<void, any> | null;
};

type DialogPlayerLoadedScript = {
  id: string;
  graph: ImscScriptGraph;
  controller: DialogBlockController;
  release: () => void;
};

export class DialogPlayer {
  private _playingState: DialogPlayingState | null = null;
  private _debugNodeSwitchTime = 1000;
  private _player: ImscScriptPlayer | null = null;
  private _triggerResolve:
    | ((res: { outputs: Record<string, any> }) => void)
    | null = null;
  private _triggerOutputs: Record<string, AssetPropsPlainObjectValue> = {};
  private _scriptEnded = false;
  private _loadedScripts = new Map<string, DialogPlayerLoadedScript>();
  private _playEpoch = 0;

  constructor(
    protected appManager: IAppManager,
    protected dialogController: DialogBlockController,
    protected viewportHelper: FlowViewportHelper,
    protected projectContext: IProjectContext,
  ) {}

  private _createPlayer() {
    const assetId = this.dialogController.resolvedBlock?.assetId;
    assert(assetId);

    const loadedScript = this._loadedScripts.get(assetId);
    assert(loadedScript);

    const defaultVariableValues = this.dialogController.getVariables().reduce(
      (acc, variable) => {
        acc[variable.name] = variable.default;
        return acc;
      },
      {} as Record<string, AssetPropValue>,
    );

    return new ImscScriptPlayer(loadedScript.graph as ImscScriptGraph, {
      scriptId: assetId,
      initialVariables: defaultVariableValues,
      events: {
        onSpeech: ({ speech, node }) => this._onSpeech(speech, node),
        onAction: ({ subject, inputs, node, nodeId, type }) => {
          if (type === 'trigger') {
            return this._onTrigger(subject, inputs, node, nodeId);
          }
        },
        onNodeEnter: ({ nodeId, node }) => this._onNodeEnter(nodeId, node),
        onEnd: () => {
          if (!this._player) {
            return;
          }
          this._pushHistory(this._player.serialize());
          this._scriptEnded = true;
        },
        onError: ({ error }) => {
          this.appManager.get(UiManager).showError(error);
        },
        onLoadScript: async ({ scriptId }) => {
          const playEpoch = this._playEpoch;
          let loadedScript = this._loadedScripts.get(scriptId);
          if (!loadedScript) {
            const asset = await this.appManager
              .get(CreatorAssetManager)
              .getAssetInstance(scriptId);
            if (!asset) throw new Error('Script asset not found');
            if (playEpoch !== this._playEpoch) {
              throw new Error('Play is aborted');
            }
            const blocks = await asset.resolveBlocks();
            const content_block = blocks.mapNames['content'];
            if (content_block?.type !== 'script') {
              throw new Error('Script not found in asset');
            }
            const context_request = this.appManager
              .get(EditorManager)
              .requestEditorContextForAsset(asset.id);
            const controller = await context_request.promise;
            if (playEpoch !== this._playEpoch) {
              context_request.release();
              throw new Error('Play is aborted');
            }
            if (!controller) {
              throw new Error('Cannot get editor controller');
            }
            const block_controller = controller.getBlockController(
              content_block.id,
            );
            if (!block_controller) {
              throw new Error('Cannot get block controller');
            }
            loadedScript = {
              id: scriptId,
              graph: convertAssetPropsToPlainObject(content_block.computed),
              release: () => context_request.release(),
              controller: block_controller as DialogBlockController,
            };
            this._loadedScripts.set(loadedScript.id, loadedScript);
          }
          assert(loadedScript);

          return loadedScript.graph;
        },
      },
    });
  }

  get isPlaying() {
    return !!this._playingState;
  }

  get isPaused() {
    if (!this._player) return false;
    return this._player.isPaused;
  }

  get isPlayDebug() {
    return !!this._playingState?.debug;
  }

  get canResume() {
    if (!this._player) return false;
    if (this._player.isPaused) return true;
    if (this._triggerResolve) return true;
    const currentNode = this._player.currentFrame.currentNode;
    return currentNode && this._getFirstAvailableChoice(currentNode) !== false;
  }

  get scriptEnded() {
    return this._scriptEnded && this._playingState;
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

  private _getFirstAvailableChoice(
    speech: ImscScriptPlayerEvaluatedNode,
  ): number | null | false {
    for (
      let optionIndex = 0;
      optionIndex < speech.optionsInputs.length;
      optionIndex++
    ) {
      const optionValues = speech.optionsInputs[optionIndex];
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
    const record =
      this._playingState.history[this._playingState.historyPointer];
    return getScriptPlayNodeFromState(record);
  }

  get currentPlayingDialogController(): DialogBlockController | null {
    if (!this._player) return null;
    const loadedScript = this._loadedScripts.get(
      this._player.currentFrame.scriptId ?? '',
    );
    if (!loadedScript) return null;
    return loadedScript.controller;
  }

  get currentPlayingNodeId(): string | null {
    if (
      !this._playingState ||
      this._playingState.historyPointer < 0 ||
      this._playingState.history.length === 0
    ) {
      return null;
    }
    const record =
      this._playingState.history[this._playingState.historyPointer];
    return record.frames[0].currentNode?.id ?? null;
  }

  get lastVisitedNodeId(): string | null {
    if (!this._playingState) {
      return null;
    }
    for (let p = this._playingState.historyPointer; p >= 0; p--) {
      const record = this._playingState.history[p];
      if (record.frames[0].currentNode) {
        return record.frames[0].currentNode.id;
      }
    }
    return null;
  }

  getLastPlayNode(nodeId: string): ScriptPlayNode | null {
    if (!this._playingState) return null;
    for (let p = this._playingState.historyPointer; p >= 0; p--) {
      const record = this._playingState.history[p];
      if (record.frames[0].currentNode?.id === nodeId) {
        return getScriptPlayNodeFromState(record);
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
      const targetContext = getScriptPlayNodeFromState(
        this._playingState.history[targetH],
      );
      if (targetContext?.id !== targetId) continue;
      const sourceContext = getScriptPlayNodeFromState(
        this._playingState.history[sourceH],
      );
      if (sourceContext?.id !== sourceId) continue;
      return targetH === this._playingState.historyPointer
        ? 'current'
        : 'visited';
    }
    return null;
  }

  private _loadCurrentStateFromHistory() {
    if (!this._playingState || !this._player) {
      return;
    }
    const record =
      this._playingState.history[this._playingState.historyPointer];
    this._player.load(record);
    const graph = record.frames[0].graph;
    this._scriptEnded = !record.frames[0].currentNode;
    const currentGraphNode = record.frames[0].currentNode
      ? graph.nodes[record.frames[0].currentNode.id]
      : null;
    if (currentGraphNode?.type === 'trigger') {
      this._player.resume(); // Need call trigger to await user input
    }
    const node_id = getScriptPlayNodeFromState(record)?.id ?? null;
    if (node_id) {
      this._moveViewportToNode(node_id);
    }
  }

  goHistoryBack() {
    if (!this._playingState || !this.canHistoryBack || !this._player) {
      return;
    }
    this._playingState.historyPointer--;
    this._loadCurrentStateFromHistory();
  }

  goHistoryForward() {
    if (!this._playingState || !this.canHistoryForward || !this._player) {
      return;
    }
    this._playingState.historyPointer++;
    this._loadCurrentStateFromHistory();
  }

  public pause() {
    if (!this._player) return;
    this._player.pause();
  }

  public resume() {
    if (!this._playingState) return;
    if (!this._player) return;
    this._scriptEnded = false;
    const currentNode = this._player.currentFrame.currentNode;
    this._player.resume();
    if (currentNode) {
      const option = this._getFirstAvailableChoice(currentNode);
      if (option !== false) {
        this.playChoose(option);
      }
    }
  }

  public stop() {
    if (!this._playingState) return;
    if (!this._player) return;
    this._player.end();
    this._destroyDemoMode();
    this._playingState = null;
    this._triggerResolve = null;
    this._scriptEnded = false;
    this._player = null;
    for (const loadedScript of this._loadedScripts.values()) {
      loadedScript.release();
    }
    this._loadedScripts = new Map();
  }

  public async restart() {
    const wasDebug = !!this._playingState?.debug;
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.play(wasDebug);
  }

  public async playChoose(choice: number | null) {
    if (this._triggerResolve) {
      const outputs = { ...this._triggerOutputs };
      this._triggerOutputs = {};
      const resolve = this._triggerResolve;
      this._triggerResolve = null;
      resolve({
        outputs,
      });
    } else if (this._player) {
      this._player.continue(choice ?? undefined, true);
    }
  }

  public playGetCurrentNodeParam(param: string): AssetPropsPlainObjectValue {
    return this._triggerOutputs[param] ?? null;
  }

  public playSetCurrentNodeParam(
    param: string,
    value: AssetPropsPlainObjectValue,
  ): void {
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
    if (!this._player) return;

    const isDebug = this._playingState.debug;

    if (isDebug && (!node.options || node.options.length === 0)) {
      this._player.continue();
    }
  }

  private _onTrigger(
    subject: string,
    inputs: Record<string, AssetPropsPlainObjectValue>,
    node: ImscScriptGraphNodeTrigger,
    nodeId: string,
  ):
    | void
    | { outputs: Record<string, any> }
    | Promise<{ outputs: Record<string, any> } | void> {
    if (!this._playingState) return;
    if (!this._player) return;

    const loadedScript = this._loadedScripts.get(
      this._player.currentFrame.scriptId ?? '',
    );
    assert(loadedScript);
    const isDebug = this._playingState.debug;
    const params = getActionNodeParams(
      (node as any).params ?? { in: [], out: [] },
      subject,
      loadedScript.controller.getActions(),
      node.values as any,
    );
    const hasOutputParams = params.outputParameters.length;
    const needWait = !isDebug || hasOutputParams;

    if (needWait) {
      const prev_state =
        this._playingState.history.length > 1
          ? this._playingState.history[this._playingState.history.length - 2]
          : null;
      this._triggerOutputs = prev_state
        ? { ...(prev_state.frames[0].nodeOutputs[nodeId] ?? {}) }
        : {};
      return new Promise<{
        outputs: Record<string, any>;
      }>((resolve) => {
        this._triggerResolve = resolve;
      });
    }

    return { outputs: {} };
  }

  private async _onNodeEnter(nodeId: string, _node: any) {
    if (!this._player) return;
    if (!this._playingState) return;
    const playingState = this._playingState;

    this._pushHistory(this._player.serialize());

    if (playingState.debug && playingState.moveInterrupted) {
      await new Promise((r) => setTimeout(r, this._debugNodeSwitchTime));
    } else if (playingState.debug) {
      const flowNode = this.dialogController.state.nodes.find(
        (n) => n.id === nodeId,
      ) as GraphNode | undefined;
      if (flowNode) {
        playingState.moveInterrupted = !(await this.viewportHelper.moveToNodes(
          [flowNode],
          {
            duration: this._debugNodeSwitchTime,
            interpolate: 'linear',
            maxZoom: Math.min(
              this.viewportHelper.zoom,
              this.viewportHelper.maxZoom,
            ),
          },
        ));
      }
    }
  }

  private _pushHistory(record: ImscScriptPlayerState) {
    if (!this._playingState) return;
    const pointer = ++this._playingState.historyPointer;
    this._playingState.history.splice(pointer);
    this._playingState.history.push(record);
  }

  public play(debug: boolean = false) {
    if (this._playingState) return;
    if (!this.dialogController.resolvedBlock) return;

    this._loadedScripts = new Map<string, DialogPlayerLoadedScript>();
    this._loadedScripts.set(this.dialogController.resolvedBlock.assetId, {
      id: this.dialogController.resolvedBlock.assetId,
      controller: this.dialogController,
      graph: convertAssetPropsToPlainObject(
        this.dialogController.resolvedBlock.computed,
      ),
      release: () => {},
    });
    this._triggerResolve = null;
    this._triggerOutputs = {};

    this._player = this._createPlayer();

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

    ++this._playEpoch;
    this._player.play();
  }
}
