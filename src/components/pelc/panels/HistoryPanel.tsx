"use client"

/** تب «تاریخچه» — واگرد/ازنو، فهرست گام‌ها با پرش، آزمون ۵۰۰ گام */

import { useEditorStore } from "@/lib/pelc/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Undo2, Redo2, FlaskConical, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export function HistoryPanel() {
  const labels = useEditorStore((s) => s.labels)
  const position = useEditorStore((s) => s.position)
  const stepCount = useEditorStore((s) => s.stepCount)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const jumpTo = useEditorStore((s) => s.jumpTo)
  const runStressTest = useEditorStore((s) => s.runStressTest)
  const stressResult = useEditorStore((s) => s.stressResult)
  const resetDocument = useEditorStore((s) => s.resetDocument)

  // فهرست از جدید به قدیم؛ اندیس تاریخچه = stepCount - idx (که در labels قدیم→جدید است)
  const rows = labels.map((label, i) => ({ label, index: i })).reverse()

  return (
    <div className="space-y-4">
      <section className="flex items-center gap-2">
        <Button onClick={undo} disabled={!canUndo} variant="outline" className="flex-1" aria-label="واگرد">
          <Undo2 className="size-4" /> واگرد
        </Button>
        <Button onClick={redo} disabled={!canRedo} variant="outline" className="flex-1" aria-label="ازنو">
          <Redo2 className="size-4" /> ازنو
        </Button>
      </section>

      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="text-muted-foreground">موقعیت در تاریخچه</span>
        <Badge variant="secondary" dir="ltr">
          {position} / {stepCount}
        </Badge>
      </div>

      <section className="space-y-1.5">
        <p className="text-sm font-semibold">گام‌ها (برای پرش کلیک کنید)</p>
        <div className="pelc-scroll max-h-64 overflow-y-auto rounded-lg border bg-card">
          <ul className="divide-y">
            <li>
              <button
                type="button"
                onClick={() => jumpTo(-1)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent/50",
                  position === 0 && "bg-accent text-accent-foreground",
                )}
              >
                <span>حالت آغازین سند</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  0
                </span>
              </button>
            </li>
            {rows.map((r) => (
              <li key={r.index}>
                <button
                  type="button"
                  onClick={() => jumpTo(r.index + 1)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent/50",
                    position === r.index + 1 && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="truncate">{r.label}</span>
                  <span className="ms-2 shrink-0 text-xs text-muted-foreground" dir="ltr">
                    {r.index + 1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">آزمون پذیرش ۵۰۰ گام</p>
          <Button size="sm" variant="outline" onClick={runStressTest}>
            <FlaskConical className="size-4" /> اجرا
          </Button>
        </div>
        {stressResult && <p className="text-xs leading-5 text-muted-foreground">{stressResult}</p>}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">شروع از نو (سند پیش‌فرض + تاریخچهٔ تازه)</p>
          <Button size="sm" variant="ghost" onClick={resetDocument}>
            <RotateCcw className="size-4" /> بازنشانی
          </Button>
        </div>
      </section>
    </div>
  )
}
