import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';

export function getAvailableActionTypes(
  $t: (key: string, params?: any) => string,
) {
  const res: { title: string; icon?: string; value: string }[] = [];
  const available_types = ['trigger', 'function'];
  for (const type of available_types) {
    const node_descriptor = getNodeDescriptorOfType(type);
    res.push({
      title: $t(`imsDialogEditor.nodes.${type}.title`),
      icon: node_descriptor?.icon,
      value: type,
    });
  }
  return res;
}
