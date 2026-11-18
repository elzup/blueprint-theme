// tokens.ts → Zed theme family (dist/zed/blueprint.json)。~/.config/zed/themes/ に symlink して使う
import { mkdirSync, writeFileSync } from 'node:fs'
import { type Variant, allVariants } from './variants.ts'
import { alpha, mix } from './color.ts'

const OUT = 'dist/zed/blueprint.json'

const uiStyle = (v: Variant) => {
  const b = v.base
  return {
    background: b.bg2,
    'surface.background': b.bg2,
    'elevated_surface.background': b.surfaceElevated,
    'panel.background': b.bg2,
    'panel.focused_border': b.accent,
    border: b.border,
    'border.variant': b.border,
    'border.focused': b.accent,
    'border.selected': b.accent,
    text: b.text,
    'text.muted': b.textDim,
    'text.placeholder': alpha(b.textDim, 0.7),
    'text.accent': b.accent,
    icon: b.text,
    'icon.muted': b.textDim,
    'icon.accent': b.accent,
    'element.background': b.surface,
    'element.hover': b.surface2,
    'element.selected': alpha(b.accent, 0.25),
    'ghost_element.hover': b.surface2,
    'ghost_element.selected': alpha(b.accent, 0.2),
    'title_bar.background': b.surface2,
    'status_bar.background': b.surface2,
    'toolbar.background': b.bg,
    'tab_bar.background': b.bg2,
    'tab.active_background': b.bg,
    'tab.inactive_background': b.bg2,
    'scrollbar.thumb.background': alpha(b.textDim, 0.25),
    'scrollbar.thumb.hover_background': alpha(b.textDim, 0.4),
    'editor.background': b.bg,
    'editor.foreground': b.text,
    'editor.gutter.background': b.bg,
    'editor.active_line.background': b.surface,
    'editor.line_number': alpha(b.textDim, 0.6),
    'editor.active_line_number': b.accent,
    'editor.indent_guide': b.border,
    'editor.indent_guide_active': b.borderBright,
    'editor.wrap_guide': b.border,
    'search.match_background': alpha(b.orange, 0.35),
    error: b.red,
    warning: b.orange,
    success: b.green,
    info: v.fixedAccent,
    hint: b.textDim,
    created: b.green,
    modified: b.orange,
    deleted: b.red,
    conflict: b.violet,
    ...terminalStyle(v),
  }
}

const terminalStyle = (v: Variant) => {
  const b = v.base
  const cyan = mix(v.fixedAccent, b.green, 0.4)
  const bright = (c: string) => mix(c, b.text, 0.25)
  return {
    'terminal.background': b.bg,
    'terminal.foreground': b.text,
    'terminal.ansi.black': b.surface2,
    'terminal.ansi.red': b.red,
    'terminal.ansi.green': b.green,
    'terminal.ansi.yellow': b.orange,
    'terminal.ansi.blue': v.fixedAccent,
    'terminal.ansi.magenta': b.violet,
    'terminal.ansi.cyan': cyan,
    'terminal.ansi.white': b.textDim,
    'terminal.ansi.bright_black': b.textDim,
    'terminal.ansi.bright_red': bright(b.red),
    'terminal.ansi.bright_green': bright(b.green),
    'terminal.ansi.bright_yellow': bright(b.orange),
    'terminal.ansi.bright_blue': bright(v.fixedAccent),
    'terminal.ansi.bright_magenta': bright(b.violet),
    'terminal.ansi.bright_cyan': bright(cyan),
    'terminal.ansi.bright_white': b.text,
  }
}

const c = (color: string, extra: Record<string, unknown> = {}) => ({ color, ...extra })

const syntaxStyle = (v: Variant) => {
  const s = v.syntax
  return {
    comment: c(s.comment, { font_style: 'italic' }),
    'comment.doc': c(s.comment, { font_style: 'italic' }),
    keyword: c(s.keyword),
    string: c(s.string),
    'string.escape': c(s.number),
    'string.regex': c(s.number),
    number: c(s.number),
    boolean: c(s.number),
    constant: c(s.number),
    type: c(s.type),
    constructor: c(s.type),
    function: c(s.fn),
    variable: c(s.variable),
    'variable.special': c(s.keyword),
    property: c(s.property),
    operator: c(s.operator),
    punctuation: c(s.punctuation),
    'punctuation.bracket': c(s.punctuation),
    tag: c(s.tag),
    attribute: c(s.attribute),
    title: c(s.keyword, { font_weight: 700 }),
    emphasis: c(s.variable, { font_style: 'italic' }),
    'emphasis.strong': c(s.variable, { font_weight: 700 }),
    link_uri: c(s.fn),
    link_text: c(s.fn),
    'text.literal': c(s.string),
  }
}

const themeOf = (v: Variant) => ({
  name: v.name,
  appearance: v.appearance,
  style: {
    ...uiStyle(v),
    players: [{ cursor: v.base.accent, background: v.base.accent, selection: alpha(v.base.accent, 0.28) }],
    syntax: syntaxStyle(v),
  },
})

const main = () => {
  const variants = allVariants()
  const family = {
    $schema: 'https://zed.dev/schema/themes/v0.2.0.json',
    name: 'Blueprint',
    author: 'elzup',
    themes: variants.map(themeOf),
  }
  mkdirSync('dist/zed', { recursive: true })
  writeFileSync(OUT, JSON.stringify(family, null, 2) + '\n')
  console.log(`wrote ${OUT} (${variants.length} themes)`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
