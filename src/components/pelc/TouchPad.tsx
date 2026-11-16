"use client"

/**
 * تاچ‌پد لمسی جابه‌جایی — سطحِ کشیدنی، نه دکمه‌ای.
 *
 * انگشت (یا موس) را روی سطح بکشید؛ لایهٔ انتخاب‌شده — و در انتخاب چندگانه
 * همهٔ لایه‌های انتخاب‌شده — دقیقاً هم‌جهت با حرکت انگشت و به نسبت «سرعت»
 * جابه‌جا می‌شود. حرکت زنده است و در پایان کشیدن یک‌جا ثبت می‌شود؛ پس یک
 * واگرد کل حرکت را برمی‌گرداند.
 *
 * تاچ‌پد همیشه در گوشهٔ چپِ پایین بوم است و سرعت آن با لغزندهٔ کوچک زیر
 * سطح تنظیم می‌شود (۰٫۲۵ تا ۴ برابر) و در localStorage می‌ماند. نقطهٔ
 * طلایی داخل سطح جای انگشت را نشان می‌دهد و پس از رهاکردن با یک حرکت نرم
 * به مرکز برمی‌گردد. لرزش کوتاه (vibrate) بازخورد لمسی موبایل است.
 */

import { useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { Move } from "lucide-react"
import { cn } from "@/lib/utils"

/** کلید ذخیرهٔ سرعت در localStorage */
const SPEED_KEY = "pelc-touchpad-speed"
const MIN_SPEED = 0.25
const MAX_SPEED = 4
const SPEED_STEP = 0.25
/** آستانهٔ شروع حرکت واقعی (px) تا ضربه‌های تصادفی لایه را تکان ندهند */
const MOVE_THRESHOLD = 3

const clampSpeed = (v: number) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, v))

const fa = (n: number) => n.toLocaleString("fa-IR")

export function TouchPad() {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedCount = useEditorStore((s) => s.selectedLayerIds.length)
  const hasSelection = Boolean(selectedLayerId) || selectedCount > 0

  const surfaceRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    startX: number
    startY: number
    bases: { id: string; tx: number; ty: number }[]
    moved: boolean
  } | null>(null)

  const [speed, setSpeed] = useState(1)
  /** جای نقطهٔ نشانگر داخل سطح — پیش‌فرض مرکز */
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  /** مجموع جابه‌جایی زنده بر حسب واحد سند — برای نمایش عددی */
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const dragging = cursor !== null

  // بازیابی سرعت ذخیره‌شده — فقط سمت مرورگر، پس از هیدراسیون؛ با تیک تأخیر
  // تا setState همزمان با بدنهٔ اثر رندر آبشاری نسازد
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(SPEED_KEY)
        const v = raw ? Number.parseFloat(raw) : Number.NaN
        if (Number.isFinite(v)) setSpeed(clampSpeed(v))
      } catch {
        /* حافظه در دسترس نیست — سرعت پیش‌فرض می‌ماند */
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  const changeSpeed = (v: number) => {
    const next = clampSpeed(v)
    setSpeed(next)
    try {
      window.localStorage.setItem(SPEED_KEY, String(next))
    } catch {
      /* بی‌اهمیت */
    }
  }

  const cursorAt = (clientX: number, clientY: number) => {
    const r = surfaceRef.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 }
    return {
      x: Math.min(r.width - 5, Math.max(5, clientX - r.left)),
      y: Math.min(r.height - 5, Math.max(5, clientY - r.top)),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) return
    const st = useEditorStore.getState()
    const active = st.selectedLayerIds.length > 1 ? st.selectedLayerIds : st.selectedLayerId ? [st.selectedLayerId] : []
    if (active.length === 0) return
    const bases = st.doc.layers
      .filter((l) => active.includes(l.id) && !l.locked)
      .map((l) => ({ id: l.id, tx: l.transform.tx, ty: l.transform.ty }))
    if (bases.length === 0) return
    // گرفتن نشانگر تا کشیدن بیرون از سطح هم ادامه یابد (روی برخی مرورگرهای
    // آزمایشی ممکن است نباشد — در try می‌ماند)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* بدون گرفتن هم کشیدن داخل سطح کار می‌کند */
    }
    drag.current = { startX: e.clientX, startY: e.clientY, bases, moved: false }
    setCursor(cursorAt(e.clientX, e.clientY))
    setOffset({ x: 0, y: 0 })
    try {
      navigator.vibrate?.(10)
    } catch {
      /* مرورگر پشتیبانی نمی‌کند */
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    setCursor(cursorAt(e.clientX, e.clientY))
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > MOVE_THRESHOLD) d.moved = true
    if (!d.moved) return
    const st = useEditorStore.getState()
    const scale = st.viewScale || 1
    const dx = ((e.clientX - d.startX) / scale) * speed
    const dy = ((e.clientY - d.startY) / scale) * speed
    const baseById = new Map(d.bases.map((b) => [b.id, b]))
    const next = {
      ...st.doc,
      layers: st.doc.layers.map((l) => {
        const b = baseById.get(l.id)
        return b
          ? { ...l, transform: { ...l.transform, tx: Math.round(b.tx + dx), ty: Math.round(b.ty + dy) } }
          : l
      }),
    }
    st.beginLiveUpdate(next)
    setOffset({ x: Math.round(dx), y: Math.round(dy) })
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setCursor(null)
    setOffset(null)
    if (d?.moved) {
      useEditorStore
        .getState()
        .commitLiveUpdate(d.bases.length > 1 ? "جابه‌جایی گروهی با تاچ‌پد" : "جابه‌جایی لایه با تاچ‌پد")
      try {
        navigator.vibrate?.(6)
      } catch {
        /* بی‌اهمیت */
      }
    }
  }

  if (!hasSelection) return null

  return (
    <div
      dir="rtl"
      className="absolute bottom-3 left-3 z-20 w-[104px] touch-none select-none rounded-xl border border-primary/45 bg-card/85 p-1 shadow-lg backdrop-blur sm:w-[118px]"
      role="group"
      aria-label="تاچ‌پد لمسی جابه‌جایی لایه"
    >
      {/* سرستون — عنوان و بازخورد وضعیت */}
      <div className="mb-0.5 flex h-3.5 items-center justify-between px-0.5">
        <span className="text-[9px] font-bold leading-none text-foreground/90">تاچ‌پد</span>
        {selectedCount > 1 ? (
          <span className="rounded-full bg-accent px-1 py-0.5 text-[8px] font-bold leading-none text-accent-foreground shadow-sm">
            همه با هم
          </span>
        ) : offset && dragging ? (
          <span dir="ltr" className="text-[8px] leading-none tabular-nums text-muted-foreground">
            {fa(offset.x)} ، {fa(offset.y)}
          </span>
        ) : null}
      </div>

      {/* سطح لمسی — انگشت را بکشید */}
      <div
        ref={surfaceRef}
        className="pelc-pad-surface relative h-[56px] touch-none overflow-hidden rounded-lg border border-border/70 bg-black/25 transition-colors active:border-primary/70"
        aria-label="سطح لمسی جابه‌جایی — انگشت را روی سطح بکشید"
        title="انگشت را روی سطح بکشید — لایه هم‌جهت با انگشت جابه‌جا می‌شود"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* راهنمای مرکز — هنگام کشیدن پنهان می‌شود */}
        <Move
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-foreground/30 transition-opacity",
            dragging && "opacity-0",
          )}
          aria-hidden
        />
        {/* نقطهٔ طلایی نشانگر — جای انگشت را نشان می‌دهد و به مرکز برمی‌گردد */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_6px_rgba(217,182,74,0.85)]",
            dragging ? "transition-[left,top] duration-75" : "transition-[left,top] duration-300",
          )}
          style={cursor ? { left: cursor.x, top: cursor.y } : { left: "50%", top: "50%" }}
        />
      </div>

      {/* لغزندهٔ سرعت */}
      <div className="mt-0.5 flex items-center gap-1" dir="ltr">
        <span dir="rtl" className="shrink-0 text-[8px] font-medium leading-none text-muted-foreground">
          سرعت
        </span>
        <input
          type="range"
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={SPEED_STEP}
          value={speed}
          onChange={(e) => changeSpeed(Number.parseFloat(e.target.value))}
          aria-label="سرعت تاچ‌پد"
          title="سرعت جابه‌جایی — از ۰٫۲۵ تا ۴ برابر"
          className="pelc-speed h-1 min-w-0 flex-1 cursor-pointer"
        />
        <span className="w-8 shrink-0 text-center text-[9px] font-extrabold leading-none text-primary">
          ×{speed.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}
