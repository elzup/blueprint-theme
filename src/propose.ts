// 案 a の keyword 固定色を「ほかの構文色・意味色から最も遠い色相」として自動で選ぶ。
// 明度と彩度は既存の構文色の平均に揃え、色相だけを 1° 刻みで走査する (手で選ぶと好みで偏るため)
import { fromOklch, labDistance, toOklch } from './color.ts'

const HUE_STEP = 1
// sRGB に収まらない色相では彩度を段階的に落とす (落としすぎると灰色に寄るので 3 段まで)
const CHROMA_SCALES = [1, 0.85, 0.7]
const MIN_CONTRAST = 4.5

export type Proposal = { color: string; hue: number; minDistance: number; nearest: string }

type Input = {
  avoid: Record<string, string>
  backgrounds: string[]
  contrast: (fg: string, bg: string) => number
}

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

const score = (color: string, avoid: Record<string, string>) =>
  Object.entries(avoid)
    .map(([name, c]) => ({ name, d: labDistance(color, c) }))
    .reduce((min, x) => (x.d < min.d ? x : min))

export const proposeKeyword = ({ avoid, backgrounds, contrast }: Input): Proposal => {
  const chromatic = Object.values(avoid).map(toOklch).filter((c) => c.c > 0.05)
  const lightness = average(chromatic.map((c) => c.l))
  const chroma = average(chromatic.map((c) => c.c))
  const candidates = Array.from({ length: 360 / HUE_STEP }, (_, i) => i * HUE_STEP).flatMap((hue) => {
    const color = CHROMA_SCALES.map((k) => fromOklch(lightness, chroma * k, hue)).find((c) => c !== null)
    if (color === undefined || color === null) return []
    if (backgrounds.some((bg) => contrast(color, bg) < MIN_CONTRAST)) return []
    const nearest = score(color, avoid)
    return [{ color, hue, minDistance: nearest.d, nearest: nearest.name }]
  })
  if (candidates.length === 0) throw new Error('keyword 候補が見つかりません (コントラスト条件を満たす色相が無い)')
  return candidates.reduce((best, c) => (c.minDistance > best.minDistance ? c : best))
}
