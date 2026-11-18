// 「使えるか」の機械チェック。コントラスト (WCAG) と、構文色どうしの見分けやすさ (OKLab 距離)。
//   node src/audit.ts [--scheme current|a] [--all]
import { parseArgs } from 'node:util'
import { alpha, contrast, flatten, labDistance, mix } from './color.ts'
import { type Scheme, type Variant, SCHEMES, allVariants } from './variants.ts'

// WCAG 2.x: 本文 4.5、大きな文字・UI 部品 3.0
export const CONTRAST = { body: 4.5, ui: 3.0 }
// OKLab の距離。0.02 前後が「並べて差が分かる」最小差 (JND)。
// 構文の種類を一瞥で見分けるには桁違いの差が要るので、経験的に 0.10 未満を衝突、0.16 未満を近いとする
export const DISTANCE = { clash: 0.1, near: 0.16 }

export type Level = 'ok' | 'warn' | 'bad'
export type ContrastCheck = { label: string; fg: string; bg: string; ratio: number; min: number; level: Level }
export type PairCheck = { a: string; b: string; colorA: string; colorB: string; dist: number; level: Level }

const contrastLevel = (ratio: number, min: number): Level =>
  ratio >= min ? 'ok' : ratio >= min * 0.8 ? 'warn' : 'bad'

const distLevel = (d: number): Level => (d < DISTANCE.clash ? 'bad' : d < DISTANCE.near ? 'warn' : 'ok')

const check = (label: string, fg: string, bg: string, min: number): ContrastCheck => {
  const ratio = contrast(fg, bg)
  return { label, fg, bg, ratio, min, level: contrastLevel(ratio, min) }
}

// gen-vscode の button.hoverBackground と同じ式 (地を text へ 20% 寄せる)
export const hoverOf = (color: string, v: Variant) => mix(color, v.base.text, 0.2)
export const selectionOf = (v: Variant) => flatten(alpha(v.base.accent, 0.28), v.base.bg)

export const contrastChecks = (v: Variant): ContrastCheck[] => {
  const b = v.base
  const s = v.syntax
  return [
    check('text / bg', b.text, b.bg, CONTRAST.body),
    check('keyword', s.keyword, b.bg, CONTRAST.body),
    check('string', s.string, b.bg, CONTRAST.body),
    check('number', s.number, b.bg, CONTRAST.body),
    check('type', s.type, b.bg, CONTRAST.body),
    check('function', s.fn, b.bg, CONTRAST.body),
    check('property', s.property, b.bg, CONTRAST.body),
    check('comment', s.comment, b.bg, CONTRAST.ui),
    check('keyword / 現在行', s.keyword, b.surface, CONTRAST.body),
    check('text / 選択範囲', b.text, selectionOf(v), CONTRAST.body),
    check('ボタン文字 / ボタン', b.bg, v.button, CONTRAST.body),
    check('ボタン文字 / ボタン(hover)', b.bg, hoverOf(v.button, v), CONTRAST.body),
    check('曜日色 (カーソル・縁) / bg', b.accent, b.bg, CONTRAST.ui),
    check('サイドバー text / bg2', b.text, b.bg2, CONTRAST.body),
    check('error / bg', b.red, b.bg, CONTRAST.ui),
    check('warning / bg', b.orange, b.bg, CONTRAST.ui),
  ]
}

// 色相で見分ける構文色の総当たり。property は fn に寄せてあるので fn との組は除く
const roles = (v: Variant): [string, string][] => [
  ['keyword', v.syntax.keyword],
  ['string', v.syntax.string],
  ['number', v.syntax.number],
  ['type', v.syntax.type],
  ['function', v.syntax.fn],
  ['error', v.base.red],
  ['variable', v.syntax.variable],
]

const SKIP = new Set(['function|variable'])

export const pairChecks = (v: Variant): PairCheck[] => {
  const list = roles(v)
  return list.flatMap(([a, ca], i) =>
    list.slice(i + 1).flatMap(([b, cb]) => {
      if (SKIP.has(`${a}|${b}`)) return []
      const dist = labDistance(ca, cb)
      return [{ a, b, colorA: ca, colorB: cb, dist, level: distLevel(dist) }]
    }),
  )
}

const worst = (levels: Level[]): Level => (levels.includes('bad') ? 'bad' : levels.includes('warn') ? 'warn' : 'ok')

export const auditVariant = (v: Variant) => {
  const contrasts = contrastChecks(v)
  const pairs = pairChecks(v)
  return { contrasts, pairs, level: worst([...contrasts, ...pairs].map((c) => c.level)) }
}

const main = () => {
  const { values } = parseArgs({
    options: { all: { type: 'boolean', default: false }, scheme: { type: 'string', default: 'current' } },
  })
  const scheme = values.scheme as Scheme
  if (!SCHEMES.includes(scheme)) throw new Error(`--scheme は ${SCHEMES.join(' / ')}`)
  const counts = { ok: 0, warn: 0, bad: 0 }
  allVariants(scheme).forEach((v) => {
    const r = auditVariant(v)
    counts[r.level] += 1
    const show = <T extends { level: Level }>(xs: T[]) => xs.filter((x) => values.all || x.level !== 'ok')
    const lines = [
      ...show(r.contrasts).map((c) => `  ${c.level.padEnd(4)} ${c.label}: ${c.ratio.toFixed(2)} (>= ${c.min})`),
      ...show(r.pairs).map((p) => `  ${p.level.padEnd(4)} ${p.a} vs ${p.b}: ΔE ${p.dist.toFixed(3)}`),
    ]
    if (lines.length > 0) console.log(`${v.name} [${r.level}]\n${lines.join('\n')}`)
  })
  console.log(`scheme=${scheme}  ok ${counts.ok} / warn ${counts.warn} / bad ${counts.bad}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
