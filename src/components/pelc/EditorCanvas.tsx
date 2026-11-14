"use client"

/**
 * بوم ویرایشگر پلک — معادل وب EditorCanvas.kt نسخهٔ اندروید.
 *
 * هر لایه یک عنصر DOM مستقل است؛ شکل‌دهی فارسی/عربی را موتور متن مرورگر
 * (خود HarfBuzz) انجام می‌دهد — پس اتصال حروف و جای علامت‌ها همیشه درست است.
 *
 * متن هر لایه به قطعه‌های هم‌سبک شکسته می‌شود تا «گونهٔ GSUB / قلم / فرمِ
 * تک‌حرف» واقعاً همان حرف را عوض کند نه کل جمله را.
 *
 * هر کلمهٔ جمله می‌تواند به لایهٔ مستقل تبدیل شود (دکمهٔ «تبدیل به کلماتِ
 * مستقل») و بعد هر کلمه جداگانه کشیده شود یا با جهت‌نماها تکان بخورد.
 * کشیدن لایه به‌صورت زنده (بدون تاریخچه) پیش‌نمایش می‌شود و در پایان یک‌جا
 * ثبت می‌گردد.
 */

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, findLayer } from "@/lib/pelc/model"
import { buildTextSegments } from "@/lib/pelc/segments"
import { tokenizeWords } from "@/lib/pelc/measure"
import { letterClusters } from "@/lib/pelc/arabicText"
import { fontCssFamily, fontById } from "@/lib/pelc/fonts"
import { layerTextStyle } from "@/lib/pelc/export"
import { Scissors, SplitSquareHorizontal } from "lucide-react"

const MIN_SCALE_FRACTION = 0.86 // بیشینهٔ عرض نسبی سند داخل مرحله

export function EditorCanvas() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const beginLiveUpdate = useEditorStore((s) => s.beginLiveUpdate)
  const commitLiveUpdate = useEditorStore((s) => s.commitLiveUpdate)
  const splitLayerIntoWords = useEditorStore((s) => s.splitLayerIntoWords)
  const splitLayerIntoSegments = useEditorStore((s) => s.splitLayerIntoSegments)
  const nudgeSelectedLayer = useEditorStore((s) => s.nudgeSelectedLayer)
  const setViewScale = useEditorStore((s) => s.setViewScale)
  const viewScale = useEditorStore((s) => s.viewScale)

  const stageRef = useRef<HTMLDivElement>(null)
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
      setViewScale(Math.max(s, 0.02))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc.canvas.width, doc.canvas.height, setViewScale])

  // تکان‌دادن با جهت‌نماها (Shift = ده برابر) — بیرون از فیلدهای متنی
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (!move) return
      if (!useEditorStore.getState().selectedLayerId) return
      e.preventDefault()
      nudgeSelectedLayer(move[0], move[1])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nudgeSelectedLayer])

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
      const scale = useEditorStore.getState().viewScale
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
    [doc, beginLiveUpdate],
  )

  const onPointerUp = useCallback(() => {
    const d = dragState.current
    dragState.current = null
    if (d?.moved) commitLiveUpdate("جابه‌جایی لایه")
  }, [commitLiveUpdate])

  const selectedLayer = findLayer(doc, selectedLayerId)
  const canSplit = Boolean(selectedLayer?.text && tokenizeWords(selectedLayer.text.text).length >= 2)
  const canSegment = Boolean(selectedLayer?.text && letterClusters(selectedLayer.text.text).length >= 2)

  const docW = doc.canvas.width * viewScale
  const docH = doc.canvas.height * viewScale

  return (
    <div ref={stageRef} className="pelc-stage relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
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
            const st = layer.style
            const gold = st.gold?.enabled === true

            // قطعه‌های هم‌سبک برای رندر به‌تفکیک حرف
            const segments = t
              ? buildTextSegments(t.text, t.perLetter, t.fontId, gold ? null : st.color)
              : []
            const baseStyle = layerTextStyle(layer, viewScale)
            const shadowCss = st.shadow
              ? `${(st.shadow.dx * viewScale) / 8}px ${(st.shadow.dy * viewScale) / 8}px ${(st.shadow.radius * viewScale) / 6}px ${argbToCss(st.shadow.color)}`
              : undefined

            return (
              <div
                key={layer.id}
                data-layer-id={layer.id}
                role="button"
                tabIndex={0}
                aria-label={`لایهٔ ${layer.name}`}
                className={`absolute left-0 top-0 select-none ${selected ? "pelc-layer-handle" : "pelc-layer-dim"}`}
                style={{
                  transform: `translate(${layer.transform.tx * viewScale}px, ${layer.transform.ty * viewScale}px)`,
                  opacity: layer.opacity,
                  ...baseStyle,
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
                {t &&
                  (segments.length === 1 && segments[0].tags.length === 0 && segments[0].fontId === t.fontId ? (
                    segments[0].text
                  ) : (
                    segments.map((seg, i) => {
                      const weight = seg.fontId === "amiri-bold" ? 700 : 400
                      const segStyle: React.CSSProperties = {
                        fontFamily: fontCssFamily(seg.fontId),
                        fontWeight: weight,
                      }
                      if (seg.tags.length > 0) {
                        segStyle.fontFeatureSettings = seg.tags.map((tag) => `"${tag}" 1`).join(", ")
                      }
                      if (seg.color !== null) {
                        segStyle.color = argbToCss(seg.color)
                      }
                      if (shadowCss) {
                        segStyle.textShadow = shadowCss
                      }
                      void fontById(seg.fontId) // اطمینان از قلم معتبر
                      return (
                        <span key={i} style={segStyle}>
                          {seg.text}
                        </span>
                      )
                    })
                  ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* نوار عمل بوم */}
      <div className="absolute start-2 top-2 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSplit}
          onClick={() => selectedLayerId && splitLayerIntoWords(selectedLayerId)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-black/45 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-sm transition-colors hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40"
          title="هر کلمه به یک لایهٔ مستقل تبدیل می‌شود تا جداگانه کشیده و تکان داده شود"
        >
          <SplitSquareHorizontal className="size-4" />
          تبدیل به کلماتِ مستقل
        </button>
        <button
          type="button"
          disabled={!canSegment}
          onClick={() => selectedLayerId && splitLayerIntoSegments(selectedLayerId)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-black/45 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-sm transition-colors hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40"
          title="هر حرف و کشیدهٔ واژه به یک بخشِ مستقل با همان فرم تبدیل می‌شود تا جداگانه تکان بخورد"
        >
          <Scissors className="size-4" />
          تبدیل به بخش‌های کوچک‌تر
        </button>
      </div>

      {/* نوار وضعیت بوم */}
      <div
        className="pointer-events-none absolute bottom-2 start-2 rounded-md bg-black/45 px-2.5 py-1 text-[11px] text-amber-100/90"
        dir="rtl"
      >
        <span dir="ltr">
          {doc.canvas.width} × {doc.canvas.height} · {doc.canvas.dpi}dpi · {Math.round(viewScale * 100)}%
        </span>
        <span className="ms-2">· لایه را بکشید یا با جهت‌نما تکان دهید</span>
      </div>
    </div>
  )
}
