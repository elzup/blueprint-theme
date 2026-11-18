// UI framework ごとの adapter。バリアント (15 色 + 曜日) を framework の色の枠に対応付け、設定コードを出す。
// どの枠を曜日色にするかはここで決める: 「縁取り」(ring / focus / indicator) は曜日、「意味」(primary の地・状態色) は固定
import { contrast, flatten, alpha } from './color.ts'
import type { Variant } from './variants.ts'

export type Slots = Record<string, string>
export type Pair = { label: string; fg: string; bg: string }
export type Adapter = {
  id: string
  label: string
  slots: (v: Variant) => Slots
  config: (v: Variant, slots: Slots) => string
  pairs: (slots: Slots) => Pair[]
  // 曜日で変わる枠 (対応表の表示用)
  weekSlots: string[]
}

// 色付きの地に載せる文字色。bg と text のうちコントラストの高い方
export const onColor = (v: Variant, color: string) =>
  contrast(v.base.bg, color) >= contrast(v.base.text, color) ? v.base.bg : v.base.text

const solid = (v: Variant, css: string) => flatten(css, v.base.bg)

// ---- shadcn/ui (Tailwind v4 の CSS 変数)
const shadcn: Adapter = {
  id: 'shadcn',
  label: 'shadcn/ui (Tailwind v4)',
  weekSlots: ['ring', 'accent', 'accent-foreground', 'sidebar-primary'],
  slots: (v) => {
    const b = v.base
    return {
      background: b.bg,
      foreground: b.text,
      card: b.surface,
      'card-foreground': b.text,
      popover: b.surfaceElevated,
      'popover-foreground': b.text,
      primary: v.button,
      'primary-foreground': onColor(v, v.button),
      secondary: b.surface2,
      'secondary-foreground': b.text,
      muted: b.surface2,
      'muted-foreground': b.textDim,
      accent: solid(v, alpha(b.accent, 0.16)),
      'accent-foreground': b.text,
      destructive: b.red,
      'destructive-foreground': onColor(v, b.red),
      border: solid(v, b.border),
      input: solid(v, b.borderBright),
      ring: b.accent,
      'chart-1': v.fixedAccent,
      'chart-2': b.green,
      'chart-3': b.orange,
      'chart-4': b.violet,
      'chart-5': v.syntax.keyword,
      'sidebar-primary': b.accent,
    }
  },
  config: (v, s) => {
    const sel = v.appearance === 'dark' ? '.dark' : ':root'
    const lines = Object.entries(s).map(([k, c]) => `  --${k}: ${c};`)
    return `/* app/globals.css — ${v.name}${v.scheme === 'a' ? ' (案 a)' : ''} */\n${sel} {\n${lines.join('\n')}\n}`
  },
  pairs: (s) => [
    { label: 'primary / primary-foreground', fg: s['primary-foreground'], bg: s.primary },
    { label: 'card / card-foreground', fg: s['card-foreground'], bg: s.card },
    { label: 'muted / muted-foreground', fg: s['muted-foreground'], bg: s.muted },
    { label: 'accent / accent-foreground', fg: s['accent-foreground'], bg: s.accent },
    { label: 'destructive / foreground', fg: s['destructive-foreground'], bg: s.destructive },
    { label: 'ring / background (UI 3.0)', fg: s.ring, bg: s.background },
  ],
}

// ---- MUI v5 (createTheme の palette)
// MUI には「縁取り専用」の枠が無いので、曜日色は secondary に入れ、Tabs の indicator などで secondary を指定して出す
const mui: Adapter = {
  id: 'mui',
  label: 'MUI v5',
  weekSlots: ['secondary.main', 'secondary.contrastText'],
  slots: (v) => {
    const b = v.base
    return {
      'primary.main': v.button,
      'primary.contrastText': onColor(v, v.button),
      'secondary.main': b.accent,
      'secondary.contrastText': onColor(v, b.accent),
      'error.main': b.red,
      'warning.main': b.orange,
      'success.main': b.green,
      'info.main': v.fixedAccent,
      'background.default': b.bg,
      'background.paper': b.surface,
      'text.primary': b.text,
      'text.secondary': b.textDim,
      divider: solid(v, b.border),
    }
  },
  config: (v, s) => {
    const palette = Object.entries(s).reduce<Record<string, unknown>>((acc, [k, c]) => {
      const [group, key] = k.split('.')
      if (key === undefined) return { ...acc, [group]: c }
      return { ...acc, [group]: { ...(acc[group] as object | undefined), [key]: c } }
    }, { mode: v.appearance })
    return `// theme.ts — ${v.name}${v.scheme === 'a' ? ' (案 a)' : ''}\nimport { createTheme } from '@mui/material/styles'\n\nexport const theme = createTheme({\n  palette: ${JSON.stringify(palette, null, 2).replace(/\n/g, '\n  ')},\n})`
  },
  pairs: (s) => [
    { label: 'primary / contrastText', fg: s['primary.contrastText'], bg: s['primary.main'] },
    { label: 'secondary (曜日) / contrastText', fg: s['secondary.contrastText'], bg: s['secondary.main'] },
    { label: 'text.primary / paper', fg: s['text.primary'], bg: s['background.paper'] },
    { label: 'text.secondary / paper', fg: s['text.secondary'], bg: s['background.paper'] },
    { label: 'error / default', fg: s['error.main'], bg: s['background.default'] },
    { label: 'warning / default', fg: s['warning.main'], bg: s['background.default'] },
  ],
}

// ---- 素の CSS 変数 (framework なし。--wt-* を自分の CSS から参照する)
const cssVars: Adapter = {
  id: 'css',
  label: '素の CSS 変数',
  weekSlots: ['--wt-week', '--wt-week-soft'],
  slots: (v) => {
    const b = v.base
    return {
      '--wt-bg': b.bg,
      '--wt-surface': b.surface,
      '--wt-surface-2': b.surface2,
      '--wt-border': solid(v, b.border),
      '--wt-text': b.text,
      '--wt-text-muted': b.textDim,
      '--wt-brand': v.button,
      '--wt-on-brand': onColor(v, v.button),
      '--wt-success': b.green,
      '--wt-danger': b.red,
      '--wt-warning': b.orange,
      '--wt-notice': b.violet,
      '--wt-week': b.accent,
      '--wt-week-soft': solid(v, alpha(b.accent, 0.14)),
    }
  },
  config: (v, s) => {
    const lines = Object.entries(s).map(([k, c]) => `  ${k}: ${c};`)
    return `/* week-theme.css — ${v.name}${v.scheme === 'a' ? ' (案 a)' : ''} */\n:root {\n${lines.join('\n')}\n}`
  },
  pairs: (s) => [
    { label: 'brand / on-brand', fg: s['--wt-on-brand'], bg: s['--wt-brand'] },
    { label: 'text / surface', fg: s['--wt-text'], bg: s['--wt-surface'] },
    { label: 'text-muted / surface', fg: s['--wt-text-muted'], bg: s['--wt-surface'] },
    { label: 'week / bg (UI 3.0)', fg: s['--wt-week'], bg: s['--wt-bg'] },
  ],
}

export const ADAPTERS: readonly Adapter[] = [shadcn, mui, cssVars]
