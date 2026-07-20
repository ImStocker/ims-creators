import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { diagramBlockAiSpec } from './DiagramBlockAiSpec';

export class DiagramBlockDefinition extends BlockTypeDefinition {
  name = 'diagram';
  component = async () => (await import('./DiagramBlock.vue')).default;
  icon = 'organization-chart';
  override resizableBlockHeight = true;
  override aiSpec = diagramBlockAiSpec.aiSpec;
}
