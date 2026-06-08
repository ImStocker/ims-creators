import type { AssetPropValue } from '~ims-app-base/logic/types/Props';

export type GraphLinkSide = 'top' | 'left' | 'bottom' | 'right';

export type GraphLink = {
  to: string;
  toSide?: GraphLinkSide;
  fromSide?: GraphLinkSide;
};

export type GraphBlockPlainNode = {
  type: string;
  value?: AssetPropValue;
  width: number;
  height: number;
  pos: {
    x: number;
    y: number;
  };
  index: number;
  links: GraphLink[];
};

export type GraphBlockPlain = {
  nodes: {
    [id: string]: GraphBlockPlainNode;
  };
};
