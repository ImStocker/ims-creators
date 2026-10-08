import type { Component } from 'vue';
import type LevelEditorCanvasController from '../LevelEditorCanvasController';
import type { LevelEditorShape } from '../LevelEditor';
import NumberField from '../side-panel/fields/NumberField.vue';
import ChangeColorButton from '../side-panel/fields/ChangeColorDropdown.vue';
import ButtonField from '../side-panel/fields/ButtonField.vue';
import ValueField from '../side-panel/fields/ValueField.vue';

export type ColorSet = {
  fill: string;
  stroke: string;
};

export type ShapePropertyDescriptorSection =
  | 'main'
  | 'color'
  | 'other'
  | 'default';

export const DEFAULT_FIELD_CONFIG = {
  color: {
    cssClass: 'group-color',
    showTitle: false,
  },
  lock: {
    showTitle: false,
  },
};

export const DEFAULT_COLOR_PRESET = {
  fill: '#EED81133',
  stroke: '#EED811',
};

export const TEXTBOX_DEFAULT_COLOR_PRESET = {
  fill: '#ffffff',
  stroke: '#ffffff',
};

export const COLOR_PRESETS: ColorSet[] = [
  DEFAULT_COLOR_PRESET,
  {
    fill: '#3dee114d',
    stroke: '#3dee11ff',
  },
  {
    fill: '#11eee34d',
    stroke: '#11eee3ff',
  },
  {
    fill: '#a811ee4d',
    stroke: '#a811eeff',
  },
  {
    fill: '#ee11234d',
    stroke: '#ee1123ff',
  },
  {
    fill: '#ffffff4d',
    stroke: '#ffffff',
  },
  {
    fill: '#0000004d',
    stroke: '#000000',
  },
  {
    fill: '#EED811',
    stroke: '#EED811',
  },
  {
    fill: '#3dee11',
    stroke: '#3dee11ff',
  },
  {
    fill: '#11eee3',
    stroke: '#11eee3ff',
  },
  {
    fill: '#a811ee',
    stroke: '#a811eeff',
  },
  {
    fill: '#ee1123',
    stroke: '#ee1123ff',
  },
  {
    fill: '#ffffff',
    stroke: '#ffffff',
  },
  {
    fill: '#000000',
    stroke: '#000000',
  },
];

export type ShapePropertyDescriptor<
  T extends LevelEditorShape = LevelEditorShape,
  V = any,
> = {
  key: string;
  title: string;
  group?: keyof typeof DEFAULT_FIELD_CONFIG | string;
  section?: ShapePropertyDescriptorSection;
  index?: number;
  editorComponent: Component;
  editorProps?: Record<string, any>;
  get: (shape: T, controller: LevelEditorCanvasController) => V;
  set: (shape: T, value: V, controller: LevelEditorCanvasController) => void;
};

export type ShapePropertyField = {
  title: string;
  props: ShapePropertyDescriptor[];
  cssClass?: string;
  showTitle?: boolean;
};

export type ShapePropertyFieldSection = {
  name: ShapePropertyDescriptorSection;
  fields: ShapePropertyField[];
};

export const POSITION_PROPERTY_DESCRIPTORS: ShapePropertyDescriptor[] = [
  {
    key: 'x',
    title: 'X',
    group: 'position',
    section: 'main',
    index: 0,
    editorComponent: NumberField,
    editorProps: {
      icon: {
        type: 'text',
        value: 'X',
      },
    },
    get: (shape, _controller) => shape.x ?? 0,
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { x: value },
        { expectPropsChange: false },
      );
    },
  },
  {
    key: 'y',
    title: 'Y',
    group: 'position',
    section: 'main',
    index: 1,
    editorComponent: NumberField,
    editorProps: {
      icon: {
        type: 'text',
        value: 'Y',
      },
    },
    get: (shape, _controller) => shape.y ?? 0,
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { y: value },
        { expectPropsChange: false },
      );
    },
  },
];

export const COLOR_PROPERTY_DESCRIPTORS: ShapePropertyDescriptor<
  Extract<LevelEditorShape, { params: { fill?: string; stroke?: string } }>
>[] = [
  {
    key: 'colorPreset',
    title: 'ColorPreset',
    group: 'color',
    section: 'color',
    editorComponent: ChangeColorButton,
    editorProps: {
      colors: COLOR_PRESETS,
    },
    get: (shape, _controller) => {
      return {
        fill:
          // TODO: add ability to remove stroke or fill color
          shape.params.fill ??
          (shape.type === 'textbox'
            ? TEXTBOX_DEFAULT_COLOR_PRESET.fill
            : DEFAULT_COLOR_PRESET.fill),
        stroke:
          shape.params.stroke ??
          (shape.type === 'textbox'
            ? TEXTBOX_DEFAULT_COLOR_PRESET.stroke
            : DEFAULT_COLOR_PRESET.stroke),
      };
    },
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { params: { ...value } },
        { expectPropsChange: false },
      );
    },
  },
  {
    key: 'colorFill',
    title: 'ColorFill',
    group: 'color',
    section: 'color',
    editorComponent: ChangeColorButton,
    editorProps: {
      colors: COLOR_PRESETS,
      editProp: 'fill',
    },
    get: (shape, _controller) => {
      return {
        fill:
          shape.params.fill ??
          (shape.type === 'textbox'
            ? TEXTBOX_DEFAULT_COLOR_PRESET.fill
            : DEFAULT_COLOR_PRESET.fill),
      };
    },
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { params: { fill: value.fill } },
        { expectPropsChange: false },
      );
    },
  },
  {
    key: 'colorStroke',
    title: 'ColorStroke',
    group: 'color',
    section: 'color',
    editorComponent: ChangeColorButton,
    editorProps: {
      colors: COLOR_PRESETS,
      editProp: 'stroke',
    },
    get: (shape, _controller) => {
      return {
        stroke:
          shape.params.stroke ??
          (shape.type === 'textbox'
            ? TEXTBOX_DEFAULT_COLOR_PRESET.stroke
            : DEFAULT_COLOR_PRESET.stroke),
      };
    },
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { params: { stroke: value.stroke } },
        { expectPropsChange: false },
      );
    },
  },
];

export const WIDTH_PROPERTY_DESCRIPTOR: ShapePropertyDescriptor<
  Extract<LevelEditorShape, { params: { width?: number } }>
> = {
  key: 'width',
  title: 'Width',
  group: 'size',
  section: 'main',
  index: 0,
  editorComponent: NumberField,
  editorProps: {
    icon: {
      type: 'text',
      value: 'W',
    },
  },
  get: (shape, _controller) => shape.params.width ?? 0,
  set: (shape, value, controller) => {
    controller.changeShape(
      shape.id,
      { params: { width: value >= 0 ? value : 0 } },
      { expectPropsChange: false },
    );
  },
};

export const SIZE_PROPERTY_DESCRIPTORS: ShapePropertyDescriptor<
  Extract<LevelEditorShape, { params: { width?: number; height?: number } }>
>[] = [
  { ...WIDTH_PROPERTY_DESCRIPTOR },
  {
    key: 'height',
    title: 'Height',
    group: 'size',
    section: 'main',
    index: 1,
    editorComponent: NumberField,
    editorProps: {
      icon: {
        type: 'text',
        value: 'H',
      },
    },
    get: (shape, _controller) =>
      'height' in shape.params ? shape.params.height : 0,
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { params: { height: value >= 0 ? value : 0 } } as any,
        {
          expectPropsChange: false,
        },
      );
    },
  },
];

export const LOCK_PROPERTY_DESCRIPTORS: ShapePropertyDescriptor[] = [
  {
    key: 'lock',
    title: 'lock',
    section: 'other',
    index: 0,
    editorComponent: ButtonField,
    editorProps: {
      icon: 'ri-lock-line',
      label: 'lock',
      checkedIcon: 'ri-lock-unlock-line',
      checkedLabel: 'unlock',
    },
    get: (shape, _controller) => shape.locked ?? false,
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { locked: value },
        { expectPropsChange: false },
      );
      controller.canvas.discardActiveObject();
    },
  },
];

export const ROTATION_PROPERTY_DESCRIPTORS: ShapePropertyDescriptor[] = [
  {
    key: 'angle',
    title: 'angle',
    section: 'main',
    index: 0,
    editorComponent: NumberField,
    editorProps: {
      icon: {
        type: 'icon',
        value: 'ri-clockwise-line',
      },
    },
    get: (shape, _controller) => shape.angle ?? 0,
    set: (shape, value, controller) => {
      controller.changeShape(
        shape.id,
        { angle: value },
        { expectPropsChange: false },
      );
    },
  },
];

export function getCommonPropertiesDescriptors(): ShapePropertyDescriptor[] {
  return [
    {
      key: 'value',
      title: 'value',
      editorComponent: ValueField,
      editorProps: {
        type: 'textarea',
      },
      get: (obj, _controller) => obj.value,
      set: (obj, value, controller) => {
        controller.changeShape(obj.id, { value }, { expectPropsChange: false });
      },
    },
    ...POSITION_PROPERTY_DESCRIPTORS,
    ...ROTATION_PROPERTY_DESCRIPTORS,
  ];
}

export function groupDescriptorsIntoSections<TShape extends LevelEditorShape>(
  descriptors: ShapePropertyDescriptor<TShape, any>[],
): ShapePropertyFieldSection[] {
  const sections_map = new Map<string, ShapePropertyFieldSection>();
  const sections: ShapePropertyFieldSection[] = [];

  for (const d of descriptors) {
    const section_name = d.section ?? 'default';

    let section_entry = sections_map.get(section_name);
    if (!section_entry) {
      section_entry = { name: section_name, fields: [] };
      sections_map.set(section_name, section_entry);
      sections.push(section_entry);
    }

    if (d.group) {
      let field = section_entry.fields.find((f) => f.title === d.group);
      if (!field) {
        const field_config = DEFAULT_FIELD_CONFIG[d.group];
        field = {
          title: d.group,
          props: [],
          cssClass: field_config?.cssClass,
          showTitle: field_config?.showTitle ?? true,
        };
        section_entry.fields.push(field);
      }
      field.props.push(d as ShapePropertyDescriptor);
    } else {
      const field_config = DEFAULT_FIELD_CONFIG[d.title];
      section_entry.fields.push({
        title: d.title,
        props: [d as ShapePropertyDescriptor],
        cssClass: field_config?.cssClass,
        showTitle: field_config?.showTitle ?? true,
      });
    }
  }

  for (const section of sections) {
    for (const f of section.fields) {
      if (f.props.length > 1) {
        f.props = f.props
          .slice()
          .sort(
            (a, b) =>
              (a.index ?? Number.POSITIVE_INFINITY) -
              (b.index ?? Number.POSITIVE_INFINITY),
          );
      }
    }
  }

  return sections;
}
