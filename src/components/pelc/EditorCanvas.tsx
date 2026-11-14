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
 * دکمهٔ بیضی زرد «انتخاب همه» همهٔ لایه‌ها را انتخاب می‌کند تا با یک کشیدن
 * همه با هم جابه‌جا شوند؛ Esc یا کلیک روی فضای خالی بوم انتخاب را لغو می‌کند.
 * کشیدن لایه به‌صورت زنده (بدون تاریخچه) پیش‌نمایش می‌شود و در پایان یک‌جا
 * ثبت می‌گردد.
 */

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, findLayer } from "@/lib/pelc/model"
import { buildTextSegments } from "@/lib/pelc/segments"
import { tokenizeWords } from "@/lib/pelc/measure"
import { fontCssFamily, fontById } from "@/lib/pelc/fonts"
import { layerTextStyle } from "@/lib/pelc/export"
import { BoxSelect, SplitSquareHorizontal } from "lucide-react"
import { GroupScaleBar } from "@/components/pelc/GroupScaleBar"

const MIN_SCALE_FRACTION = 0.86 // بیشینهٔ عرض نسبی سند داخل مرحله

export function EditorCanvas() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const selectAllLayers = useEditorStore((s) => s.selectAllLayers)
  const clearMultiSelect = useEditorStore((s) => s.clearMultiSelect)
  const beginLiveUpdate = useEditorStore((s) => s.beginLiveUpdate)
  const commitLiveUpdate = useEditorStore((s) => s.commitLiveUpdate)
  const splitLayerIntoWords = useEditorStore((s) => s.splitLayerIntoWords)
  const nudgeSelectedLayer = useEditorStore((s) => s.nudgeSelectedLayer)
  const setViewScale = useEditorStore((s) => s.setViewScale)
  const viewScale = useEditorStore((s) => s.viewScale)

  const stageRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    grabbedId: string
    startX: number
    startY: number
    /** موقعیت پایهٔ همهٔ لایه‌هایی که با این کشیدن جابه‌جا می‌شوند (تکی یا گروهی) */
    bases: { id: string; tx: number; ty: number }[]
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
      // Esc = لغو انتخاب چندگانه
      if (e.key === "Escape") {
        if (useEditorStore.getState().selectedLayerIds.length > 0) {
          e.preventDefault()
          clearMultiSelect()
        }
        return
      }
      const step = e.shiftKey ? 10 : 1
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (!move) return
      const st = useEditorStore.getState()
      if (!st.selectedLayerId && st.selectedLayerIds.length === 0) return
      e.preventDefault()
      nudgeSelectedLayer(move[0], move[1])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nudgeSelectedLayer, clearMultiSelect])

  const onPointerDown = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      const layer = findLayer(doc, layerId)
      if (!layer || layer.locked) return
      e.currentTarget.setPointerCapture(e.pointerId)
      // اگر لایهٔ گرفته‌شده جزو انتخاب چندگانه است، همهٔ انتخاب‌شده‌ها با هم کشیده می‌شوند
      const multiIds = useEditorStore.getState().selectedLayerIds
      const groupMove = multiIds.length > 1 && multiIds.includes(layerId)
      const bases = groupMove
        ? doc.layers
            .filter((l) => multiIds.includes(l.id) && !l.locked)
            .map((l) => ({ id: l.id, tx: l.transform.tx, ty: l.transform.ty }))
        : [{ id: layerId, tx: layer.transform.tx, ty: layer.transform.ty }]
      dragState.current = {
        grabbedId: layerId,
        startX: e.clientX,
        startY: e.clientY,
        bases,
        moved: false,
      }
      if (!groupMove) selectLayer(layerId)
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
      const baseById = new Map(d.bases.map((b) => [b.id, b]))
      const updated = {
        ...doc,
        layers: doc.layers.map((l) => {
          const b = baseById.get(l.id)
          return b
            ? { ...l, transform: { ...l.transform, tx: Math.round(b.tx + dxDoc), ty: Math.round(b.ty + dyDoc) } }
            : l
        }),
      }
      beginLiveUpdate(updated)
    },
    [doc, beginLiveUpdate],
  )

  const onPointerUp = useCallback(() => {
    const d = dragState.current
    dragState.current = null
    if (d?.moved) commitLiveUpdate(d.bases.length > 1 ? "جابه‌جایی گروهی لایه‌ها" : "جابه‌جایی لایه")
  }, [commitLiveUpdate])

  const selectedLayer = findLayer(doc, selectedLayerId)
  const canSplit = Boolean(selectedLayer?.text && tokenizeWords(selectedLayer.text.text).length >= 2)

  const docW = doc.canvas.width * viewScale
  const docH = doc.canvas.height * viewScale

  return (
    <div ref={stageRef} className="pelc-stage relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`pelc-doc relative ${doc.background.transparent ? "pelc-checkerboard" : ""}`}
          onPointerDown={(e) => {
            // کلیک روی فضای خالی سند = لغو انتخاب چندگانه
            if (e.target === e.currentTarget && selectedLayerIds.length > 0) clearMultiSelect()
          }}
          style={{
            width: docW,
            height: docH,
            background: doc.background.transparent ? undefined : argbToCss(doc.background.color),
          }}
        >
          {doc.layers.map((layer) => {
            if (!layer.visible) return null
            const t = layer.text
            const selected = layer.id === selectedLayerId || selectedLayerIds.includes(layer.id)
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
          onClick={() => (selectedLayerIds.length > 0 ? clearMultiSelect() : selectAllLayers())}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold shadow-sm transition-colors ${
            selectedLayerIds.length > 0
              ? "border-yellow-600 bg-yellow-300 text-stone-900 hover:bg-yellow-200"
              : "border-yellow-600/60 bg-yellow-400 text-stone-900 hover:bg-yellow-300"
          }`}
          title="همهٔ لایه‌ها انتخاب می‌شوند تا با یک کشیدن همه با هم جابه‌جا شوند (Esc = لغو)"
        >
          <BoxSelect className="size-4" />
          {selectedLayerIds.length > 0
            ? `لغو انتخاب (${selectedLayerIds.length.toLocaleString("fa-IR")})`
            : "انتخاب همه"}
        </button>
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
      </div>

      {/* نوار مقیاس گروهی — فقط با انتخاب چندگانه ظاهر می‌شود */}
      <GroupScaleBar />

      {/* نوار وضعیت بوم */}
      <div
        className="pointer-events-none absolute bottom-2 start-2 rounded-md bg-black/45 px-2.5 py-1 text-[11px] text-amber-100/90"
        dir="rtl"
      >
        <span dir="ltr">
          {doc.canvas.width} × {doc.canvas.height} · {doc.canvas.dpi}dpi · {Math.round(viewScale * 100)}%
        </span>
        <span className="ms-2">
          {selectedLayerIds.length > 1
            ? `· ${selectedLayerIds.length.toLocaleString("fa-IR")} لایه انتخاب شد — همه با هم جابه‌جا می‌شوند`
            : "· لایه را بکشید یا با جهت‌نما تکان دهید"}
        </span>
      </div>
    </div>
  )
}
