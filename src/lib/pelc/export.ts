/**
 * خروجی‌گیری نسخهٔ وب — معادل سبک‌شدهٔ core-export اندروید.
 *
 *  - PNG شفاف یا با پس‌زمینهٔ سند
 *  - JPG با کنترل کیفیت (پیش‌فرض ۹۲ مثل اندروید)
 *
 * PSD/DXF/PDF/SVG در بیلد اندروید ارائه می‌شوند؛ در نسخهٔ وب آزمایشی نیستند.
 */

import type { CSSProperties } from "react"
import { argbToCss, type Layer, type PelcDocument } from "./model"
import { displayTextFor } from "./arabicText"
import { ensureFontLoaded, fontCssFamily } from "./fonts"
import { getImageAsset } from "./images"

export type ExportFormat = "PNG" | "JPG"

export interface RasterOptions {
  /** ضریب بزرگ‌نمایی خروجی روی اندازهٔ سند */
  scale: 1 | 2
  /** فقط برای JPG: کیفیت ۶۰..۱۰۰ */
  quality: number
  /** پس‌زمینهٔ شفاف برای خروجی — مناسب استفاده روی پوستر (به جز JPG که شفافیت ندارد) */
  transparent?: boolean
}

function layerCssFont(layer: Layer): string {
  const t = layer.text
  if (!t) return ""
  const family = fontCssFamily(t.fontId)
  const weight = t.fontId === "amiri-bold" ? 700 : 400
  return `${weight} ${t.fontSize}px ${family}`
}

/**
 * استایل‌های اعمال‌شونده بر متن لایه — یک منبع حقیقت برای نمایش بوم و خروجی.
 * [scale] برای نمایش داخل بوم است (۱ = واحدهای سند).
 */
export function layerTextStyle(layer: Layer, scale = 1): CSSProperties {
  const t = layer.text
  if (!t) return {}
  const style: CSSProperties = {
    fontFamily: fontCssFamily(t.fontId),
    fontWeight: t.fontId === "amiri-bold" ? 700 : 400,
    fontSize: t.fontSize * scale,
    lineHeight: t.lineHeight,
    color: argbToCss(t.color),
    direction: t.rtl ? "rtl" : "ltr",
    whiteSpace: "pre-wrap",
  }
  // گونه‌ها و قلمِ تک‌حرف در بوم با قطعه‌بندی (buildTextSegments) به‌تفکیک حرف
  // اعمال می‌شوند؛ پس اینجا دیگر در سطح لایه اعمال نمی‌شوند.
  // افکت‌ها
  const st = layer.style
  if (st.fillMode === "OUTLINE" && st.strokeWidth > 0) {
    style.WebkitTextStroke = `${Math.min((st.strokeWidth * scale) / 8, 24)}px ${argbToCss(st.strokeColor)}`
    style.paintOrder = "stroke fill"
  }
  if (st.gold?.enabled) {
    const inner = argbToCss(st.gold.innerColor)
    const outer = argbToCss(st.gold.outerColor)
    style.background = `linear-gradient(180deg, ${inner} 0%, ${outer} 55%, ${inner} 100%)`
    style.WebkitBackgroundClip = "text"
    style.backgroundClip = "text"
    style.color = "transparent"
    style.WebkitTextFillColor = "transparent"
  }
  if (st.shadow) {
    style.textShadow = `${(st.shadow.dx * scale) / 8}px ${(st.shadow.dy * scale) / 8}px ${(st.shadow.radius * scale) / 6}px ${argbToCss(st.shadow.color)}`
  }
  return style
}

/**
 * رندر کامل سند روی بوم 2D (برای PNG/JPG) — شکل‌دهی را مرورگر انجام می‌دهد.
 * [forceTransparent] پس‌زمینه را خالی می‌گذارد (کانال آلفا)؛ [flattenWhite]
 * برای قالب‌های بدون آلفا (JPG) پس‌زمینهٔ سفید می‌کشد تا سیاه نشود.
 */
async function renderDocumentToCanvas(
  doc: PelcDocument,
  scale: number,
  forceTransparent = false,
  flattenWhite = false,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(doc.canvas.width * scale)
  canvas.height = Math.round(doc.canvas.height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)

  if (flattenWhite) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height)
  } else if (!forceTransparent && !doc.background.transparent) {
    ctx.fillStyle = argbToCss(doc.background.color)
    ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height)
  }

  // بارگذاری همهٔ فونت‌های استفاده‌شده پیش از رسم
  const fontLoads = doc.layers
    .filter((l) => l.visible && l.text)
    .map((l) => ensureFontLoaded(l.text!.fontId, Math.min(l.text!.fontSize * Math.max(l.text!.lineHeight, 1), 500)))
  await Promise.all(fontLoads)

  // بارگذاری عکس‌های لایه‌های تصویری (عکس‌نوشته)
  const imageEls = new Map<string, HTMLImageElement>()
  await Promise.all(
    doc.layers
      .filter((l) => l.visible && l.kind === "IMAGE" && l.image)
      .map(async (l) => {
        const asset = getImageAsset(l.image!.assetId)
        if (!asset) return
        const img = new Image()
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = asset.src
        })
        if (img.naturalWidth > 0) imageEls.set(l.id, img)
      }),
  )

  for (const layer of doc.layers) {
    if (!layer.visible) continue

    // لایهٔ عکس — رسم تصویر با اندازهٔ مقیاس‌شده (فقط جابه‌جایی/مقیاس)
    if (layer.kind === "IMAGE" && layer.image) {
      const img = imageEls.get(layer.id)
      if (img) {
        ctx.save()
        ctx.globalAlpha = layer.opacity
        ctx.translate(layer.transform.tx, layer.transform.ty)
        if (layer.transform.rotationDeg !== 0) {
          ctx.rotate((layer.transform.rotationDeg * Math.PI) / 180)
        }
        ctx.drawImage(
          img,
          0,
          0,
          layer.image.width * layer.transform.scaleX,
          layer.image.height * layer.transform.scaleY,
        )
        ctx.restore()
      }
      continue
    }

    if (!layer.text) continue
    const t = layer.text
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.translate(layer.transform.tx, layer.transform.ty)
    if (layer.transform.rotationDeg !== 0) {
      ctx.rotate((layer.transform.rotationDeg * Math.PI) / 180)
    }
    ctx.scale(layer.transform.scaleX, layer.transform.scaleY)
    ctx.font = layerCssFont(layer)
    ctx.textBaseline = "top"
    // لنگر فیزیکی چپ تا جعبهٔ متن دقیقاً [tx, tx+عرض] باشد (مطابق DOM و Canvas اندروید)
    ctx.textAlign = "left"
    ctx.direction = t.rtl ? "rtl" : "ltr"

    const st = layer.style
    if (st.fillMode === "GOLD" && st.gold?.enabled) {
      const grad = ctx.createLinearGradient(0, 0, 0, t.fontSize * 1.2)
      grad.addColorStop(0, argbToCss(st.gold.innerColor))
      grad.addColorStop(0.55, argbToCss(st.gold.outerColor))
      grad.addColorStop(1, argbToCss(st.gold.innerColor))
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = argbToCss(st.color)
    }

    if (st.shadow) {
      ctx.shadowBlur = st.shadow.radius
      ctx.shadowColor = argbToCss(st.shadow.color)
      ctx.shadowOffsetX = st.shadow.dx
      ctx.shadowOffsetY = st.shadow.dy
    }

    const lines = displayTextFor(t.text, t.perLetter).split("\n")
    const lineH = t.fontSize * t.lineHeight
    lines.forEach((line, i) => {
      const y = i * lineH
      if (st.fillMode === "OUTLINE" && st.strokeWidth > 0) {
        ctx.lineJoin = "round"
        ctx.strokeStyle = argbToCss(st.strokeColor)
        ctx.lineWidth = st.strokeWidth
        ctx.strokeText(line, 0, y)
      }
      ctx.fillText(line, 0, y)
    })
    ctx.restore()
  }
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("خطا در تولید خروجی"))),
      mime,
      quality,
    )
  })
}

export async function exportPng(doc: PelcDocument, opts: RasterOptions): Promise<Blob> {
  const canvas = await renderDocumentToCanvas(doc, opts.scale, opts.transparent === true)
  return canvasToBlob(canvas, "image/png")
}

export async function exportJpg(doc: PelcDocument, opts: RasterOptions): Promise<Blob> {
  // JPG کانال آلفا ندارد؛ اگر شفاف خواسته شده باشد، روی سفید تخت می‌شود
  const transparent = opts.transparent === true
  const canvas = await renderDocumentToCanvas(doc, opts.scale, transparent, transparent)
  return canvasToBlob(canvas, "image/jpeg", Math.min(100, Math.max(60, opts.quality)) / 100)
}

/** دانلود یک Blob به‌عنوان فایل */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** پاک‌سازی نام سند برای استفاده در نام فایل */
export function safeFilename(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, "-").trim()
  return cleaned || "بدون-عنوان"
}

// قلاب آزمون مرورگری: دسترسی مستقیم توابع خروجی در کنسول برای عیب‌یابی.
// مثل __pelcStore باید بعد از تعریف توابع اجرا شود.
if (typeof window !== "undefined") {
  ;(window as unknown as Record<string, unknown>).__pelcExport = { exportPng, exportJpg }
}
