/**
 * مدل سند پلک — آینهٔ دقیق ir.pelc.core.model در نسخهٔ اندروید.
 *
 * نام کلیدهای JSON عیناً همان نسخهٔ Kotlin است تا فایلِ .pelc تولیدشده در وب
 * مستقیماً در اپ اندروید (و برعکس) باز شود. رنگ‌ها هم مانند نسخهٔ اندروید به‌صورت
 * عدد ARGB (0xAARRGGBB) ذخیره می‌شوند؛ توابع کمکی برای تبدیل به CSS اینجا هستند.
 */

export const CURRENT_SCHEMA_VERSION = 1

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/* ---------- رنگ ---------- */

export function argbToCss(argb: number): string {
  const hex = (argb >>> 0).toString(16).padStart(8, "0")
  return `#${hex.slice(2)}${hex.slice(0, 2)}`
}

export function cssToArgb(css: string): number {
  const m = css.replace("#", "")
  if (m.length === 6) return parseInt("ff" + m, 16) >>> 0
  if (m.length === 8) return parseInt(m.slice(6) + m.slice(0, 6), 16) >>> 0
  return 0xff1a1a1a
}

/* ---------- سند ---------- */

/** بوم سند — پیش‌فرض A4 عمودی در ۳۰۰dpi (مانند نسخهٔ اندروید) */
export interface CanvasSpec {
  width: number
  height: number
  dpi: number
}

export interface Background {
  /** عدد ARGB */
  color: number
  transparent: boolean
}

export interface Transform {
  tx: number
  ty: number
  scaleX: number
  scaleY: number
  rotationDeg: number
}

export type LayerKind = "TEXT" | "ORNAMENT" | "IMAGE"
export type FillMode = "SOLID" | "OUTLINE" | "GOLD"
export type OrnamentShape = "STAR" | "CIRCLE" | "FRAME" | "BORDER"

export interface ShadowSpec {
  radius: number
  dx: number
  dy: number
  color: number
}

export interface GoldSpec {
  enabled: boolean
  innerColor: number
  outerColor: number
}

export interface OrnamentSpec {
  shape: OrnamentShape
  color: number
  size: number
}

/** مرجع عکس لایه — خود فایل در رجیستری تصاویر (بیرون از تاریخچه) نگه داشته می‌شود */
export interface ImageRef {
  assetId: string
  /** ابعاد اصلی تصویر بر حسب پیکسل */
  width: number
  height: number
}

export interface StyleSpec {
  fillMode: FillMode
  color: number
  strokeWidth: number
  strokeColor: number
  shadow: ShadowSpec | null
  gold: GoldSpec | null
}

export interface Layer {
  id: string
  name: string
  kind: LayerKind
  visible: boolean
  locked: boolean
  opacity: number
  transform: Transform
  style: StyleSpec
  text: TextContent | null
  ornament: OrnamentSpec | null
  image: ImageRef | null
}

export interface PelcDocument {
  schemaVersion: number
  id: string
  title: string
  canvas: CanvasSpec
  background: Background
  layers: Layer[]
  createdAtEpochMs: number
  modifiedAtEpochMs: number
}

/* ---------- محتوای متنی ---------- */

export interface TextContent {
  text: string
  fontId: string
  fontSize: number
  lineHeight: number
  rtl: boolean
  color: number
  /** کلید = اندیس UTF-16 آغازِ کلاستر حرف در متن (مانند نسخهٔ اندروید) */
  perLetter: Record<string, LetterOverride>
}

export type MarkType =
  | "FATHA"
  | "DAMMA"
  | "KASRA"
  | "SHADDA"
  | "SUKUN"
  | "FATHATAN"
  | "DAMMATAN"
  | "KASRATAN"

export interface MarkTypeInfo {
  char: string
  title: string
  above: boolean
}

export const MARK_TYPES: Record<MarkType, MarkTypeInfo> = {
  FATHA: { char: "\u064E", title: "فتحه", above: true },
  DAMMA: { char: "\u064F", title: "ضمه", above: true },
  KASRA: { char: "\u0650", title: "کسره", above: false },
  SHADDA: { char: "\u0651", title: "تشدید", above: true },
  SUKUN: { char: "\u0652", title: "سکون", above: true },
  FATHATAN: { char: "\u064B", title: "تنوین فتح", above: true },
  DAMMATAN: { char: "\u064C", title: "تنوین ضم", above: true },
  KASRATAN: { char: "\u064D", title: "تنوین کسر", above: false },
}

export const MARK_ORDER: MarkType[] = [
  "FATHA", "DAMMA", "KASRA", "SHADDA", "SUKUN", "FATHATAN", "DAMMATAN", "KASRATAN",
]

export interface MarkSpec {
  type: MarkType
  dx: number
  dy: number
  scale: number
}

/**
 * حالت (فرم) شکل‌دهی حرف:
 *  - AUTO: همان فرم طبیعی زمینه (پیش‌فرض فونت)
 *  - ISOLATED: تنها (بدون اتصال)
 *  - INITIAL: آغازی (فقط اتصال از جلو)
 *  - MEDIAL: میانی (اتصال از هر دو طرف)
 *  - FINAL: پایانی (فقط اتصال از عقب)
 *
 * پیاده‌سازی وب با نویسه‌های صفرعرض ZWJ/ZWNJ در متنِ نمایش انجام می‌شود و
 * شکل‌دهی HarfBuzz مرورگر را نمی‌شکند؛ نسخهٔ اندروید همان برچسب را با
 * HarfBuzz NDK اعمال می‌کند. در JSON به‌صورت رشته ذخیره می‌شود (سازگار با
 * LetterOverride.kt که formOverride: String? دارد).
 */
export type LetterForm = "AUTO" | "ISOLATED" | "INITIAL" | "MEDIAL" | "FINAL"

export const LETTER_FORMS: LetterForm[] = ["AUTO", "ISOLATED", "INITIAL", "MEDIAL", "FINAL"]

/** خواندن امن formOverride از JSON (مقدار ناشناخته = AUTO) */
export function normalizeLetterForm(v: unknown): LetterForm {
  return LETTER_FORMS.includes(v as LetterForm) ? (v as LetterForm) : "AUTO"
}

export const LETTER_FORM_TITLES: Record<LetterForm, string> = {
  AUTO: "خودکار",
  ISOLATED: "تنها",
  INITIAL: "آغازی",
  MEDIAL: "میانی",
  FINAL: "پایانی",
}

/** بازنویسی تک‌حرف — فقط فیلدهای متفاوت از پیش‌فرض پر می‌شوند */
export interface LetterOverride {
  fontId?: string | null
  variantTag?: string | null
  formOverride?: LetterForm | null
  dx: number
  dy: number
  scale: number
  rotateDeg: number
  color?: number | null
  marks: MarkSpec[]
}

export function defaultLetterOverride(): LetterOverride {
  return {
    dx: 0,
    dy: 0,
    scale: 1,
    rotateDeg: 0,
    fontId: null,
    variantTag: null,
    formOverride: null,
    color: null,
    marks: [],
  }
}

export function isDefaultOverride(o: LetterOverride): boolean {
  const d = defaultLetterOverride()
  return (
    (o.fontId ?? null) === d.fontId &&
    (o.variantTag ?? null) === d.variantTag &&
    normalizeLetterForm(o.formOverride) === "AUTO" &&
    o.dx === d.dx &&
    o.dy === d.dy &&
    o.scale === d.scale &&
    o.rotateDeg === d.rotateDeg &&
    (o.color ?? null) === d.color &&
    o.marks.length === d.marks.length
  )
}

/* ---------- کارخانه‌های پیش‌فرض (مطابق مقادیر Kotlin) ---------- */

export function defaultCanvasSpec(): CanvasSpec {
  return { width: 2480, height: 3508, dpi: 300 }
}

export function defaultBackground(): Background {
  return { color: 0xffffffff, transparent: false }
}

export function defaultTransform(): Transform {
  return { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 }
}

export function defaultStyleSpec(): StyleSpec {
  return {
    fillMode: "SOLID",
    color: 0xff1a1a1a,
    strokeWidth: 0,
    strokeColor: 0xff101010,
    shadow: null,
    gold: null,
  }
}

export function defaultTextContent(): TextContent {
  return {
    text: "بسم الله",
    fontId: "amiri",
    fontSize: 120,
    lineHeight: 1.4,
    rtl: true,
    color: 0xff1a1a1a,
    perLetter: {},
  }
}

export function newLayer(name = "لایه"): Layer {
  return {
    id: newId(),
    name,
    kind: "TEXT",
    visible: true,
    locked: false,
    opacity: 1,
    transform: defaultTransform(),
    style: defaultStyleSpec(),
    text: defaultTextContent(),
    ornament: null,
    image: null,
  }
}

/**
 * شناسهٔ قطعی سند.
 *
 * سند آغازین هم در SSR ساخته می‌شود هم در کلاینت؛ اگر شناسه تصادفی باشد،
 * HTML سرور و رندر کلاینت شناسهٔ متفاوت خواهند داشت و hydration می‌شکند.
 * سند به‌صورت پیش‌فرض «خالی» است — هیچ لایهٔ متنی از قبل وجود ندارد؛ کاربر
 * از دکمهٔ «+» بوم متن یا عکس اضافه می‌کند. لایه‌هایی که بعداً ساخته می‌شوند
 * UUID تصادفی می‌گیرند (فقط در کلاینت ساخته می‌شوند، SSR در کار نیست).
 */
export const INITIAL_DOC_ID = "pelc-doc-initial"
export const INITIAL_LAYER_ID = "pelc-layer-initial"

export function newDocument(): PelcDocument {
  const now = Date.now()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: INITIAL_DOC_ID,
    title: "بی‌نام",
    canvas: defaultCanvasSpec(),
    background: defaultBackground(),
    layers: [],
    createdAtEpochMs: now,
    modifiedAtEpochMs: now,
  }
}

/* ---------- کمکی‌های سند ---------- */

export function findLayer(doc: PelcDocument, id: string | null): Layer | null {
  if (!id) return null
  return doc.layers.find((l) => l.id === id) ?? null
}

export function withLayer(doc: PelcDocument, layerId: string, mutate: (l: Layer) => Layer): PelcDocument {
  return {
    ...doc,
    modifiedAtEpochMs: Date.now(),
    layers: doc.layers.map((l) => (l.id === layerId ? mutate(l) : l)),
  }
}

/** پالت رنگ‌های پیش‌فرض برای انتخاب سریع */
export const COLOR_SWATCHES: { label: string; argb: number }[] = [
  { label: "مرکبی", argb: 0xff1a1a1a },
  { label: "سفید", argb: 0xffffffff },
  { label: "طلایی", argb: 0xffd4af37 },
  { label: "لاجوردی", argb: 0xff1e3a5f },
  { label: "شنگرفی", argb: 0xffa52a2a },
  { label: "زمردی", argb: 0xff0f6e4e },
  { label: "نقره‌ای", argb: 0xff8a8a8a },
  { label: "قهوه‌ای", argb: 0xff5c3a1e },
]
