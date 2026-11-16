"use client"

/**
 * تاچ‌پد جابه‌جایی — چهارجهتهٔ کوچکِ مخصوص موبایل.
 *
 * با انتخاب هر لایه (تکی یا گروهی) پایین-چپ بوم ظاهر می‌شود؛ ضربه = یک گام
 * کوچک و نگه‌داشتن = حرکت پیوسته. دکمهٔ مرکزی بین گامِ ریز (۲ واحد) و درشت
 * (۱۲ واحد) عوض می‌شود. لرزش کوتاه (vibrate) بازخورد لمسی می‌دهد و چون
 * نudge از طریق store ثبت می‌شود، تکان‌های پیوسته در تاریخچه یک‌جا ادغام
 * می‌شوند — یک واگرد کل حرکت را برمی‌گرداند.
 */

import { useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const FINE_STEP = 2
const COARSE_STEP = 12
/** تأخیر پیش از شروع حرکت پیوسته و فاصلهٔ تکرار */
const REPEAT_DELAY = 280
const REPEAT_INTERVAL = 90

export function TouchPad() {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedCount = useEditorStore((s) => s.selectedLayerIds.length)
  const [coarse, setCoarse] = useState(false)
  const timers = useRef<{ delay?: number; interval?: number }>({})
  const step = coarse ? COARSE_STEP : FINE_STEP
  const hasSelection = Boolean(selectedLayerId) || selectedCount > 0

  // پاک‌سازی تایمرها هنگامUnmount تا حرکت پیوسته بی‌وقفه نماند
  useEffect(() => {
    return () => {
      if (timers.current.delay !== undefined) window.clearTimeout(timers.current.delay)
      if (timers.current.interval !== undefined) window.clearInterval(timers.current.interval)
      timers.current = {}
    }
  }, [])

  const stopRepeat = () => {
    if (timers.current.delay !== undefined) window.clearTimeout(timers.current.delay)
    if (timers.current.interval !== undefined) window.clearInterval(timers.current.interval)
    timers.current = {}
  }

  const startRepeat = (dx: number, dy: number) => {
    useEditorStore.getState().nudgeSelectedLayer(dx, dy)
    // بازخورد لمسی کوتاه روی موبایل (روی دسکتاپ بی‌اثر است)
    try {
      navigator.vibrate?.(8)
    } catch {
      /* مرورگر پشتیبانی نمی‌کند */
    }
    stopRepeat()
    timers.current.delay = window.setTimeout(() => {
      timers.current.interval = window.setInterval(() => {
        useEditorStore.getState().nudgeSelectedLayer(dx, dy)
      }, REPEAT_INTERVAL)
    }, REPEAT_DELAY)
  }

  if (!hasSelection) return null

  const nudgeBtn = (
    dx: number,
    dy: number,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={`${label} — نگه دارید تا پیوسته حرکت کند`}
      className="grid size-9 touch-none select-none place-items-center rounded-lg bg-secondary text-foreground shadow-sm transition-colors active:bg-accent active:text-accent-foreground sm:size-10"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        startRepeat(dx, dy)
      }}
      onPointerUp={stopRepeat}
      onPointerCancel={stopRepeat}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
    </button>
  )

  return (
    <div
      dir="rtl"
      className="absolute bottom-2 start-2 z-20 flex flex-col items-center gap-1 sm:bottom-3 sm:start-auto sm:end-3"
    >
      {selectedCount > 1 && (
        <span
          className="-top-2 absolute start-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground shadow-sm sm:-top-2.5"
          dir="rtl"
        >
          همه با هم
        </span>
      )}
      <div
        dir="ltr"
        role="group"
        aria-label="تاچ‌پد جابه‌جایی لایه"
        className="grid touch-none grid-cols-3 grid-rows-3 gap-0.5 rounded-2xl border border-primary/45 bg-card/90 p-1 shadow-lg backdrop-blur sm:gap-1 sm:p-1.5"
      >
        <span />
        {nudgeBtn(0, -step, "جابه‌جایی به بالا", <ArrowUp className="size-4" />)}
        <span />
        {nudgeBtn(-step, 0, "جابه‌جایی به چپ", <ArrowLeft className="size-4" />)}
        <button
          type="button"
          aria-label="تغییر اندازهٔ گام: ریز یا درشت"
          aria-pressed={coarse}
          title="اندازهٔ گام — ریز (۲) یا درشت (۱۲)"
          className={cn(
            "grid size-9 place-items-center rounded-lg shadow-sm transition-colors sm:size-10",
            coarse ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
          )}
          onClick={() => setCoarse((v) => !v)}
        >
          <span className="text-xs font-extrabold leading-none">
            {step.toLocaleString("fa-IR")}
          </span>
        </button>
        {nudgeBtn(step, 0, "جابه‌جایی به راست", <ArrowRight className="size-4" />)}
        <span />
        {nudgeBtn(0, step, "جابه‌جایی به پایین", <ArrowDown className="size-4" />)}
        <span />
      </div>
      <span className="hidden rounded-full border border-border/60 bg-card/85 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm sm:block">
        تاچ‌پد جابه‌جایی
      </span>
    </div>
  )
}
