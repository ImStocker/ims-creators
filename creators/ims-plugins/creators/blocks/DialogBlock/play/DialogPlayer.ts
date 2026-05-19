import type { GraphNode } from '@vue-flow/core';
import {
  createScriptPlayContext,
  getScriptPlayContextNodeParam,
  setScriptPlayContextNodeParam,
  type ScriptPlayContext,
} from './ScriptPlayContext';
import { ScriptPlayGraph } from './ScriptPlayGraph';
import { extractDialogBlockPlain } from '../editor/DialogEditor';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { FlowViewportHelper } from '../editor/FlowViewportHelper';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { ScriptPlayNode } from './ScriptPlayNode';
import type { AssetPropValue } from '~ims-app-base/logic/types/Props';
import DialogManager, {
  type DialogHandler,
} from '~ims-app-base/logic/managers/DialogManager';
import PlayerDialog from './PlayerDemoDialog.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';

type DialogPlayingState = {
  history: ScriptPlayContext[];
  historyPointer: number;
  pausePromise: Promise<void> | null;
  pauseResolve: (() => void) | null;
  choosePromise: Promise<{ choice: number | null; cancelled: boolean }> | null;
  chooseResolve:
    | ((res: { choice: number | null; cancelled: boolean }) => void)
    | null;
  stop: boolean;
  moveInterrupted: boolean;
  debug: boolean;
  dialog: DialogHandler<void> | null;
};

export class DialogPlayer {
  private _playingState: DialogPlayingState | null = null;
  private _debugNodeSwitchTime = 1000;

  constructor(
    protected appManager: IAppManager,
    protected dialogController: DialogBlockController,
    protected viewportHelper: FlowViewportHelper,
    protected projectContext: IProjectContext,
  ) {}

  get isPlaying() {
    return !!this._playingState;
  }

  get isPaused() {
    return (
      !!this._playingState &&
      (!!this._playingState.pausePromise || !!this._playingState.choosePromise)
    );
  }

  get isPlayDebug() {
    return !!this._playingState?.debug;
  }

  get canResume() {
    return (
      this.isPaused &&
      ((!!this._playingState && !!this._playingState.pausePromise) ||
        this._getFirstAvailableChoice() !== false)
    );
  }

  get canHistoryBack() {
    return !!this._playingState && this._playingState.historyPointer > 1;
  }

  get canHistoryForward() {
    return (
      !!this._playingState &&
      this._playingState.historyPointer < this._playingState.history.length - 1
    );
  }

  goHistoryBack() {
    if (!this._playingState || !this.canHistoryBack) {
      return;
    }
    this.pause();
    this._playingState.historyPointer--;
    this._playStepActivate(
      this._playingState,
      this._playingState.history[this._playingState.historyPointer],
    );
  }

  goHistoryForward() {
    if (!this._playingState || !this.canHistoryForward) {
      return;
    }
    this.pause();
    this._playingState.historyPointer++;
    this._playStepActivate(
      this._playingState,
      this._playingState.history[this._playingState.historyPointer],
    );
  }

  private _getFirstAvailableChoice(): number | null | false {
    const node = this.currentPlayingNode;
    if (!node) return false;
    if (node.type !== 'speech' || !node.options?.length) {
      return null;
    }
    for (
      let option_index = 0;
      option_index < node.options.length;
      option_index++
    ) {
      const option_values = node.options[option_index].values;
      if (
        !option_values ||
        option_values.condition === undefined ||
        option_values.condition
      ) {
        return option_index;
      }
    }
    return false;
  }

  get currentPlayingNode(): ScriptPlayNode | null {
    if (!this._playingState || this._playingState.historyPointer < 0) {
      return null;
    }
    return this._playingState.history[this._playingState.historyPointer]
      .currentNode;
  }

  getLastPlayNode(node_id: string): ScriptPlayNode | null {
    if (!this._playingState) {
      return null;
    }
    for (let p = this._playingState.historyPointer; p >= 0; p--) {
      if (this._playingState.history[p].currentNode?.id === node_id) {
        return this._playingState.history[p].currentNode;
      }
    }
    return null;
  }

  getFlowEdgePlayState(
    source_id: string,
    target_id: string,
  ): 'current' | 'visited' | null {
    if (!this._playingState) {
      return null;
    }
    for (
      let target_h = this._playingState.historyPointer;
      target_h >= 1;
      target_h--
    ) {
      const source_h = target_h - 1;
      const target_context = this._playingState.history[target_h];
      if (target_context.currentNode?.id !== target_id) {
        continue;
      }
      const source_context = this._playingState.history[source_h];
      if (source_context.currentNode?.id !== source_id) {
        continue;
      }
      return target_h === this._playingState.historyPointer
        ? 'current'
        : 'visited';
    }
    return null;
  }

  public pause() {
    if (!this._playingState) {
      return;
    }
    const playing_state = this._playingState;
    if (playing_state.pausePromise) {
      return;
    }
    playing_state.pausePromise = new Promise<void>((resolve) => {
      playing_state.pauseResolve = resolve;
    });
    this._playChooseImpl({
      cancelled: true,
      choice: null,
    });
  }

  private _unpause() {
    if (!this._playingState) {
      return;
    }
    if (this._playingState.pauseResolve) {
      this._playingState.pauseResolve();
      this._playingState.pausePromise = null;
      this._playingState.pauseResolve = null;
    }
  }

  public resume() {
    if (!this._playingState) {
      return;
    }
    this._unpause();
    if (this._playingState.chooseResolve) {
      const option = this._getFirstAvailableChoice();
      if (option !== false) {
        this._playChooseImpl({
          choice: option,
          cancelled: false,
        });
      }
    }
  }

  public stop() {
    if (!this._playingState) {
      return;
    }
    this._playingState.stop = true;
    this.resume();
    this._playChooseImpl({
      cancelled: true,
      choice: null,
    });
    this._destroyDemoMode();
    this._playingState = null;
  }

  public async restart() {
    const was_debug = !!this._playingState?.debug;
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1));
    await this.play(was_debug);
  }

  private _playChooseImpl(choose: {
    choice: number | null;
    cancelled: boolean;
  }) {
    if (!this._playingState) {
      return;
    }
    if (!this._playingState.chooseResolve) {
      return;
    }
    this._playingState.chooseResolve(choose);
    this._playingState.choosePromise = null;
    this._playingState.chooseResolve = null;
  }

  public async playChoose(choice: number | null) {
    this._unpause();
    await new Promise((res) => setTimeout(res, 1));
    this._playChooseImpl({
      choice,
      cancelled: false,
    });
  }

  public playGetCurrentNodeParam(param: string): AssetPropValue {
    if (!this._playingState) {
      return null;
    }
    if (this._playingState.historyPointer < 0) {
      return null;
    }
    const last = this._playingState.history[this._playingState.historyPointer];
    if (!last.currentNode) {
      return null;
    }
    return getScriptPlayContextNodeParam(last, last.currentNode.id, param);
  }

  public playSetCurrentNodeParam(param: string, value: AssetPropValue): void {
    if (!this._playingState) {
      return;
    }
    if (this._playingState.historyPointer < 0) {
      return;
    }
    const last = this._playingState.history[this._playingState.historyPointer];
    if (!last.currentNode) {
      return;
    }
    return setScriptPlayContextNodeParam(
      last,
      last.currentNode.id,
      param,
      value,
    );
  }

  private _initDemoMode() {
    if (!this._playingState) {
      return;
    }

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
    if (!this._playingState) {
      return;
    }

    if (this._playingState.dialog) {
      this._playingState.dialog.close();
      this._playingState.dialog = null;
    }
  }

  public setPlayMode(debug: boolean) {
    if (!this._playingState) {
      return;
    }

    if (this._playingState.debug === debug) {
      return;
    }

    this._playingState.debug = debug;
    if (debug) {
      this._destroyDemoMode();
      const current_node = this.currentPlayingNode;
      this._playingState.moveInterrupted = false;
      if (current_node) {
        this._moveViewportToNode(current_node.id);
      }
    } else {
      this._initDemoMode();
    }
  }

  private async _moveViewportToNode(node_id: string) {
    const flow_node = this.dialogController.state.nodes.find(
      (n) => n.id === node_id,
    ) as GraphNode | undefined;
    if (flow_node) {
      return await this.viewportHelper.moveToNodes([flow_node], {
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

  private async _playStepActivate(
    playing_state: DialogPlayingState,
    context: ScriptPlayContext,
  ) {
    const current_node = context.currentNode;

    if (current_node) {
      let need_choose = false;
      if (
        current_node.type === 'speech' &&
        (!playing_state.debug || current_node.options?.length)
      ) {
        need_choose = true;
      }
      if (
        current_node.type === 'trigger' &&
        (!playing_state.debug ||
          (current_node.params && current_node.params.out.length > 0))
      ) {
        need_choose = true;
      }
      if (need_choose) {
        if (!playing_state.choosePromise) {
          playing_state.choosePromise = new Promise<{
            choice: number | null;
            cancelled: boolean;
          }>((resolve) => {
            playing_state.chooseResolve = resolve;
          });
        }
      } else {
        this._playChooseImpl({
          choice: null,
          cancelled: true,
        });
      }
    }

    if (current_node && playing_state.debug) {
      if (playing_state.moveInterrupted) {
        await new Promise((resolve) =>
          setTimeout(resolve, this._debugNodeSwitchTime),
        );
      } else {
        const flow_node = this.dialogController.state.nodes.find(
          (n) => n.id === current_node.id,
        ) as GraphNode | undefined;
        if (flow_node) {
          playing_state.moveInterrupted =
            !(await this.viewportHelper.moveToNodes([flow_node], {
              duration: this._debugNodeSwitchTime,
              interpolate: 'linear',
              maxZoom: Math.min(
                this.viewportHelper.zoom,
                this.viewportHelper.maxZoom,
              ),
            }));
        }
      }
    }
  }

  public async play(debug: boolean = false) {
    if (this._playingState) {
      return;
    }
    await this.appManager.get(UiManager).doTask(async () => {
      this._playingState = {
        pausePromise: null,
        pauseResolve: null,
        choosePromise: null,
        chooseResolve: null,
        history: [],
        historyPointer: -1,
        stop: false,
        moveInterrupted: false,
        debug,
        dialog: null,
      };
      const playing_state = this._playingState; // NOTE: take reactive ref
      if (!debug) {
        this._initDemoMode();
      }
      try {
        let context = createScriptPlayContext(
          this.dialogController.getVariables(),
        );

        while (!context.ended) {
          playing_state.history = [
            ...playing_state.history.slice(0, playing_state.historyPointer + 1),
            context,
          ];
          playing_state.historyPointer++;

          await this._playStepActivate(playing_state, context);

          let choice: number | null = null;
          while (true) {
            if (playing_state.pausePromise) {
              await playing_state.pausePromise;
            }

            if (playing_state.stop) {
              return;
            }

            if (playing_state.choosePromise) {
              const choose_res = await playing_state.choosePromise;
              playing_state.moveInterrupted = false;
              playing_state.choosePromise = null;
              playing_state.chooseResolve = null;
              if (choose_res.cancelled) {
                continue;
              }
              choice = choose_res.choice;
            }
            if (playing_state.stop) {
              return;
            }

            break;
          }

          const activated_context =
            playing_state.history[playing_state.historyPointer]; // NOTE: can be chnaged if user use back/forward

          const graph = new ScriptPlayGraph(
            extractDialogBlockPlain(
              this.dialogController.resolvedBlock.computed,
            ),
          );
          context = graph.step(activated_context, choice);
        }
      } finally {
        if (!playing_state.stop) {
          this.stop();
        }
      }
    });
  }
}
