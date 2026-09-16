import yaml from 'js-yaml';

/**
 * YAML frontmatter support for IMS markdown assets, backed by js-yaml.
 *
 * File layout:
 *   ---
 *   __meta:
 *     id: <asset id, written only when it differs from the path-derived id>
 *     name: <asset name, written only when set>
 *     icon: <own icon, written only when set and different from the md default>
 *     values:
 *       <prop>: <value>   # __meta block own props
 *   <other frontmatter keys>: <handled by the markdown editor as content>
 *   ---
 *   <markdown content>
 *
 * Rules:
 * - `__meta` is the only key the app owns. It is written on save and stripped
 *   (kept in the file, not passed as content) on load.
 * - Any other frontmatter keys belong to the editor: on load they are folded
 *   back into the markdown content string; on save any frontmatter already
 *   present in the content has `__meta` merged into it.
 * - The internal `format: 'md'` marker is implied by the .md extension and is
 *   never persisted.
 * - When nothing needs to be written, no frontmatter is produced.
 */

export const MARKDOWN_DEFAULT_ICON = 'markdown-fill';

const FRONTMATTER_DELIMITER = '---';

const DUMP_OPTIONS: yaml.DumpOptions = {
  indent: 2,
  lineWidth: -1,
  noRefs: true,
  sortKeys: false,
};

export interface MarkdownFrontmatterMeta {
  id?: string;
  name?: string | null;
  icon?: string | null;
  values?: Record<string, unknown>;
}

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Split an opening frontmatter block (`---` + YAML + `---`) off the content.
 * Returns null when the content does not start with a valid frontmatter block.
 */
function stripFrontmatter(content: string): ParsedFrontmatter | null {
  const lines = content.split(/\r?\n/);
  if (lines.length < 3 || lines[0].trim() !== FRONTMATTER_DELIMITER) {
    return null;
  }

  const yaml_lines: string[] = [];
  let close_index = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) {
      close_index = i;
      break;
    }
    yaml_lines.push(lines[i]);
  }
  if (close_index === -1) {
    return null;
  }

  let data: Record<string, unknown>;
  try {
    const parsed = yaml.load(yaml_lines.join('\n')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    data = parsed as Record<string, unknown>;
  } catch {
    // Malformed frontmatter — not ours to handle.
    return null;
  }

  return {
    data,
    content: lines.slice(close_index + 1).join('\n').replace(/^\n/, ''),
  };
}

export function parseMarkdownFrontmatter(content: string): {
  meta: MarkdownFrontmatterMeta | null;
  content: string;
} {
  const stripped = stripFrontmatter(content);
  if (!stripped) {
    return { meta: null, content };
  }

  const { __meta: raw_meta, ...other_keys } = stripped.data;

  const meta: MarkdownFrontmatterMeta = {};
  if (raw_meta && typeof raw_meta === 'object' && !Array.isArray(raw_meta)) {
    const m = raw_meta as Record<string, unknown>;
    if (typeof m.id === 'string') meta.id = m.id;
    if (typeof m.name === 'string') meta.name = m.name;
    if (typeof m.icon === 'string') meta.icon = m.icon;
    if (m.values && typeof m.values === 'object' && !Array.isArray(m.values)) {
      meta.values = m.values as Record<string, unknown>;
    }
  }
  const has_meta =
    meta.id !== undefined ||
    meta.name !== undefined ||
    meta.icon !== undefined ||
    meta.values !== undefined;

  // Non-__meta frontmatter keys belong to the editor — keep them in the content.
  let body = stripped.content;
  if (Object.keys(other_keys).length > 0) {
    const dumped = yaml.dump(other_keys, DUMP_OPTIONS);
    body = `${FRONTMATTER_DELIMITER}\n${dumped}${FRONTMATTER_DELIMITER}\n${stripped.content}`;
  }

  return { meta: has_meta ? meta : null, content: body };
}

export function buildMarkdownFrontmatter(
  meta: MarkdownFrontmatterMeta,
  content: string,
): { frontmatter: string | null; content: string } {
  const existing = stripFrontmatter(content);

  const meta_obj: Record<string, unknown> = {};
  if (meta.id !== undefined) {
    meta_obj.id = meta.id;
  }
  if (meta.name !== undefined && meta.name !== null && meta.name !== '') {
    meta_obj.name = meta.name;
  }
  if (
    meta.icon !== undefined &&
    meta.icon !== null &&
    meta.icon !== '' &&
    meta.icon !== MARKDOWN_DEFAULT_ICON
  ) {
    meta_obj.icon = meta.icon;
  }
  if (meta.values && Object.keys(meta.values).length > 0) {
    meta_obj.values = meta.values;
  }

  // Nothing to write and no existing editor frontmatter to preserve.
  if (Object.keys(meta_obj).length === 0 && !existing) {
    return { frontmatter: null, content };
  }

  let merged: Record<string, unknown>;
  if (existing) {
    const { __meta: _old_meta, ...other_keys } = existing.data;
    merged = { ...other_keys };
    if (Object.keys(meta_obj).length > 0) {
      merged.__meta = meta_obj;
    }
  } else {
    merged = { __meta: meta_obj };
  }

  if (Object.keys(merged).length === 0) {
    return { frontmatter: null, content: existing ? existing.content : content };
  }

  const dumped = yaml.dump(merged, DUMP_OPTIONS);
  return {
    frontmatter: `${FRONTMATTER_DELIMITER}\n${dumped}${FRONTMATTER_DELIMITER}\n`,
    content: (existing ?? { content }).content,
  };
}