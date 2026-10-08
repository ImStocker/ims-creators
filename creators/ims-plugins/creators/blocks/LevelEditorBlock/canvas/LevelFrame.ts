import { FabricObject } from 'fabric';

export const LEVEL_FRAME_OBJECT_TYPE = 'levelframe';

/**
 * Визуальная рамка уровня (level\width × level\height). Только отрисовка:
 * без клампинга, выделения и событий. Позиция (0,0), размер — в единицах
 * сцены.
 */
export class LevelFrame extends FabricObject {
  static override type = LEVEL_FRAME_OBJECT_TYPE;

  private _strokeColor = 'rgba(83, 139, 226, 0.9)';

  constructor(options: Partial<{ width: number; height: number }> = {}) {
    super({
      left: 0,
      top: 0,
      width: options.width ?? 0,
      height: options.height ?? 0,
      selectable: false,
      evented: false,
      objectCaching: false,
      excludeFromExport: true,
    });
    this.selectable = false;
    this.evented = false;
    this.objectCaching = false;
  }

  setSize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.set({ width, height });
    this.setCoords();
    this.dirty = true;
    this.canvas?.requestRenderAll();
  }

  override _render(ctx: CanvasRenderingContext2D) {
    const width = this.width ?? 0;
    const height = this.height ?? 0;
    if (width <= 0 || height <= 0) return;

    const zoom = this.canvas?.getZoom() ?? 1;

    ctx.save();

    ctx.strokeStyle = this._strokeColor;
    ctx.lineWidth = 1 / zoom;
    // Локальные координаты fabric центрированы (0,0 — центр объекта),
    // как у Rect._render — поэтому рисуем от -w/2, -h/2, чтобы рамка
    // начиналась в left/top сцены (0,0 для уровня).
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore();
  }

  override _renderControls(_: CanvasRenderingContext2D) {}
  _renderBorder(_: CanvasRenderingContext2D) {}
}
