// CSS の色表記 (#rgb / #rrggbb / #rrggbbaa / rgba()) とエディタ用 hex の相互変換

export type Rgba = { r: number; g: number; b: number; a: number }

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGBA_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

export const parse = (css: string): Rgba => {
  const hex = HEX_RE.exec(css)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
  }
  const rgba = RGBA_RE.exec(css)
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] }
  }
  throw new Error(`unsupported color: ${css}`)
}

const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')

export const toHex = (c: Rgba): string => {
  const rgb = `#${byte(c.r)}${byte(c.g)}${byte(c.b)}`
  return c.a >= 1 ? rgb : rgb + byte(c.a * 255)
}

export const hex = (css: string) => toHex(parse(css))

export const alpha = (css: string, a: number) => toHex({ ...parse(css), a })

// a に b を t (0..1) だけ混ぜる。alpha は無視して不透明色を返す
export const mix = (a: string, b: string, t: number) => {
  const ca = parse(a)
  const cb = parse(b)
  const lerp = (x: number, y: number) => x + (y - x) * t
  return toHex({ r: lerp(ca.r, cb.r), g: lerp(ca.g, cb.g), b: lerp(ca.b, cb.b), a: 1 })
}

// 半透明の色を下地に重ねた不透明色にする (Zed の一部キーは alpha を下地と合成しないため)
export const flatten = (css: string, under: string) => {
  const c = parse(css)
  return mix(under, toHex({ ...c, a: 1 }), c.a)
}

// ---- OKLab / OKLCH (色の近さの計測と、明度・彩度を揃えた候補色の生成に使う)

const toLinear = (v: number) => {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

export type Lab = [number, number, number]

export const toOklab = (css: string): Lab => {
  const c = parse(css)
  const [r, g, b] = [toLinear(c.r), toLinear(c.g), toLinear(c.b)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

// sRGB の外に出る色は null (誤差 0.001 までは丸める)
const GAMUT_EPS = 0.001

export const fromOklch = (lightness: number, chroma: number, hueDeg: number): string | null => {
  const h = (hueDeg * Math.PI) / 180
  const [L, A, B] = [lightness, chroma * Math.cos(h), chroma * Math.sin(h)]
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  if (rgb.some((v) => v < -GAMUT_EPS || v > 1 + GAMUT_EPS)) return null
  const [r, g, b] = rgb.map((v) => fromLinear(Math.min(1, Math.max(0, v))) * 255)
  return toHex({ r, g, b, a: 1 })
}

export const toOklch = (css: string) => {
  const [L, A, B] = toOklab(css)
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

export const labDistance = (a: string, b: string) => {
  const [x, y] = [toOklab(a), toOklab(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

// WCAG 2.x の相対輝度とコントラスト比
export const luminance = (css: string) => {
  const c = parse(css)
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b)
}

export const contrast = (fg: string, bg: string) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}
