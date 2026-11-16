"use client"

/**
 * اندازهٔ بوم (صفحهٔ کار) — پاپ‌اُور کوچک کنار پس‌زمینه روی نوار بالای بوم:
 * چند اندازهٔ آماده (A4 عمودی/افقی، مربع، استوری، A5)، ورودی سفارشی
 * عرض/ارتفاع پیکسل، مبادلهٔ جهت و انتخاب dpi. تغییر اندازه در یک گام
 * تاریخچه ثبت می‌شود و لایه‌ها سر جای خود می‌مانند.
 */

import { useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeftRight, Frame, Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** اندازه‌های آماده — عرض×ارتفاع پیکسل با dpi */
const PRESETS: { label: string; w: number; h: number; dpi: number }[] = [
  { label: "A4 عمودی", w: 2480, h: 3508, dpi: 300 },
  { label: "A4 افقی", w: 3508, h: 2480, dpi: 300 },
  { label: "مربع ۱۰۸۰", w: 1080, h: 1080, dpi: 300 },
  { label: "استوری", w: 1080, h: 1920, dpi: 300 },
  { label: "A5 عمودی", w: 1748, h: 2480, dpi: 300 },
]

const DPI_OPTIONS = [72, 150, 300]

const MIN_DIM = 100
const MAX_DIM = 8000

export function CanvasSizePicker() {
  const doc = useEditorStore((s) => s.doc)
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize)

  const [open, setOpen] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)
  const [draftW, setDraftW] = useState(String(doc.canvas.width))
  const [draftH, setDraftH] = useState(String(doc.canvas.height))
  const [draftDpi, setDraftDpi] = useState(doc.canvas.dpi)

  // هم‌گام‌سازی پیش‌نویس با سند — الگوی تنظیم هنگام رندر (بدون useEffect)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraftW(String(doc.canvas.width))
      setDraftH(String(doc.canvas.height))
      setDraftDpi(doc.canvas.dpi)
    }
  }

  const apply = () => {
    const w = parseInt(draftW, 10)
    const h = parseInt(draftH, 10)
    if (!Number.isFinite(w) || !Number.isFinite(h)) return
    setCanvasSize(w, h, draftDpi)
    setOpen(false)
  }

  /** اندازهٔ آماده — بلافاصله روی بوم اعمال می‌شود تا رنگ انتخاب و ابعاد بوم همان لحظه عوض شود */
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setCanvasSize(p.w, p.h, p.dpi)
    setDraftW(String(p.w))
    setDraftH(String(p.h))
    setDraftDpi(p.dpi)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="اندازهٔ بوم"
        title={`اندازهٔ بوم — ${doc.canvas.width} × ${doc.canvas.height} پیکسل · ${doc.canvas.dpi}dpi`}
        className="grid size-9 place-items-center rounded-full border border-primary/50 bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-accent/60"
      >
        <Frame className="size-4 text-primary" />
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="start" className="w-60 space-y-2.5 p-3">
        <p className="text-xs font-semibold">اندازهٔ بوم (صفحهٔ کار)</p>

        {/* اندازه‌های آماده */}
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => {
            const active = doc.canvas.width === p.w && doc.canvas.height === p.h
            return (
              <button
                key={p.label}
                type="button"
                title={`${p.w} × ${p.h} · ${p.dpi}dpi`}
                onClick={() => applyPreset(p)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card hover:bg-accent/40",
                )}
              >
                {active && <Check className="size-3" aria-hidden />}
                {p.label}
              </button>
            )
          })}
        </div>

        {/* ابعاد سفارشی */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="canvas-w" className="text-[11px] text-muted-foreground">
              عرض (px)
            </Label>
            <Input
              id="canvas-w"
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={draftW}
              onChange={(e) => setDraftW(e.target.value)}
              className="h-8 text-xs"
              dir="ltr"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="canvas-h" className="text-[11px] text-muted-foreground">
              ارتفاع (px)
            </Label>
            <Input
              id="canvas-h"
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={draftH}
              onChange={(e) => setDraftH(e.target.value)}
              className="h-8 text-xs"
              dir="ltr"
            />
          </div>
          <button
            type="button"
            aria-label="مبادلهٔ عرض و ارتفاع"
            title="مبادلهٔ عرض و ارتفاع"
            onClick={() => {
              const w = draftW
              setDraftW(draftH)
              setDraftH(w)
            }}
            className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent/40"
          >
            <ArrowLeftRight className="size-3.5" />
          </button>
        </div>

        {/* dpi */}
        <div className="flex items-center gap-1.5">
          <Label className="text-[11px] text-muted-foreground">تراکم چاپ:</Label>
          <div className="flex gap-1">
            {DPI_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-label={`${d} نقطه در اینچ`}
                onClick={() => setDraftDpi(d)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  draftDpi === d
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/40",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" className="h-8 w-full text-xs" onClick={apply}>
          <Check className="size-3.5" /> اعمال اندازه
        </Button>

        <p className="text-center text-[10px] text-muted-foreground" dir="ltr">
          {doc.canvas.width} × {doc.canvas.height} · {doc.canvas.dpi}dpi
        </p>
      </PopoverContent>
    </Popover>
  )
}
