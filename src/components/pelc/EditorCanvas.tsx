"use client"

/**
 * بوم ویرایشگر پلک — معادل وب EditorCanvas.kt نسخهٔ اندروید.
 *
 * هر لایه یک عنصر DOM مستقل است؛ شکل‌دهی فارسی/عربی را موتور متن مرورگر
 * (خود HarfBuzz) انجام می‌دهد — پس اتصال حروف و جای علامت‌ها همیشه درست است.
 * لایه‌ها با اشاره‌گر کشیده می‌شوند: در حین کشیدن به‌صورت زنده (بدون تاریخچه)
 * پیش‌نمایش می‌شود و در پایانِ کشیدن یک گام «جابه‌جایی لایه» ثبت می‌گردد.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, findLayer } from "@/lib/pelc/model"
import { layerTextStyle } from "@/lib/pelc/export"

const MIN_SCALE_FRACTION = 0.86 // بیشینهٔ عرض نسبی سند داخل مرحله

export function EditorCanvas() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const beginLiveUpdate = useEditorStore((s) => s.beginLiveUpdate)
  const commitLiveUpdate = useEditorStore((s) => s.commitLiveUpdate)

  const stageRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.12)
  const dragState = useRef<{
    layerId: string
    startX: number
    startY: number
    baseTx: number
    baseTy: number
    moved: boolean
  } | null>(null)

  // مقیاس سند برای جا شدن در مرحله
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const s = Math.min((w * MIN_SCALE_FRACTION) / doc.canvas.width, (h * MIN_SCALE_FRACTION) / doc.canvas.height)
      setScale(Math.max(s, 0.02))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc.canvas.width, doc.canvas.height])

  const onPointerDown = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      const layer = findLayer(doc, layerId)
      if (!layer || layer.locked) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragState.current = {
        layerId,
        startX: e.clientX,
        startY: e.clientY,
        baseTx: layer.transform.tx,
        baseTy: layer.transform.ty,
        moved: false,
      }
      selectLayer(layerId)
    },
    [doc, selectLayer],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragState.current
      if (!d) return
      const dxDoc = (e.clientX - d.startX) / scale
      const dyDoc = (e.clientY - d.startY) / scale
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 3) d.moved = true
      if (!d.moved) return
      const next = findLayer(doc, d.layerId)
      if (!next) return
      const updated = {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === d.layerId
            ? { ...l, transform: { ...l.transform, tx: Math.round(d.baseTx + dxDoc), ty: Math.round(d.baseTy + dyDoc) } }
            : l,
        ),
      }
      beginLiveUpdate(updated)
    },
    [doc, scale, beginLiveUpdate],
  )

  const onPointerUp = useCallback(() => {
    const d = dragState.current
    dragState.current = null
    if (d?.moved) commitLiveUpdate("جابه‌جایی لایه")
  }, [commitLiveUpdate])

  const docW = doc.canvas.width * scale
  const docH = doc.canvas.height * scale

  return (
    <div ref={stageRef} className="pelc-stage relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={docRef}
          className={`pelc-doc relative ${doc.background.transparent ? "pelc-checkerboard" : ""}`}
          style={{
            width: docW,
            height: docH,
            background: doc.background.transparent ? undefined : argbToCss(doc.background.color),
          }}
        >
          {doc.layers.map((layer) => {
            if (!layer.visible) return null
            const t = layer.text
            const selected = layer.id === selectedLayerId
            return (
              <div
                key={layer.id}
                role="button"
                tabIndex={0}
                aria-label={`لایهٔ ${layer.name}`}
                className={`absolute left-0 top-0 select-none ${selected ? "pelc-layer-handle" : "pelc-layer-dim"}`}
                style={{
                  transform: `translate(${layer.transform.tx * scale}px, ${layer.transform.ty * scale}px)`,
                  opacity: layer.opacity,
                  ...layerTextStyle(layer, scale),
                }}
                onPointerDown={(e) => onPointerDown(e, layer.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    selectLayer(layer.id)
                  }
                }}
              >
                {t?.text}
              </div>
            )
          })}
        </div>
      </div>

      {/* نوار وضعیت بوم */}
      <div
        className="pointer-events-none absolute bottom-2 start-2 rounded-md bg-black/45 px-2.5 py-1 text-[11px] text-amber-100/90"
        dir="rtl"
      >
        <span dir="ltr">
          {doc.canvas.width} × {doc.canvas.height} · {doc.canvas.dpi}dpi · {Math.round(scale * 100)}%
        </span>
        <span className="ms-2">· برای جابه‌جایی، لایه را بکشید</span>
      </div>
    </div>
  )
}
