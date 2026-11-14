/**
 * ابزارهای متنی فارسی/عربی ویرایشگر پلک — پورت مستقیم ArabicText.kt نسخهٔ اندروید.
 *
 * رشته‌های جاوااسکریپت UTF-16 هستند (مانند Kotlin)، پس اندیس‌ها یک‌به‌یک سازگارند.
 *
 * سه مسئولیت:
 *  ۱. دسته‌بندی اتصال حروف برای تعیین نقاط مجاز «کشیده».
 *  ۲. مدل «کلاستر حرف»: حرف پایه + علائم چسبان همان حرف.
 *  ۳. جهش‌های متن (درج/حذف کشیده و علامت) با بازنگاشت خودکار کلیدهای perLetter.
 *
 * کشیده و علامت‌ها به‌صورت نویسه در خودِ متن درج می‌شوند تا شکل‌دهی (HarfBuzz
 * مرورگر در نسخهٔ وب، HarfBuzz NDK در اندروید) همیشه درست بماند.
 */

import {
  defaultLetterOverride,
  isDefaultOverride,
  normalizeLetterForm,
  type LetterForm,
  type LetterOverride,
} from "./model"

/** نویسهٔ کشیده (تطویل) */
export const TATWEEL = "\u0640"

/** نیم‌فاصله */
export const ZWNJ = "\u200C"

/** اتصال‌دهندهٔ صفرعرض — برای تحمیل فرم آغازی/میانی/پایانی */
export const ZWJ = "\u200D"

/** بیشینهٔ تعداد کشیده پشت‌سرهم در یک نقطه */
export const MAX_KASHIDA_BEFORE = 8

/** علائم چسبانِ مجاز در ویرایشگر */
export const COMBINING_MARKS = new Set([
  "\u064B", "\u064C", "\u064D", "\u064E", "\u064F",
  "\u0650", "\u0651", "\u0652", "\u0653", "\u0654", "\u0655", "\u0670",
])

/** حروفی که از هر دو طرف می‌چسبند (دوجهته) — تطویل هم دوجهته است */
const DUAL_JOINING = new Set([
  "ب", "ت", "ث", "ج", "ح", "خ", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ",
  "ف", "ق", "ك", "ک", "ل", "م", "ن", "ه", "ي", "ی", "ئ", "پ", "چ", "گ", "ى",
  TATWEEL,
])

/** حروفی که فقط به حرفِ قبل می‌چسبند (همچون ا د ذ ر ز ژ و) */
const RIGHT_JOINING = new Set([
  "ا", "آ", "أ", "إ", "ؤ", "ة", "د", "ذ", "ر", "ز", "ژ", "و", "ۀ",
])

/** آیا [c] به حرف بعدی می‌چسبد؟ */
export function joinsForward(c: string): boolean {
  return DUAL_JOINING.has(c)
}

/** آیا [c] به حرف قبلی می‌چسبد؟ */
export function joinsBackward(c: string): boolean {
  return DUAL_JOINING.has(c) || RIGHT_JOINING.has(c)
}

function charCount(codePoint: number): number {
  return codePoint >= 0x10000 ? 2 : 1
}

/** یک کلاستر حرف در متن: حرف پایه + علائم چسبانِ بلافاصله بعد از آن */
export interface LetterCluster {
  start: number
  endExclusive: number
  base: string
  marks: string[]
  kashidaBefore: number
}

/** تجزیهٔ [text] به کلاسترهای حرف */
export function letterClusters(text: string): LetterCluster[] {
  const out: LetterCluster[] = []
  let i = 0
  while (i < text.length) {
    const start = i
    const cp = text.codePointAt(i) ?? 0
    const baseLen = charCount(cp)
    i += baseLen
    const marks: string[] = []
    while (i < text.length && COMBINING_MARKS.has(text[i])) {
      marks.push(text[i])
      i++
    }
    let kashida = 0
    while (start - 1 - kashida >= 0 && text[start - 1 - kashida] === TATWEEL) kashida++
    out.push({
      start,
      endExclusive: i,
      base: text.substring(start, start + baseLen),
      marks,
      kashidaBefore: kashida,
    })
  }
  return out
}

/**
 * آیا می‌توان پیش از کلاسترِ آغازشده در [clusterStart] کشیده درج کرد؟
 * قانون: حرف قبلی از جلو بچسبد، حرف فعلی از عقب بچسبد، میان‌شان فاصله/نیم‌فاصله
 * نباشد و جفت «لام + الف» (لیگاتور اجباری لا) نشکند.
 */
export function canKashidaBefore(text: string, clusterStart: number): boolean {
  const clusters = letterClusters(text)
  const idx = clusters.findIndex((c) => c.start === clusterStart)
  if (idx <= 0) return false
  const prev = clusters[idx - 1]
  const cur = clusters[idx]
  if (prev.endExclusive !== cur.start) return false
  if (prev.base.length !== 1 || cur.base.length !== 1) return false
  const p = prev.base[0]
  const c = cur.base[0]
  if (!joinsForward(p) || !joinsBackward(c)) return false
  if (p === "ل" && "اأإآ".includes(c)) return false
  return true
}

/**
 * یک جهش متن: متنِ تازه + نگاشت کلیدهای perLetter.
 * هر کلید >= [shiftFrom] به اندازهٔ [delta] جابه‌جا می‌شود.
 */
export class TextMutation {
  constructor(
    public readonly newText: string,
    public readonly shiftFrom: number,
    public readonly delta: number,
  ) {}

  remap(key: number): number {
    return key >= this.shiftFrom ? key + this.delta : key
  }
}

/** اعمال بازنگاشت [TextMutation] روی نقشهٔ perLetter */
export function remapPerLetter(
  perLetter: Record<string, LetterOverride>,
  mutation: TextMutation,
): Record<string, LetterOverride> {
  if (Object.keys(perLetter).length === 0) return perLetter
  const out: Record<string, LetterOverride> = {}
  for (const [key, value] of Object.entries(perLetter)) {
    out[String(mutation.remap(Number(key)))] = value
  }
  return out
}

/** درج یک کشیده پیش از کلاستر [clusterStart] (اگر قانون اتصال اجازه دهد) */
export function insertKashidaBefore(text: string, clusterStart: number): TextMutation | null {
  if (!(clusterStart >= 1 && clusterStart <= text.length)) return null
  if (!canKashidaBefore(text, clusterStart)) return null
  return new TextMutation(
    text.substring(0, clusterStart) + TATWEEL + text.substring(clusterStart),
    clusterStart,
    +1,
  )
}

/** حذف یک کشیده از پیشِ کلاستر [clusterStart] */
export function removeKashidaBefore(text: string, clusterStart: number): TextMutation | null {
  if (!(clusterStart >= 1 && clusterStart <= text.length)) return null
  if (text[clusterStart - 1] !== TATWEEL) return null
  return new TextMutation(
    text.substring(0, clusterStart - 1) + text.substring(clusterStart),
    clusterStart,
    -1,
  )
}

/** درج علامت [mark] در انتهای کلاستر [clusterStart] (بعد از علامت‌های موجود) */
export function insertMarkAfter(text: string, clusterStart: number, mark: string): TextMutation | null {
  if (!COMBINING_MARKS.has(mark)) return null
  const cluster = letterClusters(text).find((c) => c.start === clusterStart)
  if (!cluster) return null
  return new TextMutation(
    text.substring(0, cluster.endExclusive) + mark + text.substring(cluster.endExclusive),
    cluster.endExclusive,
    +1,
  )
}

/** حذف علامت شمارهٔ [markIndex] از کلاستر [clusterStart] */
export function removeMarkAt(text: string, clusterStart: number, markIndex: number): TextMutation | null {
  const cluster = letterClusters(text).find((c) => c.start === clusterStart)
  if (!cluster) return null
  if (markIndex < 0 || markIndex >= cluster.marks.length) return null
  const position = cluster.start + cluster.base.length + markIndex
  const removed = text[position] ?? null
  if (!removed || !COMBINING_MARKS.has(removed)) return null
  return new TextMutation(
    text.substring(0, position) + text.substring(position + 1),
    position + 1,
    -1,
  )
}

/**
 * همگام‌سازی perLetter با متن تازه (بعد از تایپ آزاد کاربر):
 * کلیدهای بی‌کلاستر حذف و فهرست علامت هر حرف به تعداد علائم واقعی متن بریده می‌شود.
 */
export function reconcilePerLetter(
  text: string,
  perLetter: Record<string, LetterOverride>,
): Record<string, LetterOverride> {
  if (Object.keys(perLetter).length === 0) return perLetter
  const clusters = new Map<number, LetterCluster>()
  for (const c of letterClusters(text)) clusters.set(c.start, c)
  const out: Record<string, LetterOverride> = {}
  for (const [key, override] of Object.entries(perLetter)) {
    const cluster = clusters.get(Number(key))
    if (!cluster) continue
    const trimmed: LetterOverride = { ...override, marks: override.marks.slice(0, cluster.marks.length) }
    if (!isDefaultOverride(trimmed)) out[key] = trimmed
  }
  return out
}

/** برچسب نمایشی یک کلاستر برای چیپ‌های تب «حرف» */
export function clusterDisplayLabel(cluster: LetterCluster): string {
  const base =
    cluster.base === ZWNJ ? "نیم‌فاصله" : cluster.base === " " ? "فاصله" : cluster.base === "\n" ? "شکست خط" : cluster.base
  return base + cluster.marks.join("")
}

/** نگاشت perLetter به فرمت JSON سازگار با kotlinx.serialization (کلید عددی) */
export function perLetterToJson(perLetter: Record<string, LetterOverride>): Record<string, LetterOverride> {
  return perLetter
}

/** خواندن perLetter از JSON (کلیدهای رشته‌ای → یکسان) */
export function perLetterFromJson(obj: Record<string, LetterOverride> | undefined): Record<string, LetterOverride> {
  if (!obj) return {}
  const out: Record<string, LetterOverride> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[String(Number(k))] = {
      ...defaultLetterOverride(),
      ...v,
      marks: v.marks ?? [],
      formOverride: normalizeLetterForm(v.formOverride ?? "AUTO"),
    }
  }
  return out
}

/* ==========================================================================
 * حالت‌های حرف (تنها / آغازی / میانی / پایانی)
 *
 * هر حرف در هر فونتی چهار فرم دارد و «تغییر حالت حرف» باید در همهٔ فونت‌ها
 * کار کند — برخلاف گونه‌های GSUB که به فونت وابسته‌اند. فرم دلخواه با
 * نویسه‌های صفرعرض (ZWJ برای تحمیل اتصال، ZWNJ برای شکستن اتصال) در
 * «متنِ نمایش» ساخته می‌شود؛ متن اصلی دست‌نخورده می‌ماند پس کلیدهای
 * perLetter و تاریخچه هیچ‌وقت به‌هم نمی‌ریزند.
 * ========================================================================== */

/** آیا این نویسه «حرف» است و نه فاصله/شکست خط/اتصال‌دهندهٔ صفرعرض؟ */
function isLetterBase(base: string): boolean {
  return base !== " " && base !== "\n" && base !== "\t" && base !== ZWNJ && base !== ZWJ
}

/** واحدهای متن نمایش: هر واحد = اتصال‌دهنده‌های صفرعرض + نویسه‌های همان کلاستر */
export interface FormLayoutUnit {
  chars: string
  /** اندیس آغاز کلاستر در متن اصلی — برای وصل‌کردن استایل perLetter */
  clusterStart: number | null
}

interface FormNeighbors {
  adjacentPrev: boolean
  adjacentNext: boolean
  prevJoinsFwd: boolean
  nextJoinsBack: boolean
}

function formNeighbors(clusters: LetterCluster[], index: number): FormNeighbors {
  const c = clusters[index]
  const prev = index > 0 ? clusters[index - 1] : null
  const next = index < clusters.length - 1 ? clusters[index + 1] : null
  const adjacentPrev = prev !== null && isLetterBase(prev.base) && prev.endExclusive === c.start
  const adjacentNext = next !== null && isLetterBase(next.base) && c.endExclusive === next.start
  return {
    adjacentPrev,
    adjacentNext,
    prevJoinsFwd: adjacentPrev && joinsForward(prev!.base),
    nextJoinsBack: adjacentNext && joinsBackward(next!.base),
  }
}

/** ساخت واحدِ نمایش یک کلاستر با توجه به فرم تحمیلی آن */
function unitForCluster(
  text: string,
  clusters: LetterCluster[],
  index: number,
  perLetter: Record<string, LetterOverride>,
): FormLayoutUnit {
  const c = clusters[index]
  const override = perLetterOverrideAt(perLetter, c.start)
  const form: LetterForm = override ? normalizeLetterForm(override.formOverride) : "AUTO"
  const base = c.base
  const { adjacentPrev, adjacentNext, prevJoinsFwd, nextJoinsBack } = formNeighbors(clusters, index)
  const canFwd = joinsForward(base)
  const canBack = joinsBackward(base)

  let leading = ""
  let trailing = ""

  switch (form) {
    case "ISOLATED": {
      if (adjacentPrev) leading = ZWNJ
      // اگر اتصال طبیعی از جلو وجود دارد بشکن
      if (adjacentNext && canFwd && nextJoinsBack) trailing = ZWNJ
      break
    }
    case "INITIAL": {
      if (canFwd) {
        // اتصال طبیعی از عقب را بشکن تا فرم آغازی بماند
        if (adjacentPrev && prevJoinsFwd && canBack) leading = ZWNJ
        // اتصال از جلو را تضمین کن
        if (!adjacentNext || !nextJoinsBack) trailing = ZWJ
      }
      break
    }
    case "MEDIAL": {
      if (canFwd && canBack) {
        if (!adjacentPrev) leading = ZWJ
        else if (!prevJoinsFwd) leading = "" // غیرممکن — به AUTO برمی‌گردد
        if (!adjacentNext || !nextJoinsBack) trailing = ZWJ
      }
      break
    }
    case "FINAL": {
      if (canBack) {
        if (!adjacentPrev) leading = ZWJ
        else if (!prevJoinsFwd) leading = "" // غیرممکن — به AUTO برمی‌گردد
        // اتصال طبیعی از جلو را بشکن تا فرم پایانی بماند
        if (adjacentNext && canFwd && nextJoinsBack) trailing = ZWNJ
      }
      break
    }
    default:
      break
  }

  return { chars: leading + text.substring(c.start, c.endExclusive) + trailing, clusterStart: c.start }
}

function perLetterOverrideAt(
  perLetter: Record<string, LetterOverride>,
  clusterStart: number,
): LetterOverride | null {
  return perLetter[String(clusterStart)] ?? null
}

/**
 * چیدمان کامل متن با اعمال همهٔ فرم‌های تحمیلی — خروجی برای نمایش و خروجی‌گیری.
 * اگر هیچ فرمی تحمل نشده باشد دقیقاً همان متن اصلی برمی‌گردد.
 */
export function layoutUnitsWithForms(
  text: string,
  perLetter: Record<string, LetterOverride>,
): FormLayoutUnit[] {
  const hasForms = Object.values(perLetter).some((o) => normalizeLetterForm(o.formOverride) !== "AUTO")
  if (!hasForms) return letterClusters(text).map((c) => ({ chars: text.substring(c.start, c.endExclusive), clusterStart: c.start }))
  const clusters = letterClusters(text)
  return clusters.map((_, i) => unitForCluster(text, clusters, i, perLetter))
}

/** متنِ نمایش لایه — با فرم‌های تحمیلی و بدون تغییر متن اصلی */
export function displayTextFor(text: string, perLetter: Record<string, LetterOverride>): string {
  return layoutUnitsWithForms(text, perLetter)
    .map((u) => u.chars)
    .join("")
}

/**
 * فرمِ طبیعی کلاستر در زمینهٔ واژه — برای شکستن واژه به بخش‌های مستقل.
 *
 * وقتی واژه به حروف جدا تبدیل می‌شود، هر حرف باید با همان فرمی رندر شود که
 * در واژه داشت (میانی/پایانی/آغازی) وگرنه همه جدا (تنها) می‌شوند و قطعه‌های
 * واژه دیگر کنار هم واژهٔ اصلی را نمی‌سازند. خروجی null یعنی AUTO — حرف
 * از هیچ سمت نمی‌چسبد و فرم تنها همان فرم طبیعی‌اش است (مثل ا، د، ر، و).
 */
export function clusterNaturalForm(text: string, clusterStart: number): Exclude<LetterForm, "AUTO"> | null {
  const clusters = letterClusters(text)
  const idx = clusters.findIndex((c) => c.start === clusterStart)
  if (idx < 0) return null
  const c = clusters[idx]
  const { adjacentPrev, adjacentNext, prevJoinsFwd, nextJoinsBack } = formNeighbors(clusters, idx)
  const canFwd = joinsForward(c.base)
  const canBack = joinsBackward(c.base)
  const connectedBack = adjacentPrev && prevJoinsFwd && canBack
  const connectedFwd = adjacentNext && nextJoinsBack && canFwd
  if (connectedBack && connectedFwd) return "MEDIAL"
  if (connectedBack) return "FINAL"
  if (connectedFwd) return "INITIAL"
  return null
}

/**
 * کدام فرم‌ها برای کلاستر [clusterStart] مجازند؟ (برای غیرفعال‌کردن دکمه‌های UI)
 * قانون همان اتصال‌شناسی کشیده است: حرف باید از سمتِ مربوطه بچسبد و حرفِ
 * مجاورِ واقعاً چسبان داشته باشد؛ اگر حرفِ مجاور نمی‌چسبد (مثل الف/دال) فرم
 * میانی/پایانی ممکن نیست.
 */
export function formAvailability(
  text: string,
  clusterStart: number,
): Record<LetterForm, boolean> {
  const clusters = letterClusters(text)
  const idx = clusters.findIndex((c) => c.start === clusterStart)
  if (idx < 0) return { AUTO: false, ISOLATED: false, INITIAL: false, MEDIAL: false, FINAL: false }
  const c = clusters[idx]
  const { adjacentPrev, prevJoinsFwd } = formNeighbors(clusters, idx)
  const canFwd = joinsForward(c.base)
  const canBack = joinsBackward(c.base)
  const backwardOk = !adjacentPrev || prevJoinsFwd
  return {
    AUTO: true,
    ISOLATED: true,
    INITIAL: canFwd,
    MEDIAL: canFwd && canBack && backwardOk,
    FINAL: canBack && backwardOk,
  }
}
