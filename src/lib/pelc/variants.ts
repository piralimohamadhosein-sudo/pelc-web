/**
 * آشکارساز گونه‌های حرف — معادل وب VariantDetector.kt نسخهٔ اندروید.
 *
 * نسخهٔ اندروید با HarfBuzz شکل می‌دهد و فقط گونه‌هایی را پیشنهاد می‌دهد که
 * واقعاً جریان گلیف را عوض می‌کنند. اینجا فهرست برچسب‌های GSUB مستقیماً از
 * جدول OpenType فونت خوانده می‌شود و به همان مجموعهٔ VARIANT_TAGS فیلتر می‌شود.
 * (فیلتر نهایی «فقط گونه‌هایی که شکل را عوض می‌کنند» کاملش در بیلد اندروید است.)
 */

const VARIANT_TAGS: Set<string> = (() => {
  const s = new Set<string>(["salt", "swsh", "cswh", "jalt"])
  for (let i = 1; i <= 20; i++) s.add(`ss${String(i).padStart(2, "0")}`)
  for (let i = 1; i <= 20; i++) s.add(`cv${String(i).padStart(2, "0")}`)
  return s
})()

/** برچسب‌های GSUB خوانده‌شده از فایل فونت، به‌ازای شناسهٔ قلم */
const cache = new Map<string, string[]>()

function readFourCc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

/**
 * خواندن برچسب‌های فهرست Feature از جدول GSUB یک فایل TTF/OTF.
 * فقط برچسب‌ها لازم‌اند، نه lookupها — پس پارس سبک و ایمن است.
 */
function parseGsubFeatureTags(buffer: ArrayBuffer): string[] {
  try {
    const view = new DataView(buffer)
    const numTables = view.getUint16(4)
    let gsubOffset = -1
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16
      if (readFourCc(view, rec) === "GSUB") {
        gsubOffset = view.getUint32(rec + 8)
        break
      }
    }
    if (gsubOffset < 0) return []

    // GSUB header: version(4) scriptList(2) featureList(2) lookupList(2)
    const featureListOffset = view.getUint16(gsubOffset + 6)
    if (featureListOffset === 0) return []
    const featureList = gsubOffset + featureListOffset
    const featureCount = view.getUint16(featureList)
    const tags: string[] = []
    for (let i = 0; i < featureCount; i++) {
      const rec = featureList + 2 + i * 6
      tags.push(readFourCc(view, rec))
    }
    return tags
  } catch {
    return []
  }
}

/** برچسب‌های گونهٔ موجود در فونت (فیلترشده به VARIANT_TAGS، بدون تکرار) */
export async function detectVariantTags(fontId: string, file: string): Promise<string[]> {
  if (cache.has(fontId)) return cache.get(fontId)!
  let tags: string[] = []
  try {
    const res = await fetch(`/fonts/${file}`)
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      tags = parseGsubFeatureTags(buffer).filter((t) => VARIANT_TAGS.has(t))
      // ترتیب پایدار: salt اول، بعد ssها، بعد cvها و بقیه
      const rank = (t: string) => (t === "salt" ? 0 : t.startsWith("ss") ? 1 : t.startsWith("cv") ? 2 : 3)
      tags = [...new Set(tags)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    }
  } catch {
    tags = []
  }
  cache.set(fontId, tags)
  return tags
}

/** توضیح کوتاه یک برچسب گونه برای نمایش در رابط */
export function variantTagLabel(tag: string): string {
  if (tag === "salt") return "گونهٔ جایگزین (salt)"
  if (tag === "swsh") return "سواش حروف‌پیوسته (swsh)"
  if (tag === "cswh") return "سواش زمینه‌ای (cswh)"
  if (tag === "jalt") return "جایگزین زمینه‌ای (jalt)"
  if (tag.startsWith("ss")) return `مجموعهٔ سبکی ${tag.slice(2)} (${tag})`
  if (tag.startsWith("cv")) return `گونهٔ نویسهٔ ${tag.slice(2)} (${tag})`
  return tag
}
