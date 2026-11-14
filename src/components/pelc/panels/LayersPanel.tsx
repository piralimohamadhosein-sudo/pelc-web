"use client"

/** تب «لایه» — فهرست لایه‌ها، پس‌زمینهٔ سند و ترتیب */

import { useEditorStore } from "@/lib/pelc/store"
import { argbToCss, COLOR_SWATCHES, findLayer } from "@/lib/pelc/model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Plus, Copy, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function LayersPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const addLayer = useEditorStore((s) => s.addLayer)
  const deleteLayer = useEditorStore((s) => s.deleteLayer)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)
  const setLayerVisibility = useEditorStore((s) => s.setLayerVisibility)
  const setLayerOpacity = useEditorStore((s) => s.setLayerOpacity)
  const commit = useEditorStore((s) => s.commit)
  const setBackground = useEditorStore((s) => s.setBackground)

  const selected = findLayer(doc, selectedLayerId)

  const reorder = (id: string, dir: -1 | 1) => {
    const idx = doc.layers.findIndex((l) => l.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= doc.layers.length) return
    const layers = [...doc.layers]
    const [item] = layers.splice(idx, 1)
    layers.splice(target, 0, item)
    commit({ ...doc, layers }, "ترتیب لایه‌ها")
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">لایه‌های سند</Label>
          <Button size="sm" variant="outline" onClick={addLayer}>
            <Plus className="size-4" /> لایهٔ تازه
          </Button>
        </div>
        <ul className="space-y-1.5">
          {[...doc.layers].reverse().map((layer) => (
            <li
              key={layer.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                layer.id === selectedLayerId ? "border-primary bg-accent/50" : "bg-card hover:bg-accent/30",
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
                onClick={() => selectLayer(layer.id)}
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-md border text-xs"
                  style={{
                    background: layer.text ? argbToCss(layer.style.color) : argbToCss(layer.style.strokeColor),
                    color: doc.background.transparent ? "#fff" : argbToCss(doc.background.color),
                  }}
                  aria-hidden
                >
                  {layer.text?.text.trim().slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{layer.name}</span>
              </button>
              <button
                type="button"
                aria-label={layer.visible ? "پنهان کردن لایه" : "نمایش لایه"}
                className="rounded p-1.5 hover:bg-accent"
                onClick={() => setLayerVisibility(!layer.visible)}
              >
                {layer.visible ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}
              </button>
              <button
                type="button"
                aria-label="جابه‌جایی به بالا"
                className="rounded p-1.5 hover:bg-accent"
                onClick={() => reorder(layer.id, 1)}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="جابه‌جایی به پایین"
                className="rounded p-1.5 hover:bg-accent"
                onClick={() => reorder(layer.id, -1)}
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                aria-label="تکثیر لایه"
                className="rounded p-1.5 hover:bg-accent"
                onClick={() => duplicateLayer(layer.id)}
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                aria-label="حذف لایه"
                className="rounded p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                disabled={doc.layers.length <= 1}
                onClick={() => deleteLayer(layer.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="space-y-2 rounded-lg border bg-card p-3">
          <Label htmlFor="layer-name" className="text-sm font-semibold">
            نام لایهٔ انتخابی
          </Label>
          <Input
            id="layer-name"
            value={selected.name}
            onChange={(e) => {
              const name = e.target.value
              commit(
                { ...doc, layers: doc.layers.map((l) => (l.id === selected.id ? { ...l, name } : l)) },
                "نام لایه",
                `name:${selected.id}`,
              )
            }}
          />
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">شفافیت: {Math.round(selected.opacity * 100)}٪</Label>
            <Slider
              min={5}
              max={100}
              step={1}
              value={[Math.round(selected.opacity * 100)]}
              onValueChange={([v]) => setLayerOpacity(v / 100)}
              className="mt-2"
            />
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-lg border bg-card p-3">
        <Label className="text-sm font-semibold">پس‌زمینهٔ سند</Label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.slice(0, 6).map((c) => (
            <button
              key={c.argb}
              type="button"
              aria-label={`پس‌زمینهٔ ${c.label}`}
              className={cn(
                "size-8 rounded-full border-2 shadow-sm transition-transform hover:scale-105",
                doc.background.color === c.argb ? "border-primary" : "border-border",
              )}
              style={{ background: argbToCss(c.argb) }}
              onClick={() => setBackground(c.argb)}
            />
          ))}
          <input
            type="color"
            aria-label="رنگ سفارشی پس‌زمینه"
            className="size-8 cursor-pointer rounded-md border"
            value={argbToCss(doc.background.color)}
            onChange={(e) => setBackground(parseInt("ff" + e.target.value.slice(1), 16))}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Label htmlFor="bg-transparent" className="text-sm">
            پس‌زمینهٔ شفاف
          </Label>
          <Switch
            id="bg-transparent"
            checked={doc.background.transparent}
            onCheckedChange={(v) => setBackground(doc.background.color, v)}
          />
        </div>
      </section>
    </div>
  )
}
