"use client"

/**
 * پس‌زمینهٔ سند — پس از حذف تب «لایه»، تنظیم پس‌زمینه به یک پاپ‌اُور کوچک
 * کنار «انتخاب همه» روی بوم منتقل شد: چند روزنگار، رنگ سفارشی و حالت شفاف.
 */

import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, COLOR_SWATCHES } from "@/lib/pelc/model"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PaintBucket } from "lucide-react"

export function BackgroundPicker() {
  const doc = useEditorStore((s) => s.doc)
  const setBackground = useEditorStore((s) => s.setBackground)

  return (
    <Popover>
      <PopoverTrigger
        aria-label="پس‌زمینهٔ سند"
        title="پس‌زمینهٔ سند — رنگ، رنگ سفارشی یا شفاف"
        className="grid size-9 place-items-center rounded-full border border-primary/50 bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-accent/60"
      >
        <PaintBucket className="size-4 text-primary" />
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="start" className="w-48 space-y-2.5 p-3">
        <p className="text-xs font-semibold">پس‌زمینهٔ سند</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_SWATCHES.slice(0, 6).map((c) => (
            <button
              key={c.argb}
              type="button"
              aria-label={`پس‌زمینهٔ ${c.label}`}
              title={c.label}
              className={`size-7 rounded-full border-2 shadow-sm transition-transform hover:scale-105 ${
                doc.background.color === c.argb && !doc.background.transparent ? "border-primary" : "border-border"
              }`}
              style={{ background: argbToCss(c.argb) }}
              onClick={() => setBackground(c.argb, false)}
            />
          ))}
          <input
            type="color"
            aria-label="رنگ سفارشی پس‌زمینه"
            title="رنگ سفارشی"
            className="size-7 cursor-pointer rounded-md border"
            value={argbToCss(doc.background.color)}
            onChange={(e) => setBackground(parseInt("ff" + e.target.value.slice(1), 16), false)}
          />
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <Label htmlFor="bg-transparent-mini" className="text-xs">
            پس‌زمینهٔ شفاف
          </Label>
          <Switch
            id="bg-transparent-mini"
            checked={doc.background.transparent}
            onCheckedChange={(v) => setBackground(doc.background.color, v)}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
