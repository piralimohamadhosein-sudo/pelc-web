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
 * هر کلمهٔ جمله می‌تواند به لایهٔ مستقل تبدیل شود و بعد هر کلمه جداگانه کشیده
 * شود یا با جهت‌نماها تکان بخورد. دکمهٔ بیضی زرد «انتخاب همه» همهٔ لایه‌ها را
 * انتخاب می‌کند تا با یک کشیدن همه با هم جابه‌جا شوند؛ Esc یا کلیک روی فضای
 * خالی بوم انتخاب را لغو می‌کند. کشیدن لایه به‌صورت زنده (بدون تاریخچه)
 * پیش‌نمایش می‌شود و در پایان یک‌جا ثبت می‌گردد.
 *
 * متن با رابط تازه فقط از دو راه می‌آید: دکمهٔ طلایی «+» گوشهٔ پایین بوم
 * (افزودن متن نو) و دوبارزدن روی لایه (ویرایش متن همان لایه) — هر دو
 * گفت‌وگوی کوچک متن را باز می‌کنند.
 */

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, findLayer } from "@/lib/pelc/model"
import { buildTextSegments } from "@/lib/pelc/segments"
import { tokenizeWords } from "@/lib/pelc/measure"
import { fontCssFamily, fontById } from "@/lib/pelc/fonts"
import { layerTextStyle } from "@/lib/pelc/export"
import { BoxSelect, Plus, Trash2 } from "lucide-react"
import { GroupScaleBar } from "@/components/pelc/GroupScaleBar"
import { TouchPad } from "@/components/pelc/TouchPad"
import { AddTextDialog } from "@/components/pelc/AddTextDialog"
import { BackgroundPicker } from "@/components/pelc/BackgroundPicker"
import { getImageAsset } from "@/lib/pelc/images"

const MIN_SCALE_FRACTION = 0.86 // بیشینهٔ عرض نسبی سند داخل مرحله

/** گوشه‌های لایهٔ عکس برای دستگیرهٔ بزرگ/کوچک‌کردن */
const CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
]

export function EditorCanvas() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const selectAllLayers = useEditorStore((s) => s.selectAllLayers)
  const clearMultiSelect = useEditorStore((s) => s.clearMultiSelect)
  const openTextDialog = useEditorStore((s) => s.openTextDialog)
  const beginLiveUpdate = useEditorStore((s) => s.beginLiveUpdate)
  const commitLiveUpdate = useEditorStore((s) => s.commitLiveUpdate)
  const nudgeSelectedLayer = useEditorStore((s) => s.nudgeSelectedLayer)
  const setViewScale = useEditorStore((s) => s.setViewScale)
  const viewScale = useEditorStore((s) => s.viewScale)
  const deleteLayer = useEditorStore((s) => s.deleteLayer)

  const stageRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    grabbedId: string
    startX: number
    startY: number
    /** موقعیت پایهٔ همهٔ لایه‌هایی که با این کشیدن جابه‌جا می‌شوند (تکی یا گروهی) */
    bases: { id: string; tx: number; ty: number }[]
    moved: boolean
  } | null>(null)
  /** وضعیت بزرگ/کوچک‌کردن عکس با دستگیرهٔ گوشه — مرکز ثابت، مقیاس یکنواخت */
  const scaleState = useRef<{
    id: string
    cxScreen: number
    cyScreen: number
    cxDoc: number
    cyDoc: number
    startDist: number
    base: number
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

  // جداسازی خودکار جملهٔ پیش‌فرض در نخستین اجرای سندِ دست‌نخورده — پس از
  // آماده‌شدن فونت‌ها تا اندازه‌گیری جای کلمه‌ها دقیق باشد. اگر کاربر قبلاً
  // کاری کرده باشد (تاریخچه غیرخالی)، دخالت نمی‌کند.
  useEffect(() => {
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      const st = useEditorStore.getState()
      if (st.canUndo || st.canRedo) return
      const first = st.doc.layers[0]
      if (!first?.text || first.locked) return
      if (tokenizeWords(first.text.text).length < 2) return
      st.splitLayerIntoWords(first.id, { auto: true })
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      if (!move) {
        // Delete/Backspace = حذف لایهٔ عکس انتخاب‌شده (برای لایهٔ متن فعال نیست)
        if (e.key === "Delete" || e.key === "Backspace") {
          const st2 = useEditorStore.getState()
          const sel = findLayer(st2.doc, st2.selectedLayerId)
          if (sel?.kind === "IMAGE") {
            e.preventDefault()
            st2.deleteLayer(sel.id)
          }
        }
        return
      }
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

  /* --- بزرگ/کوچک‌کردن عکس با دستگیرهٔ گوشه (فقط مقیاس، بدون چرخش/برش) --- */

  const startImageScale = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      e.stopPropagation()
      e.preventDefault()
      const st = useEditorStore.getState()
      const layer = findLayer(st.doc, layerId)
      if (!layer?.image || layer.locked) return
      const box = (e.currentTarget as HTMLElement).closest("[data-layer-id]") as HTMLElement | null
      if (!box) return
      const rect = box.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      scaleState.current = {
        id: layerId,
        cxScreen: cx,
        cyScreen: cy,
        cxDoc: layer.transform.tx + (layer.image.width * layer.transform.scaleX) / 2,
        cyDoc: layer.transform.ty + (layer.image.height * layer.transform.scaleY) / 2,
        startDist: Math.max(4, Math.hypot(e.clientX - cx, e.clientY - cy)),
        base: layer.transform.scaleX,
      }
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* بدون گرفتن هم کشیدن داخل دستگیره کار می‌کند */
      }
    },
    [],
  )

  const onImageScaleMove = useCallback((e: React.PointerEvent) => {
    const s = scaleState.current
    if (!s) return
    const dist = Math.max(4, Math.hypot(e.clientX - s.cxScreen, e.clientY - s.cyScreen))
    const next = Math.min(40, Math.max(0.02, s.base * (dist / s.startDist)))
    const st = useEditorStore.getState()
    const layer = findLayer(st.doc, s.id)
    if (!layer?.image) return
    const wDoc = layer.image.width * next
    const hDoc = layer.image.height * next
    const nextDoc = {
      ...st.doc,
      layers: st.doc.layers.map((l) =>
        l.id === s.id
          ? {
              ...l,
              transform: {
                ...l.transform,
                scaleX: next,
                scaleY: next,
                tx: Math.round(s.cxDoc - wDoc / 2),
                ty: Math.round(s.cyDoc - hDoc / 2),
              },
            }
          : l,
      ),
    }
    st.beginLiveUpdate(nextDoc)
  }, [])

  const onImageScaleUp = useCallback(() => {
    const s = scaleState.current
    scaleState.current = null
    if (s) useEditorStore.getState().commitLiveUpdate("تغییر اندازهٔ عکس")
  }, [])

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
            const selected = layer.id === selectedLayerId || selectedLayerIds.includes(layer.id)

            /* --- لایهٔ عکس (عکس‌نوشته) — فقط جابه‌جایی و بزرگ/کوچک‌کردن --- */
            if (layer.kind === "IMAGE" && layer.image) {
              const asset = getImageAsset(layer.image.assetId)
              if (!asset) return null
              const w = layer.image.width * layer.transform.scaleX * viewScale
              const h = layer.image.height * layer.transform.scaleY * viewScale
              return (
                <div
                  key={layer.id}
                  data-layer-id={layer.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`لایهٔ عکس ${layer.name}`}
                  className={`absolute left-0 top-0 select-none ${selected ? "pelc-layer-handle" : "pelc-layer-dim"}`}
                  style={{
                    transform: `translate(${layer.transform.tx * viewScale}px, ${layer.transform.ty * viewScale}px)`,
                    opacity: layer.opacity,
                    width: w,
                    height: h,
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
                  <img
                    src={asset.src}
                    alt=""
                    draggable={false}
                    className="pointer-events-none block h-full w-full"
                  />
                  {selected &&
                    CORNERS.map((c, i) => (
                      <span
                        key={i}
                        className="absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none rounded-full border-2 border-[#2a1f06] bg-[#e4c35c] shadow-md"
                        style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                        title="بکشید — عکس بزرگ/کوچک می‌شود"
                        aria-label="دستگیرهٔ تغییر اندازهٔ عکس"
                        role="slider"
                        aria-valuemin={2}
                        aria-valuemax={4000}
                        aria-valuenow={Math.round(layer.transform.scaleX * 100)}
                        onPointerDown={(e) => startImageScale(e, layer.id)}
                        onPointerMove={onImageScaleMove}
                        onPointerUp={onImageScaleUp}
                        onPointerCancel={onImageScaleUp}
                      />
                    ))}
                </div>
              )
            }

            const t = layer.text
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
                // دوبارزدن/دوبارکلیک = ویرایش متن همین لایه در گفت‌وگوی متن
                onDoubleClick={() => openTextDialog(layer.id)}
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

      {/* نوار عمل بوم — انتخاب همه + پس‌زمینهٔ سند */}
      <div className="absolute start-2 top-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => (selectedLayerIds.length > 0 ? clearMultiSelect() : selectAllLayers())}
          className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold shadow-sm transition-colors ${
            selectedLayerIds.length > 0
              ? "border-accent bg-accent text-accent-foreground hover:bg-accent/85"
              : "border-primary/70 bg-primary text-primary-foreground hover:bg-primary/85"
          }`}
          title="همهٔ لایه‌ها انتخاب می‌شوند؛ جابه‌جایی، مقیاس، رنگ، قلم و حالت پرکردن با یک عمل روی همه اعمال می‌شود (Esc = لغو)"
        >
          <BoxSelect className="size-4" />
          {selectedLayerIds.length > 0
            ? `لغو انتخاب (${selectedLayerIds.length.toLocaleString("fa-IR")})`
            : "انتخاب همه"}
        </button>
        <BackgroundPicker />
        {/* حذف عکس — فقط وقتی لایهٔ عکس انتخاب شده باشد */}
        {(() => {
          const sel = findLayer(doc, selectedLayerId)
          if (sel?.kind !== "IMAGE") return null
          return (
            <button
              type="button"
              aria-label="حذف عکس"
              title="حذف عکس (Delete) — یک واگرد برمی‌گرداند"
              onClick={() => deleteLayer(sel.id)}
              className="grid size-9 place-items-center rounded-full border border-destructive/40 bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-destructive/15"
            >
              <Trash2 className="size-4 text-destructive" />
            </button>
          )
        })()}
      </div>

      {/* دکمهٔ «+» افزودن متن — تنها راه افزودن متن در رابط تازه */}
      <button
        type="button"
        onClick={() => openTextDialog(null)}
        aria-label="افزودن متن"
        title="افزودن متن — بنویسید و کلمه‌ها خودکار جدا می‌شوند"
        className="absolute bottom-3 start-3 z-20 grid size-12 touch-manipulation place-items-center rounded-full bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-lg ring-1 ring-[#8a6d1f]/60 transition-transform active:scale-90"
      >
        <Plus className="size-6" strokeWidth={2.5} aria-hidden />
      </button>

      {/* گفت‌وگوی افزودن/ویرایش متن */}
      <AddTextDialog />

      {/* نوار مقیاس گروهی — فقط با انتخاب چندگانه ظاهر می‌شود */}
      <GroupScaleBar />

      {/* تاچ‌پد جابه‌جایی — با انتخاب هر لایه ظاهر می‌شود (مخصوص موبایل) */}
      <TouchPad />

      {/* نوار وضعیت بوم — در موبایل مخفی برای جمع‌وجوری؛ جای آن از دکمهٔ «+» فاصله دارد */}
      <div
        className="pointer-events-none absolute bottom-2 start-[68px] hidden rounded-md border border-border/50 bg-card/80 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-sm sm:block"
        dir="rtl"
      >
        <span dir="ltr">
          {doc.canvas.width} × {doc.canvas.height} · {doc.canvas.dpi}dpi · {Math.round(viewScale * 100)}%
        </span>
        <span className="ms-2">
          {selectedLayerIds.length > 1
            ? `· ${selectedLayerIds.length.toLocaleString("fa-IR")} لایه انتخاب شد — رنگ، قلم، پرکردن و جابه‌جایی روی همه اعمال می‌شود`
            : "· لایه را بکشید یا با تاچ‌پد جابه‌جا کنید"}
        </span>
      </div>
    </div>
  )
}
