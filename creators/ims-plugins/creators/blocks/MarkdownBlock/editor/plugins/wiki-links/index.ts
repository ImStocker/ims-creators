import { autocompletion } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { Tag, tags as highlightTags } from '@lezer/highlight';
import type { MarkdownConfig } from '@lezer/markdown';
import { completions } from './completions';
import { replacements } from './replacements';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';

const LEFT_BRACKET_CODE = 91;
const RIGHT_BRACKET_CODE = 93;

export type PluginConfig = {
  appManager: IAppManager;
};

const tags = {
  wikiLink: Tag.define(),
  wikiLinkMark: Tag.define(),
};

const WikiLinkStartDelimiter = {};

const grammar: MarkdownConfig = {
  defineNodes: [
    {
      name: 'WikiLink',
      style: tags.wikiLink,
    },
    {
      name: 'WikiLinkMark',
      style: [tags.wikiLinkMark, highlightTags.processingInstruction],
    },
  ],
  parseInline: [
    {
      name: 'WikiLinkStart',
      parse(cx, next, pos) {
        return next === LEFT_BRACKET_CODE &&
          cx.char(pos + 1) === LEFT_BRACKET_CODE
          ? cx.addDelimiter(WikiLinkStartDelimiter, pos, pos + 2, true, false)
          : -1;
      },
      after: 'Emphasis',
    },
    {
      name: 'WikiLink',
      parse(cx, next, pos) {
        if (
          !(
            next === RIGHT_BRACKET_CODE &&
            cx.char(pos + 1) === RIGHT_BRACKET_CODE
          )
        ) {
          return -1;
        }

        // @ts-expect-error private api
        const parts = cx.parts;
        const open_delimiter_index = cx.findOpeningDelimiter(
          WikiLinkStartDelimiter,
        );

        if (
          open_delimiter_index !== null &&
          Number.isInteger(open_delimiter_index)
        ) {
          const start = parts[open_delimiter_index].from;
          const end = pos + 2;
          const content = cx.takeContent(open_delimiter_index);

          content.unshift(cx.elt('WikiLinkMark', start, start + 2));
          content.push(cx.elt('WikiLinkMark', end - 2, end));

          const ref = (parts[open_delimiter_index] = cx.elt(
            'WikiLink',
            start,
            end,
            content,
          ));

          return ref.to;
        }

        return -1;
      },
      after: 'WikiLinkStart',
    },
  ],
};

const theme = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: tags.wikiLink,
    },
    {
      tag: tags.wikiLinkMark,
    },
  ]),
);

export const wikiLinks = (config: PluginConfig) => {
  return [
    { type: 'completion', value: completions(config) },
    { type: 'default', value: theme },
    { type: 'default', value: replacements(config) },
    { type: 'grammar', value: grammar },
  ];
};

export const wikiLinkGrammar: MarkdownConfig = grammar;

export const wikiLinkCellExtensions = (config: PluginConfig): Extension[] => {
  return [
    autocompletion({
      defaultKeymap: true,
      icons: false,
      override: [completions(config)],
    }),
    theme,
    ...replacements(config),
  ];
};
