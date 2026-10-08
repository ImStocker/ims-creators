import type { Component } from 'vue';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type LevelEditorCanvasController from '../../../LevelEditorCanvasController';
import type { ToolSection } from '../../ToolManager';

export default abstract class Tool {
  abstract readonly name: string;
  abstract readonly icon?: string | null;
  abstract component: () => Promise<Component>;
  componentProps?: Record<string, any>;
  public readonly = false;
  readonly exclusiveGroup?: string;
  readonly isDefaultInGroup?: boolean = false;
  hideWhenDisabled: boolean = false;
  /**
   * Инструмент вставки фигуры: при удержании Ctrl не деактивируется после
   * вставки, позволяя вставлять несколько фигур подряд. Подсказка в
   * тултипе кнопки показывается только для таких инструментов.
   */
  supportsMultiInsert: boolean = false;

  abstract section: ToolSection;

  protected _onDeactivateCallback: (() => void) | null = null;
  protected readonly appManager: IAppManager;

  readonly controller: LevelEditorCanvasController;

  constructor(
    appManager: IAppManager,
    controller: LevelEditorCanvasController,
  ) {
    this.controller = controller;
    this.appManager = appManager;
  }

  init() {}

  activate(onDeactivate?: () => void) {
    this._onDeactivateCallback = onDeactivate ?? null;
    this.onActivate();
  }

  deactivate() {
    if (this._onDeactivateCallback) this._onDeactivateCallback();
    this.onDeactivate();
  }

  onDeactivate() {}
  onActivate() {}
  onInit() {}

  isDisabled() {
    return false;
  }

  isLoading() {
    return false;
  }

  /**
   * Оставить инструмент активным после вставки: поддерживается только
   * инструментами с supportsMultiInsert и только при удержании Ctrl/Cmd.
   */
  protected shouldKeepActiveAfterInsert(
    e?: { ctrlKey?: boolean; metaKey?: boolean } | null,
  ): boolean {
    if (!this.supportsMultiInsert) return false;
    return !!(e && (e.ctrlKey || e.metaKey));
  }
}
