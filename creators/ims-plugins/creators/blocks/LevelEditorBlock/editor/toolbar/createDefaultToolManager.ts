import type { Canvas } from 'fabric';
import ToolManager from './ToolManager';
import SelectTool from './tools/SelectTool';
import RectTool from './tools/RectTool';
import EllipseTool from './tools/EllipseTool';
// import PenTool from './tools/PenTool';
import PencilTool from './tools/PencilTool';
import PolygonTool from './tools/PolygonTool';
// import ZoomTool from './tools/ZoomTool';
import { reactive } from 'vue';
import BringToFrontTool from './tools/BringToFrontTool';
import BringForwardTool from './tools/BringForwardTool';
import SendBackwardTool from './tools/SendBackwardTool';
import SendToBackTool from './tools/SendToBackTool';
import ImageTool from './tools/ImageTool';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import PointerTool from './tools/PointerTool';
import type LevelEditorCanvasController from '../LevelEditorCanvasController';
// import LockTool from './tools/LockTool';
import UnlockAllTool from './tools/UnlockAllTool';
import ViewAllTool from './tools/ViewAllTool';
// import SelectColorPresetTool from './tools/SelectColorPresetTool';
// import SelectStrokeColorTool from './tools/SelectStrokeColorTool';
// import SelectFillColorTool from './tools/SelectFillColorTool';
import TextTool from './tools/TextTool';
import GroupTool from './tools/GroupTool';
import UngroupTool from './tools/UngroupTool';

export default function createDefaultToolManager(
  canvas: Canvas,
  appManager: IAppManager,
  controller: LevelEditorCanvasController,
) {
  const raw_controller = controller;
  const manager = reactive(new ToolManager(canvas));

  const tools = [
    new SelectTool(appManager, raw_controller),
    new RectTool(appManager, raw_controller),
    new EllipseTool(appManager, raw_controller),
    new PolygonTool(appManager, raw_controller),
    new PencilTool(appManager, raw_controller),
    // new PenTool(appManager, controller),
    new ImageTool(appManager, raw_controller),
    new PointerTool(appManager, raw_controller),
    new TextTool(appManager, raw_controller),
    // new ZoomTool(appManager, controller),
    new BringToFrontTool(appManager, raw_controller),
    new BringForwardTool(appManager, raw_controller),
    new SendBackwardTool(appManager, raw_controller),
    new SendToBackTool(appManager, raw_controller),
    new GroupTool(appManager, raw_controller),
    new UngroupTool(appManager, raw_controller),

    // new LockTool(appManager, raw_controller),
    new UnlockAllTool(appManager, raw_controller),
    new ViewAllTool(appManager, raw_controller),
    // new SelectColorPresetTool(appManager, raw_controller),
    // new SelectFillColorTool(appManager, raw_controller),
    // new SelectStrokeColorTool(appManager, raw_controller),
  ];

  for (const tool of tools) {
    const reactive_tool = manager.register(tool);
    if (reactive_tool) reactive_tool.init();
  }

  return manager;
}
