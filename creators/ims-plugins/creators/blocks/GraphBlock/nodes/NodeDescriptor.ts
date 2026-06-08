import type { Component } from 'vue';

export type NodeDescriptor = {
  name: string;
  icon: string;
  node: Component;
  color: string;
  initData?: () => { text?: string };
};
