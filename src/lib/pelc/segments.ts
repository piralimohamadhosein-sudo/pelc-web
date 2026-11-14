/**
 * قطعه‌بندی متن برای رندر «به‌تفکیک حرف».
 *
 * مرورگر فقط قابلیت‌های OpenType و قلم را در سطح عنصر اعمال می‌کند؛ برای اینکه
 * گونهٔ GSUB / قلم جایگزین / رنگِ «یک حرفِ مشخص» واقعاً همان حرف را عوض کند
 * (و نه کل جمله را)، متن نمایش به قطعه‌های هم‌سبک شکسته می‌شود و هر قطعه در
 * یک <span> با استایل خودش رندر می‌گردد.
 *
 * قطعه‌های مجاورِ هم‌سبک ادغام می‌شوند تا متن بدون override همیشه یک تکه
 * بماند و اتصال حروف هیچ فرقی با رندر ساده نکند.
 */

import { layoutUnitsWithForms } from "./arabicText"
import type { LetterOverride } from "./model"

export interface TextSegment {
  text: string
  /** قلم این قطعه (شناسهٔ PELC_FONTS) */
  fontId: string
  /** برچسب‌های GSUB اعمالی روی این قطعه (مثل "ss01") */
  tags: string[]
  /** رنگ ARGB یا null = ارث از لایه */
  color: number | null
}

interface SegmentStyleKey {
  fontId: string
  tags: string
  color: number | null
}

function styleOf(override: LetterOverride | undefined, baseFontId: string, baseColor: number | null): SegmentStyleKey {
  return {
    fontId: override?.fontId ?? baseFontId,
    tags: override?.variantTag ?? "",
    color: override?.color ?? baseColor,
  }
}

function sameStyle(a: SegmentStyleKey, b: SegmentStyleKey): boolean {
  return a.fontId === b.fontId && a.tags === b.tags && a.color === b.color
}

/**
 * ساخت قطعه‌های هم‌سبک از متن لایه.
 * [baseColor] وقتی افکت طلایی فعال است null بدهید تا رنگ ارثیِ شفاف حفظ شود.
 */
export function buildTextSegments(
  text: string,
  perLetter: Record<string, LetterOverride>,
  baseFontId: string,
  baseColor: number | null,
): TextSegment[] {
  const units = layoutUnitsWithForms(text, perLetter)
  const segments: TextSegment[] = []

  for (const unit of units) {
    const override = unit.clusterStart !== null ? perLetter[String(unit.clusterStart)] : undefined
    const style = styleOf(override, baseFontId, baseColor)
    const last = segments[segments.length - 1]
    if (
      last &&
      sameStyle(
        { fontId: last.fontId, tags: last.tags.join(","), color: last.color },
        style,
      )
    ) {
      last.text += unit.chars
    } else {
      segments.push({
        text: unit.chars,
        fontId: style.fontId,
        tags: style.tags ? style.tags.split(",") : [],
        color: style.color,
      })
    }
  }

  return segments
}
