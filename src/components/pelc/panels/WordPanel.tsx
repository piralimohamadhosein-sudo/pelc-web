"use client"

/** تب «واژه» — قلم، اندازه، رنگ و افکت‌های لایهٔ انتخاب‌شده (متن با دکمهٔ «+» بوم یا دوبارزدن روی لایه ویرایش می‌شود) */

import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, COLOR_SWATCHES, findLayer } from "@/lib/pelc/model"
import { EmptyTextState, hasNoTextLayers } from "./EmptyTextState"
import { FontPicker } from "@/components/pelc/FontPicker"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

export function WordPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const openTextDialog = useEditorStore((s) => s.openTextDialog)
  const setLayerFont = useEditorStore((s) => s.setLayerFont)
  const setLayerFontSize = useEditorStore((s) => s.setLayerFontSize)
  const setLayerColor = useEditorStore((s) => s.setLayerColor)
  const setFillMode = useEditorStore((s) => s.setFillMode)
  const setStrokeWidth = useEditorStore((s) => s.setStrokeWidth)
  const setGold = useEditorStore((s) => s.setGold)
  const setShadow = useEditorStore((s) => s.setShadow)

  // سند هنوز هیچ متنی ندارد → دکمهٔ زرد شروع
  const emptyDoc = useEditorStore((s) => hasNoTextLayers(s.doc))
  if (emptyDoc) return <EmptyTextState />

  const layer = findLayer(doc, selectedLayerId)
  if (!layer?.text) {
    return <p className="text-sm text-muted-foreground">لایهٔ انتخاب‌شده متنی ندارد.</p>
  }
  const t = layer.text
  // «انتخاب همه» فعال است: رنگ روی همهٔ لایه‌های انتخاب‌شده اعمال می‌شود
  const isMultiSelect = selectedLayerIds.length > 1

  return (
    <div className="space-y-3">
      {/* متن دیگر فیلد نیست — فقط یک ردیف کوچک: نمایش متن + ویرایش */}
      <section className="space-y-1.5 rounded-lg border bg-card p-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold">متن لایه</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => openTextDialog(layer.id)}
            title="ویرایش متن این لایه — یا دوبار روی لایه در بوم بزنید"
          >
            <Pencil className="size-3" /> ویرایش
          </Button>
        </div>
        <p className="truncate text-sm" title={t.text}>
          {t.text || <span className="text-muted-foreground">— خالی —</span>}
        </p>
        <p className="text-[10px] leading-3.5 text-muted-foreground">
          افزودن متن تازه با دکمهٔ «+» بوم؛ ویرایش با دوبارزدن روی لایه.
        </p>
      </section>

      <section className="space-y-1.5">
        <Label className="text-xs font-semibold">قلم</Label>
        {isMultiSelect && (
          <p className="rounded-md border border-primary/40 bg-accent/40 px-2 py-1 text-[10px] leading-4">
            انتخاب همه فعال — قلم همهٔ{' '}
            <span dir="ltr" className="font-semibold">
              {selectedLayerIds.length.toLocaleString("fa-IR")}
            </span>{' '}
            لایه با هم عوض می‌شود.
          </p>
        )}
        <FontPicker value={t.fontId} onChange={setLayerFont} ariaLabel="قلم لایه" />
        <p className="text-[10px] leading-3.5 text-muted-foreground">ستاره = افزودن به علاقه‌مندی‌ها.</p>
      </section>

      <section>
        <Label className="text-xs font-semibold">
          اندازهٔ قلم: <span dir="ltr">{t.fontSize}</span>
        </Label>
        <Slider
          min={24}
          max={480}
          step={2}
          value={[t.fontSize]}
          onValueChange={([v]) => setLayerFontSize(v)}
          className="mt-1.5"
        />
      </section>

      <section className="space-y-1.5">
        <Label className="text-xs font-semibold">رنگ</Label>
        {isMultiSelect && (
          <p className="rounded-md border border-primary/40 bg-accent/40 px-2 py-1 text-[10px] leading-4">
            انتخاب همه فعال — رنگ همهٔ{' '}
            <span dir="ltr" className="font-semibold">
              {selectedLayerIds.length.toLocaleString("fa-IR")}
            </span>{' '}
            لایه با هم عوض می‌شود.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.argb}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn(
                "size-7 rounded-full border-2 shadow-sm transition-transform hover:scale-105",
                t.color === c.argb ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
              style={{ background: argbToCss(c.argb) }}
              onClick={() => setLayerColor(c.argb)}
            />
          ))}
          <input
            type="color"
            aria-label="رنگ سفارشی"
            className="size-7 cursor-pointer rounded-md border"
            value={argbToCss(t.color)}
            onChange={(e) => setLayerColor(parseInt("ff" + e.target.value.slice(1), 16))}
          />
        </div>
      </section>

      <section className="space-y-2 rounded-lg border bg-card p-2.5">
        <Label className="text-xs font-semibold">حالت پرکردن و افکت‌ها</Label>
        {isMultiSelect && (
          <p className="rounded-md border border-primary/40 bg-accent/40 px-2 py-1 text-[10px] leading-4">
            انتخاب همه فعال — حالت پرکردن و افکت‌ها روی{' '}
            <span dir="ltr" className="font-semibold">
              {selectedLayerIds.length.toLocaleString("fa-IR")}
            </span>{' '}
            لایه با هم اعمال می‌شود.
          </p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: "SOLID", label: "توپُر" },
              { id: "OUTLINE", label: "خط‌دور" },
              { id: "GOLD", label: "طلایی" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFillMode(m.id)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs transition-colors",
                layer.style.fillMode === m.id
                  ? "border-primary bg-accent text-accent-foreground"
                  : "bg-secondary/60 hover:bg-accent/50",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {layer.style.fillMode === "OUTLINE" && (
          <div>
            <Label className="text-[11px] text-muted-foreground">
              ضخامت خط‌دور: <span dir="ltr">{Math.round(layer.style.strokeWidth)}</span>
            </Label>
            <Slider
              min={0}
              max={80}
              step={1}
              value={[layer.style.strokeWidth]}
              onValueChange={([v]) => setStrokeWidth(v)}
              className="mt-1.5"
            />
          </div>
        )}
        {layer.style.fillMode === "GOLD" && (
          <div className="flex items-center justify-between">
            <Label htmlFor="gold-switch" className="text-xs">
              گرادیان طلایی دوتُنه
            </Label>
            <SwitchLike checked={Boolean(layer.style.gold?.enabled)} onChange={setGold} id="gold-switch" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="shadow-switch" className="text-xs">
            سایه
          </Label>
          <SwitchLike checked={Boolean(layer.style.shadow)} onChange={setShadow} id="shadow-switch" />
        </div>
      </section>
    </div>
  )
}

function SwitchLike({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  // سوییچ سبک بدون وابستگی اضافه
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
          checked ? "start-0.5" : "start-[calc(100%-1.375rem)]",
        )}
      />
    </button>
  )
}
