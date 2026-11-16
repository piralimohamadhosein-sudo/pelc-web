"use client"

/**
 * حالت خالی مشترک تب‌های «واژه / حرف / کشیده / علامت‌ها».
 *
 * وقتی هنوز هیچ متنی روی بوم وارد نشده (سند خالی یا فقط عکس)، به‌جای
 * ابزارهای هر تب همین کارت با دکمهٔ زرد نمایش داده می‌شود؛ با زدن دکمه،
 * گفت‌وگوی «افزودن متن نو» — همان دکمهٔ «+» بوم — باز می‌شود.
 */

import { useEditorStore } from "@/lib/pelc/store"
import type { PelcDocument } from "@/lib/pelc/model"
import { Type } from "lucide-react"

/** آیا سند هیچ لایهٔ متنی با متن واقعی ندارد؟ (لایهٔ متنِ خالی هم «خالی» شمرده می‌شود) */
export function hasNoTextLayers(doc: PelcDocument): boolean {
  return !doc.layers.some((l) => l.kind === "TEXT" && (l.text?.text ?? "").trim().length > 0)
}

export function EmptyTextState() {
  const openTextDialog = useEditorStore((s) => s.openTextDialog)

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary/50 bg-card/70 px-4 py-7 text-center shadow-sm">
      <span
        className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-md ring-1 ring-[#8a6d1f]/60"
        aria-hidden
      >
        <Type className="size-5" />
      </span>
      <p className="max-w-[28ch] text-sm leading-6 text-muted-foreground">
        هنوز چیزی وارد نشده و صفحه خالی است.
      </p>
      <button
        type="button"
        onClick={() => openTextDialog()}
        className="flex h-10 touch-manipulation items-center gap-2 rounded-full bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] px-5 text-sm font-bold text-[#2a1f06] shadow-lg ring-1 ring-[#8a6d1f]/60 transition-transform hover:brightness-105 active:scale-95"
      >
        <Type className="size-4" aria-hidden />
        برای شروع جمله‌ای وارد کنید
      </button>
    </div>
  )
}
