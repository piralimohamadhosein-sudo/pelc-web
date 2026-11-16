"use client"

/** تب «علامت‌ها» — افزودن اِعراب/علامت‌ها روی حرف انتخابی و مدیریت آن‌ها */

import { useEditorStore } from "@/lib/pelc/store"
import { letterClusters } from "@/lib/pelc/arabicText"
import { findLayer, MARK_ORDER, MARK_TYPES, type MarkType } from "@/lib/pelc/model"
import { ClusterChips } from "./ClusterChips"
import { EmptyTextState, hasNoTextLayers } from "./EmptyTextState"
import { Button } from "@/components/ui/button"
import { X, Info } from "lucide-react"

export function MarksPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedClusterStart = useEditorStore((s) => s.selectedClusterStart)
  const addMark = useEditorStore((s) => s.addMark)
  const removeMark = useEditorStore((s) => s.removeMark)

  const layer = findLayer(doc, selectedLayerId)

  // سند هنوز هیچ متنی ندارد → دکمهٔ زرد شروع
  const emptyDoc = useEditorStore((s) => hasNoTextLayers(s.doc))
  if (emptyDoc) return <EmptyTextState />

  const text = layer?.text?.text ?? ""
  const clusters = letterClusters(text)
  const selected = clusters.find((c) => c.start === selectedClusterStart) ?? null

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <p className="text-sm font-semibold">۱. حرف را انتخاب کنید</p>
        <ClusterChips />
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">۲. افزودن علامت</p>
        {selectedClusterStart === null ? (
          <p className="text-sm text-muted-foreground">اول یک حرف انتخاب کنید.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {MARK_ORDER.map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => addMark(mt as MarkType)}
                className="flex flex-col items-center gap-0.5 rounded-lg border bg-card px-1 py-2 hover:bg-accent/60"
                title={MARK_TYPES[mt].title}
              >
                <span className="text-base leading-6">{MARK_TYPES[mt].char}</span>
                <span className="text-[10px] text-muted-foreground">{MARK_TYPES[mt].title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">۳. علامت‌های حرف انتخابی</p>
        {selected && selected.marks.length > 0 ? (
          <ul className="space-y-1.5">
            {selected.marks.map((m, i) => (
              <li
                key={`${i}-${m}`}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-base">{m}</span>
                  <span className="ms-2 text-muted-foreground">
                    {MARK_ORDER.find((mt) => MARK_TYPES[mt].char === m)
                      ? MARK_TYPES[MARK_ORDER.find((mt) => MARK_TYPES[mt].char === m) as MarkType].title
                      : "علامت"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="حذف علامت"
                  className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                  onClick={() => removeMark(i)}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : selected ? (
          <p className="text-sm text-muted-foreground">این حرف هنوز علامتی ندارد.</p>
        ) : (
          <p className="text-sm text-muted-foreground">اول یک حرف انتخاب کنید.</p>
        )}
      </section>

      <div className="flex gap-2 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3 text-xs leading-5 text-muted-foreground">
        <Info className="size-4 shrink-0 text-chart-2" />
        <p>
          علامت‌ها نویسهٔ چسبان در خود متن‌اند و جای اولیه را GPOS خود فونت تعیین می‌کند — بنابراین روی هر قلمی
          درست می‌نشینند. جابه‌جایی/بزرگ‌نمایی دستیِ تک‌علامت (dx/dy/scale) در بیلد اندروید ارائه می‌شود.
        </p>
      </div>
    </div>
  )
}
