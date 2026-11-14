/**
 * خروجی‌گیری نسخهٔ وب — معادل سبک‌شدهٔ core-export اندروید.
 *
 *  - PNG شفاف یا با پس‌زمینهٔ سند
 *  - JPG با کنترل کیفیت (پیش‌فرض ۹۲ مثل اندروید)
 *  - SVG وکتوری با جاسازی فونت به‌صورت base64 (فونت‌مستقل، مشابه نسخهٔ اندروید)
 *  - .pelc همان JSON مدل سند (سازگار با اپ اندروید)
 *
 * PSD/DXF/PDF در بیلد اندروید ارائه می‌شوند؛ در نسخهٔ وب آزمایشی نیستند.
 */

import type { CSSProperties } from "react"
import { argbToCss, type Layer, type PelcDocument } from "./model"
import { displayTextFor } from "./arabicText"
import { ensureFontLoaded, fontById, fontCssFamily } from "./fonts"

export type ExportFormat = "PNG" | "JPG" | "SVG" | "PELC"

export interface RasterOptions {
  /** ضریب بزرگ‌نمایی خروجی روی اندازهٔ سند */
  scale: 1 | 2
  /** فقط برای JPG: کیفیت ۶۰..۱۰۰ */
  quality: number
}

function layerCssFont(layer: Layer): string {
  const t = layer.text
  if (!t) return ""
  const family = fontCssFamily(t.fontId)
  const weight = t.fontId === "amiri-bold" ? 700 : 400
  return `${weight} ${t.fontSize}px ${family}`
}

/**
 * استایل‌های اعمال‌شونده بر متن لایه — یک منبع حقیقت برای نمایش بوم و خروجی SVG.
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

/** رندر کامل سند روی بوم 2D (برای PNG/JPG) — شکل‌دهی را مرورگر انجام می‌دهد */
async function renderDocumentToCanvas(doc: PelcDocument, scale: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(doc.canvas.width * scale)
  canvas.height = Math.round(doc.canvas.height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)

  if (!doc.background.transparent) {
    ctx.fillStyle = argbToCss(doc.background.color)
    ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height)
  }

  // بارگذاری همهٔ فونت‌های استفاده‌شده پیش از رسم
  const fontLoads = doc.layers
    .filter((l) => l.visible && l.text)
    .map((l) => ensureFontLoaded(l.text!.fontId, Math.min(l.text!.fontSize * Math.max(l.text!.lineHeight, 1), 500)))
  await Promise.all(fontLoads)

  for (const layer of doc.layers) {
    if (!layer.visible || !layer.text) continue
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
  const canvas = await renderDocumentToCanvas(doc, opts.scale)
  return canvasToBlob(canvas, "image/png")
}

export async function exportJpg(doc: PelcDocument, opts: RasterOptions): Promise<Blob> {
  const canvas = await renderDocumentToCanvas(doc, opts.scale)
  return canvasToBlob(canvas, "image/jpeg", Math.min(100, Math.max(60, opts.quality)) / 100)
}

/** جاسازی فایل فونت به‌صورت data URI برای SVG فونت‌مستقل */
async function fontDataUri(fontId: string): Promise<string> {
  const font = fontById(fontId)
  const res = await fetch(`/fonts/${font.file}`)
  if (!res.ok) return ""
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:font/ttf;base64,${btoa(binary)}`
}

export async function exportSvg(doc: PelcDocument): Promise<Blob> {
  const usedFontIds = [...new Set(doc.layers.map((l) => l.text?.fontId).filter(Boolean) as string[])]
  const dataUris = new Map<string, string>()
  for (const id of usedFontIds) dataUris.set(id, await fontDataUri(id))

  const { width, height } = doc.canvas
  const defs: string[] = []
  for (const id of usedFontIds) {
    const f = fontById(id)
    const uri = dataUris.get(id)
    if (uri) {
      defs.push(
        `    @font-face { font-family: ${f.cssFamily}; font-weight: ${id === "amiri-bold" ? 700 : 400}; src: url(${uri}) format("truetype"); }`,
      )
    }
  }

  const bg = doc.background.transparent
    ? ""
    : `  <rect width="${width}" height="${height}" fill="${argbToCss(doc.background.color)}"/>\n`

  const layerEls: string[] = []
  for (const layer of doc.layers) {
    if (!layer.visible || !layer.text) continue
    const t = layer.text
    const st = layer.style
    const tags = Object.values(t.perLetter)
      .map((o) => o.variantTag)
      .filter((v): v is string => Boolean(v))
    const features = tags.length > 0 ? ` font-feature-settings="${tags.map((tg) => `"${tg}" 1`).join(",")}"` : ""
    const family = fontCssFamily(t.fontId)
    const weight = t.fontId === "amiri-bold" ? 700 : 400
    const fill =
      st.fillMode === "GOLD" && st.gold?.enabled
        ? `url(#gold-${layer.id})`
        : argbToCss(st.color)
    const goldDef =
      st.fillMode === "GOLD" && st.gold?.enabled
        ? `  <linearGradient id="gold-${layer.id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${argbToCss(st.gold.innerColor)}"/>
    <stop offset="0.55" stop-color="${argbToCss(st.gold.outerColor)}"/>
    <stop offset="1" stop-color="${argbToCss(st.gold.innerColor)}"/>
  </linearGradient>\n`
        : ""
    if (goldDef) defs.push(goldDef)

    const lines = displayTextFor(t.text, t.perLetter).split("\n")
    const tspans = lines
      .map((line, i) => `    <tspan x="${layer.transform.tx}" y="${layer.transform.ty + i * t.fontSize * t.lineHeight}">${xmlEscape(line)}</tspan>`)
      .join("\n")

    layerEls.push(
      `  <text font-family=${quoteAttr(family)} font-weight="${weight}" font-size="${t.fontSize}" fill="${fill}" direction="${t.rtl ? "rtl" : "ltr"}" text-anchor="end"${features} opacity="${layer.opacity}">\n${tspans}\n  </text>`,
    )
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
${defs.join("\n")}
    </style>
  </defs>
${bg}${layerEls.join("\n")}
</svg>
`
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function quoteAttr(s: string): string {
  return `"${s.replace(/"/g, "'")}"`
}

export function exportPelcJson(doc: PelcDocument): Blob {
  return new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
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
