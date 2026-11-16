/**
 * رجیستری تصاویر پلک — خودِ فایل عکس (data URL) بیرون از سند و تاریخچه
 * نگه داشته می‌شود؛ لایه فقط شناسه و ابعاد را حمل می‌کند. این کار تاریخچهٔ
 * واگرد سبک می‌ماند و هزاران نسخهٔ عکس در حافظه نسازد.
 *
 * عکس هنگام ورود به بیشینهٔ ۲۰۴۸ پیکسل کوچک می‌شود تا رندر بوم و خروجی
 * سریع بماند؛ PNG برای حفظ شفافیت همان‌طور PNG می‌ماند، بقیه JPEG می‌شوند.
 */

import { newId } from "./model"

export interface ImageAsset {
  id: string
  /** data URL برای نمایش بوم و رسم در خروجی */
  src: string
  /** ابعاد واقعی پس از کوچک‌سازی */
  width: number
  height: number
  mime: string
}

const registry = new Map<string, ImageAsset>()

/** بیشینهٔ بعد بزرگ عکس واردشده */
const MAX_DIMENSION = 2048

export function registerImage(asset: Omit<ImageAsset, "id">): string {
  const id = newId()
  registry.set(id, { ...asset, id })
  return id
}

export function getImageAsset(id: string | null | undefined): ImageAsset | null {
  if (!id) return null
  return registry.get(id) ?? null
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود"))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("تصویر معتبر نیست"))
    img.src = src
  })
}

/** رسم تصویر در خروجی PNG/JPG — در export.ts به‌صورت async بارگذاری می‌شود */

/**
 * واردکردن فایل عکس: خواندن، کوچک‌سازی تا ۲۰۴۸ پیکسل و ساخت data URL.
 * PNG شفافیت را نگه می‌دارد؛ سایر قالب‌ها JPEG با کیفیت ۰٫۹ می‌شوند.
 */
export async function importImageFile(file: File): Promise<ImageAsset> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل عکس انتخاب کنید")
  }
  const dataUrl = await readAsDataURL(file)
  const img = await loadImage(dataUrl)
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (naturalW <= 0 || naturalH <= 0) throw new Error("تصویر معتبر نیست")

  const ratio = Math.min(1, MAX_DIMENSION / Math.max(naturalW, naturalH))
  const width = Math.max(1, Math.round(naturalW * ratio))
  const height = Math.max(1, Math.round(naturalH * ratio))
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg"

  if (ratio >= 1) {
    // تصویر کوچک‌تر از حد است — بدون بازکدگذاری
    return { id: "", src: dataUrl, width, height, mime }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, width, height)
  const src = canvas.toDataURL(mime, 0.9)
  return { id: "", src, width, height, mime }
}
