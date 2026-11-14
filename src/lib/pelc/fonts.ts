/**
 * مخزن قلم پلک — فونت‌های همراه OFL 1.1، مشابه feature-fonts نسخهٔ اندروید.
 * همهٔ فایل‌ها در /public/fonts هستند و با @font-face در globals.css ثبت شده‌اند.
 */

export interface PelcFont {
  id: string
  displayName: string
  style: string
  license: string
  /** نام فایل در /public/fonts */
  file: string
  /** نام خانوادهٔ CSS برای font-family */
  cssFamily: string
}

export const PELC_FONTS: PelcFont[] = [
  { id: "amiri", displayName: "امیری", style: "نسخ/ثلث‌مانند", license: "OFL 1.1", file: "Amiri-Regular.ttf", cssFamily: '"Amiri"' },
  { id: "amiri-bold", displayName: "امیری پُررنگ", style: "نسخ/ثلث‌مانند", license: "OFL 1.1", file: "Amiri-Bold.ttf", cssFamily: '"Amiri Bold"' },
  { id: "scheherazade", displayName: "شهرزاد نو", style: "نسخ کلاسیک", license: "OFL 1.1", file: "ScheherazadeNew-Regular.ttf", cssFamily: '"Scheherazade New"' },
  { id: "aref-ruqaa", displayName: "عارف رقعه", style: "رقعه", license: "OFL 1.1", file: "ArefRuqaa-Regular.ttf", cssFamily: '"Aref Ruqaa"' },
  { id: "reem-kufi", displayName: "ریم کوفی", style: "کوفی مدرن", license: "OFL 1.1", file: "ReemKufi.ttf", cssFamily: '"Reem Kufi"' },
  { id: "kufi-noto", displayName: "کوفی نوتو", style: "کوفی", license: "OFL 1.1", file: "NotoKufiArabic.ttf", cssFamily: '"Noto Kufi Arabic"' },
  { id: "lateef", displayName: "لطیف", style: "نسخ ساده", license: "OFL 1.1", file: "Lateef-Regular.ttf", cssFamily: '"Lateef"' },
  { id: "naskh-noto", displayName: "نسخ نوتو", style: "نسخ", license: "OFL 1.1", file: "NotoNaskhArabic.ttf", cssFamily: '"Noto Naskh Arabic"' },
  { id: "gulzar", displayName: "گلزار", style: "نستعلیق", license: "OFL 1.1", file: "Gulzar-Regular.ttf", cssFamily: '"Gulzar"' },
  { id: "nastaliq", displayName: "نستعلیق اردو", style: "نستعلیق", license: "OFL 1.1", file: "NotoNastaliqUrdu.ttf", cssFamily: '"Noto Nastaliq Urdu"' },
]

export function fontById(id: string): PelcFont {
  return PELC_FONTS.find((f) => f.id === id) ?? PELC_FONTS[0]
}

/** نام خانوادهٔ CSS برای یک شناسهٔ قلم */
export function fontCssFamily(fontId: string): string {
  return fontById(fontId).cssFamily
}

/** پش‌بارگیری فونت برای رندر بوم و خروجی‌گیری (document.fonts) */
export async function ensureFontLoaded(fontId: string, sizePx = 100): Promise<void> {
  if (typeof document === "undefined") return
  const family = fontCssFamily(fontId)
  try {
    await document.fonts.load(`${sizePx}px ${family}`, "بسم اBE0123")
    await document.fonts.load(`${sizePx}px ${family}`, "ﻻﻼﻻ بتجسد")
  } catch {
    /* فونت از قبل بار شده یا مرورگر پشتیبانی نمی‌کند */
  }
}
