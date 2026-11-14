"use client"

/** تب «واژه» — ویرایش متن، انتخاب قلم، اندازه و رنگ لایهٔ انتخاب‌شده */

import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, COLOR_SWATCHES, findLayer } from "@/lib/pelc/model"
import { tokenizeWords } from "@/lib/pelc/measure"
import { FontPicker } from "@/components/pelc/FontPicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { SplitSquareHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export function WordPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const setLayerText = useEditorStore((s) => s.setLayerText)
  const setLayerFont = useEditorStore((s) => s.setLayerFont)
  const setLayerFontSize = useEditorStore((s) => s.setLayerFontSize)
  const setLayerColor = useEditorStore((s) => s.setLayerColor)
  const setFillMode = useEditorStore((s) => s.setFillMode)
  const setStrokeWidth = useEditorStore((s) => s.setStrokeWidth)
  const setGold = useEditorStore((s) => s.setGold)
  const setShadow = useEditorStore((s) => s.setShadow)
  const splitLayerIntoWords = useEditorStore((s) => s.splitLayerIntoWords)

  const layer = findLayer(doc, selectedLayerId)
  if (!layer?.text) {
    return <p className="text-sm text-muted-foreground">لایهٔ انتخاب‌شده متنی ندارد.</p>
  }
  const t = layer.text
  const wordCount = tokenizeWords(t.text).length
  // «انتخاب همه» فعال است: رنگ روی همهٔ لایه‌های انتخاب‌شده اعمال می‌شود
  const isMultiSelect = selectedLayerIds.length > 1

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <Label htmlFor="layer-text" className="text-sm font-semibold">
          متن لایه
        </Label>
        <Textarea
          id="layer-text"
          dir="rtl"
          rows={3}
          className="text-lg leading-relaxed"
          value={t.text}
          onChange={(e) => setLayerText(e.target.value)}
          placeholder="مثلاً: بسم الله الرحمن الرحیم"
        />
        <p className="text-xs text-muted-foreground">
          شکل‌دهی را HarfBuzz مرورگر انجام می‌دهد — اتصال حروف و جای علامت‌ها همیشه درست است.
        </p>
      </section>

      {wordCount >= 2 && (
        <section className="space-y-2 rounded-lg border border-primary/40 bg-accent/40 p-3">
          <Label className="text-sm font-semibold">کلمات مستقل</Label>
          <p className="text-xs leading-5 text-muted-foreground">
            این متن {wordCount.toLocaleString("fa-IR")} کلمه دارد. با این دکمه هر کلمه یک لایهٔ مستقل می‌شود؛ بعد هر
            کلمه را جداگانه بکشید یا با جهت‌نماها تکان دهید.
          </p>
          <button
            type="button"
            onClick={() => splitLayerIntoWords(layer.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <SplitSquareHorizontal className="size-4" />
            تبدیل جمله به کلماتِ مستقل
          </button>
        </section>
      )}

      <section className="space-y-2">
        <Label className="text-sm font-semibold">قلم</Label>
        <FontPicker value={t.fontId} onChange={setLayerFont} ariaLabel="قلم لایه" />
        <p className="text-[11px] leading-4 text-muted-foreground">
          با ستارهٔ کنار هر فونت، آن را به علاقه‌مندی‌ها بیفزایید؛ ستاره‌دارها بالای فهرست می‌آیند.
        </p>
      </section>

      <section>
        <Label className="text-sm font-semibold">
          اندازهٔ قلم: <span dir="ltr">{t.fontSize}</span>
        </Label>
        <Slider
          min={24}
          max={480}
          step={2}
          value={[t.fontSize]}
          onValueChange={([v]) => setLayerFontSize(v)}
          className="mt-2"
        />
      </section>

      <section className="space-y-2">
        <Label className="text-sm font-semibold">رنگ</Label>
        {isMultiSelect && (
          <p className="rounded-md border border-primary/40 bg-accent/40 px-2.5 py-1.5 text-xs leading-5">
            «انتخاب همه» فعال است — با انتخاب یک رنگ، رنگ همهٔ{' '}
            <span dir="ltr" className="font-semibold">
              {selectedLayerIds.length.toLocaleString("fa-IR")}
            </span>{' '}
            لایهٔ انتخاب‌شده با هم عوض می‌شود.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.argb}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={cn(
                "size-8 rounded-full border-2 shadow-sm transition-transform hover:scale-105",
                t.color === c.argb ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
              style={{ background: argbToCss(c.argb) }}
              onClick={() => setLayerColor(c.argb)}
            />
          ))}
          <input
            type="color"
            aria-label="رنگ سفارشی"
            className="size-8 cursor-pointer rounded-md border"
            value={argbToCss(t.color)}
            onChange={(e) => setLayerColor(parseInt("ff" + e.target.value.slice(1), 16))}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-3">
        <Label className="text-sm font-semibold">حالت پرکردن</Label>
        <div className="grid grid-cols-3 gap-2">
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
                "rounded-lg border px-2 py-2 text-sm transition-colors",
                layer.style.fillMode === m.id
                  ? "border-primary bg-accent text-accent-foreground"
                  : "bg-card hover:bg-accent/50",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {layer.style.fillMode === "OUTLINE" && (
          <div>
            <Label className="text-xs text-muted-foreground">
              ضخامت خط‌دور: <span dir="ltr">{Math.round(layer.style.strokeWidth)}</span>
            </Label>
            <Slider
              min={0}
              max={80}
              step={1}
              value={[layer.style.strokeWidth]}
              onValueChange={([v]) => setStrokeWidth(v)}
              className="mt-2"
            />
          </div>
        )}
        {layer.style.fillMode === "GOLD" && (
          <div className="flex items-center justify-between">
            <Label htmlFor="gold-switch" className="text-sm">
              گرادیان طلایی دوتُنه
            </Label>
            <SwitchLike checked={Boolean(layer.style.gold?.enabled)} onChange={setGold} id="gold-switch" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="shadow-switch" className="text-sm">
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
