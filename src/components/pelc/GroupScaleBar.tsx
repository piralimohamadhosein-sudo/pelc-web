"use client"

/**
 * نوار مقیاس گروهی — هم‌زمان با «انتخاب همه» (انتخاب چندگانه) ظاهر می‌شود.
 *
 * کشیدن دستگیره به بالا همهٔ لایه‌های انتخاب‌شده را بزرگ و به پایین کوچک
 * می‌کند. ضریبِ «یکسان» روی اندازهٔ قلم همهٔ لایه‌ها اعمال می‌شود، پس نسبت
 * اندازه‌هایی که از قبل برای هر کلمه تنظیم شده بود دقیقاً حفظ می‌ماند
 * (مثلاً واژه‌ای با ۱۶۰ و واژه‌ای با ۱۲۰، در هر ضریبی همان نسبت ۴:۳ را
 * دارند). برای لایه‌های بی‌متن ضریب روی مقیاس تبدیل اعمال می‌شود.
 *
 * رابط «لحظه‌ای» است: دستگیره همیشه به مرکز (۱۰۰٪) برمی‌گردد و هر کشیدن
 * نسبت به وضعیتِ لحظهٔ گرفتن دستگیره محاسبه می‌شود. پیش‌نمایش زنده است و در
 * پایان کشیدن، یک‌جا در تاریخچه ثبت می‌شود — یک واگرد کل گروه را برمی‌گرداند.
 */

import { useCallback, useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"

/** بیشینهٔ ضریب؛ کمینه به‌صورت خودکار ۱/بیشینه می‌شود (بازهٔ متقارن) */
const MAX_FACTOR = 2.8
/** ارتفاع نوار بر حسب پیکسل */
const TRACK_H = 150

/** موقعیت پایهٔ هر لایه هنگام گرفتن دستگیره */
interface ScaleBase {
  fontSize: number
  sx: number
  sy: number
}

export function GroupScaleBar() {
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; bases: Map<string, ScaleBase> } | null>(null)
  /** جای دستگیره برای نمایش — ۰ = بالای نوار، ۱ = پایین نوار */
  const [handleT, setHandleT] = useState(0.5)
  /** ضریب زندهٔ حین کشیدن؛ null = در حال کشیدن نیستیم */
  const [liveFactor, setLiveFactor] = useState<number | null>(null)

  /** نگاشت متقارن: بالای نوار = MAX، وسط = ۱۰۰٪، پایین = ۱/MAX */
  const factorAt = (t: number) => Math.pow(MAX_FACTOR, 1 - 2 * t)

  const yToT = useCallback((clientY: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.height <= 0) return 0.5
    const frac = (clientY - rect.top) / rect.height
    return Math.min(1, Math.max(0, frac))
  }, [])

  /** اعمال زندهٔ ضریب روی همهٔ لایه‌های پایه‌گرفته‌شده (بدون تاریخچه) */
  const applyFactor = useCallback((bases: Map<string, ScaleBase>, factor: number) => {
    const st = useEditorStore.getState()
    const next = {
      ...st.doc,
      layers: st.doc.layers.map((l) => {
        const b = bases.get(l.id)
        if (!b) return l
        if (!l.text) {
          // لایهٔ بی‌متن: مقیاس تبدیل
          return { ...l, transform: { ...l.transform, scaleX: b.sx * factor, scaleY: b.sy * factor } }
        }
        // لایهٔ متنی: اندازهٔ قلم — ضریب یکسان = حفظ تناسب نسبی
        return {
          ...l,
          text: { ...l.text, fontSize: Math.max(8, Math.round(b.fontSize * factor)) },
        }
      }),
    }
    st.beginLiveUpdate(next)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = useEditorStore.getState()
      const ids = st.selectedLayerIds
      if (ids.length < 2) return
      const bases = new Map<string, ScaleBase>()
      for (const l of st.doc.layers) {
        if (!ids.includes(l.id) || l.locked) continue
        bases.set(l.id, {
          fontSize: l.text?.fontSize ?? 0,
          sx: l.transform.scaleX,
          sy: l.transform.scaleY,
        })
      }
      if (bases.size === 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = { startY: e.clientY, bases }
      const t = yToT(e.clientY)
      setHandleT(t)
      setLiveFactor(factorAt(t))
      // توجه: هنوز چیزی به سند اعمال نمی‌شود؛ اولین حرکت واقعی اعمال می‌کند
    },
    [yToT],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current
      if (!d) return
      const t = yToT(e.clientY)
      setHandleT(t)
      const f = factorAt(t)
      setLiveFactor(f)
      applyFactor(d.bases, f)
    },
    [applyFactor, yToT],
  )

  const onPointerUp = useCallback(() => {
    dragRef.current = null
    setHandleT(0.5)
    setLiveFactor(null)
    // اگر حرکتی شده باشد liveDoc مقدار دارد و یک‌جا ثبت می‌شود؛ وگرنه بی‌اثر است
    useEditorStore.getState().commitLiveUpdate("بزرگ/کوچک‌کردن گروهی لایه‌ها")
  }, [])

  if (selectedLayerIds.length < 2) return null

  const percent = liveFactor === null ? 100 : Math.round(liveFactor * 100)

  return (
    <div className="absolute end-3 top-2 z-20 flex flex-col items-center gap-1.5">
      <div
        dir="ltr"
        aria-live="polite"
        className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm"
      >
        {percent.toLocaleString("fa-IR")}٪
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="مقیاس گروهی لایه‌های انتخاب‌شده"
        aria-valuemin={Math.round((1 / MAX_FACTOR) * 100)}
        aria-valuemax={Math.round(MAX_FACTOR * 100)}
        aria-valuenow={percent}
        title="بکشید به بالا = بزرگ‌تر، به پایین = کوچک‌تر — تناسب اندازهٔ همهٔ لایه‌ها حفظ می‌شود"
        className="relative w-3 touch-none rounded-full border border-primary/45 bg-black/40 shadow-sm"
        style={{ height: TRACK_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* نشانهٔ مرکز = ۱۰۰٪ */}
        <div className="absolute left-1/2 top-1/2 h-px w-2 -translate-x-1/2 -translate-y-1/2 bg-primary/70" />
        {/* دستگیره */}
        <div
          className="absolute left-1/2 h-4 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md ring-1 ring-[#8a6d1f]/70"
          style={{ top: handleT * TRACK_H }}
        />
      </div>
      <span className="text-center text-[9px] leading-3 text-muted-foreground">
        مقیاس
        <br />
        گروهی
      </span>
    </div>
  )
}
