import { FabricObject, iMatrix } from 'fabric';
import * as fabric from 'fabric';

export const INF_GRID_OBJECT_TYPE = 'infgrid';

export class InfiniteGrid extends FabricObject {
  static override type = INF_GRID_OBJECT_TYPE;
  private _cellWidth = 20;
  private _cellHeight = 20;
  private _dotRadius = 1;
  private _dotColor: string = '#81818a';

  constructor(options = {}) {
    super(options);
    this.selectable = false;
    this.evented = false;
  }

  setCellSize(width: number, height: number) {
    const cell_width = width > 0 ? width : this._cellWidth;
    const cell_height = height > 0 ? height : this._cellHeight;
    if (cell_width === this._cellWidth && cell_height === this._cellHeight) {
      return;
    }
    this._cellWidth = cell_width;
    this._cellHeight = cell_height;
    this.dirty = true;
    this.canvas?.requestRenderAll();
  }

  private _createPattern() {
    const temp_canvas = document.createElement('canvas');
    temp_canvas.width = this._cellWidth;
    temp_canvas.height = this._cellHeight;

    const temp_ctx = temp_canvas.getContext('2d');
    if (!temp_ctx) return;

    temp_ctx.fillStyle = this._dotColor;
    temp_ctx.beginPath();
    temp_ctx.arc(0, 0, this._dotRadius, 0, Math.PI * 2);
    temp_ctx.fill();

    return temp_ctx.createPattern(temp_canvas, 'repeat');
  }

  override render(ctx: CanvasRenderingContext2D) {
    const zoom = this.canvas?.getZoom() ?? 1;
    const viewport_matrix = this.canvas?.viewportTransform ?? iMatrix;
    const decompose = fabric.util.qrDecompose(viewport_matrix);

    const canvas_width = this.canvas?.width ?? 1000;
    const canvas_height = this.canvas?.height ?? 1000;

    const pattern = this._createPattern() ?? null;

    if (!pattern) return;

    ctx.save();

    ctx.fillStyle = pattern;

    const pattern_offset_x = decompose.translateX / zoom;
    const pattern_offset_y = decompose.translateY / zoom;

    ctx.fillRect(
      -pattern_offset_x,
      -pattern_offset_y,
      canvas_width / zoom,
      canvas_height / zoom,
    );

    ctx.restore();
  }

  override _renderControls(_: CanvasRenderingContext2D) {}
  _renderBorder(_: CanvasRenderingContext2D) {}
}
