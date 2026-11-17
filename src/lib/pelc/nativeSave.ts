/**
 * ذخیرهٔ بومی تصویر در گالری اندروید — فقط در بیلد Capacitor.
 *
 * روی اندروید، تصویر در آلبوم «پلک» داخل گالری (MediaStore) ثبت می‌شود؛
 * در مرورگر هرگز فراخوانی نمی‌شود و مسیر دانلود عادی (downloadBlob) باز می‌ماند.
 */

import { Capacitor } from "@capacitor/core"
import { Media } from "@capacitor-community/media"

/** نام آلبومی که تصاویر پلک در گالری می‌نشینند */
const GALLERY_ALBUM = "پلک"

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("خواندن فایل خروجی ناموفق بود"))
    reader.readAsDataURL(blob)
  })
}

/** یافتن یا ساختن آلبوم «پلک» در گالری و بازگرداندن شناسهٔ آن */
async function ensureAlbum(): Promise<string> {
  const find = async (): Promise<{ name: string; identifier: string } | undefined> => {
    const res = await Media.getAlbums()
    return res.albums.find((a) => a.name === GALLERY_ALBUM)
  }

  let album = await find()
  if (!album) {
    try {
      await Media.createAlbum({ name: GALLERY_ALBUM })
    } catch {
      // «آلبوم از قبل هست» — بی‌اهمیت، ادامه می‌دهیم
    }
    album = await find()
  }
  if (!album) throw new Error("ساخت آلبوم «پلک» در گالری ناموفق بود")
  return album.identifier
}

/** آیا در بستهٔ بومی (اندروید) اجرا می‌شویم؟ */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * ذخیرهٔ تصویر خروجی در گالری دستگاه — نسخهٔ اندروید.
 * [baseName] بدون پسوند است؛ پسوند از نوع MIME خود فایل گرفته می‌شود.
 */
export async function saveImageToGallery(blob: Blob, baseName: string): Promise<string> {
  const dataUrl = await blobToDataUrl(blob)
  const albumIdentifier = await ensureAlbum()

  // نام یکتا: عنوان سند + زمان — بدون پسوند (پسوند را افزونه از MIME می‌گذارد)
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14)
  const fileName = `${baseName}_${stamp}`.replace(/[\\/:*?"<>|]/g, "-")

  const res = await Media.savePhoto({
    path: dataUrl,
    albumIdentifier,
    fileName,
  })
  return res.filePath ?? fileName
}
