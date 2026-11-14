/**
 * جداسازی کلمات جمله و اندازه‌گیری جای دقیق هر کلمه روی بوم.
 *
 * «هر کلمه قابلیت جداشدن و تکان‌دادن مستقل» از فاز ۱: جمله به لایه‌های
 * تک‌کلمه‌ای تبدیل می‌شود بدون اینکه چیدمان بصری ذره‌ای جابه‌جا شود.
 * اندازه‌گیری با یک عنصر مخفی با «دقیقاً همان استایل لایه» انجام می‌شود، پس
 * شکست خط و جای هر کلمه عیناً همان چیزی است که کاربر می‌بیند.
 */

import type { LetterOverride, Layer } from "./model"
import { fontCssFamily } from "./fonts"

export interface WordToken {
  token: string
  /** اندیس UTF-16 آغاز واژه در متن اصلی */
  rawStart: number
}

/** تجزیهٔ متن به واژه‌ها (مرز: فاصله/تب/شکست خط). نیم‌فاصله داخل واژه حفظ می‌شود. */
export function tokenizeWords(text: string): WordToken[] {
  const out: WordToken[] = []
  const isSep = (ch: string) => ch === " " || ch === "\n" || ch === "\t" || ch === "\r"
  let i = 0
  while (i < text.length) {
    while (i < text.length && isSep(text[i])) i++
    if (i >= text.length) break
    const start = i
    while (i < text.length && !isSep(text[i])) i++
    out.push({ token: text.slice(start, i), rawStart: start })
  }
  return out
}

/** جدول perLetter یک واژه از جدول لایهٔ مادر (کلیدها به مختصات محلی واژه) */
export function slicePerLetter(
  perLetter: Record<string, LetterOverride>,
  rawStart: number,
  tokenLength: number,
): Record<string, LetterOverride> {
  const out: Record<string, LetterOverride> = {}
  for (const [key, value] of Object.entries(perLetter)) {
    const k = Number(key)
    if (k >= rawStart && k < rawStart + tokenLength) {
      out[String(k - rawStart)] = value
    }
  }
  return out
}

export interface WordBox {
  /** مختصات چپ-بالای واژه نسبت به جعبهٔ لایه، بر حسب واحد سند */
  x: number
  y: number
}

/**
 * اندازه‌گیری جای هر واژه در چیدمان فعلی لایه.
 * [scale] همان ضریب نمایش بوم است؛ خروجی همیشه بر حسب واحد سند است.
 * اگر عنصر لایه روی صفحه نباشد null برمی‌گردد.
 */
export function measureWordPositions(layer: Layer, scale: number): WordBox[] | null {
  if (typeof document === "undefined" || !layer.text) return null
  const el = document.querySelector(`[data-layer-id="${CSS.escape(layer.id)}"]`) as HTMLElement | null
  if (!el) return null
  const t = layer.text
  const tokens = tokenizeWords(t.text)
  if (tokens.length < 2) return null

  // عرض جعبهٔ فعلی لایه بر حسب واحد سند — کلید تطابق شکست خط
  const docWidth = el.getBoundingClientRect().width / scale
  if (docWidth <= 0) return null

  const probe = document.createElement("div")
  probe.style.position = "absolute"
  probe.style.top = "0"
  probe.style.left = "-100000px"
  probe.style.visibility = "hidden"
  probe.style.width = `${docWidth}px`
  probe.style.margin = "0"
  probe.style.padding = "0"
  probe.style.border = "0"
  probe.style.fontFamily = fontCssFamily(t.fontId)
  probe.style.fontWeight = t.fontId === "amiri-bold" ? "700" : "400"
  probe.style.fontSize = `${t.fontSize}px`
  probe.style.lineHeight = String(t.lineHeight)
  probe.style.direction = t.rtl ? "rtl" : "ltr"
  probe.style.whiteSpace = "pre-wrap"

  const spans: HTMLSpanElement[] = []
  tokens.forEach((tk, idx) => {
    if (idx > 0) {
      // عیناً همان جداکنندهٔ متن اصلی (فاصله/شکست خط) تا چیدمان یکسان بماند
      probe.appendChild(document.createTextNode(t.text.slice(tokens[idx - 1].rawStart + tokens[idx - 1].token.length, tk.rawStart)))
    }
    const span = document.createElement("span")
    span.textContent = tk.token
    probe.appendChild(span)
    spans.push(span)
  })

  document.body.appendChild(probe)
  const boxes = spans.map((s) => ({ x: s.offsetLeft, y: s.offsetTop }))
  probe.remove()
  return boxes
}
