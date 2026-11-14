"use client"

/** تب «حرف» — انتخاب حرف و اعمال گونه‌های OpenType به‌ازای همان حرف */

import { useEffect, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { findLayer } from "@/lib/pelc/model"
import { fontById } from "@/lib/pelc/fonts"
import { detectVariantTags, variantTagLabel } from "@/lib/pelc/variants"
import { ClusterChips } from "./ClusterChips"
import { Skeleton } from "@/components/ui/skeleton"
import { Info } from "lucide-react"

export function LetterPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedClusterStart = useEditorStore((s) => s.selectedClusterStart)
  const setLetterVariant = useEditorStore((s) => s.setLetterVariant)

  const layer = findLayer(doc, selectedLayerId)
  const fontId = layer?.text?.fontId ?? "amiri"
  // نتیجهٔ آشکارسازی به همراه fontId ذخیره می‌شود تا بدون setState هم‌زمان در
  // effect، نتیجهٔ قدیم برای فونت تازه پذیرفته نشود.
  const [detected, setDetected] = useState<{ fontId: string; tags: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    detectVariantTags(fontId, fontById(fontId).file).then((t) => {
      if (!cancelled) setDetected({ fontId, tags: t })
    })
    return () => {
      cancelled = true
    }
  }, [fontId])

  const tags = detected?.fontId === fontId ? detected.tags : null

  const activeTag = selectedClusterStart !== null
    ? (layer?.text?.perLetter[String(selectedClusterStart)]?.variantTag ?? null)
    : null

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <p className="text-sm font-semibold">۱. یک حرف را انتخاب کنید</p>
        <ClusterChips />
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">۲. گونهٔ حرف (variant)</p>
        {selectedClusterStart === null ? (
          <p className="text-sm text-muted-foreground">اول از بالا یک حرف انتخاب کنید.</p>
        ) : tags === null ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            این فونت گونهٔ جایگزین ثبت‌شده در GSUB ندارد. فونت‌هایی مثل امیری و ریم‌کوفی گونه دارند.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                dir="ltr"
                title={variantTagLabel(tag)}
                onClick={() => setLetterVariant(tag === activeTag ? null : tag)}
                className={
                  tag === activeTag
                    ? "rounded-lg border border-primary bg-accent px-3 py-1.5 text-xs shadow-sm"
                    : "rounded-lg border bg-card px-3 py-1.5 text-xs hover:bg-accent/60"
                }
              >
                {tag}
              </button>
            ))}
            {activeTag && (
              <button
                type="button"
                onClick={() => setLetterVariant(null)}
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20"
              >
                حذف گونه
              </button>
            )}
          </div>
        )}
      </section>

      <div className="flex gap-2 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3 text-xs leading-5 text-muted-foreground">
        <Info className="size-4 shrink-0 text-chart-2" />
        <p>
          روی وب، گونه‌ها با <span dir="ltr">font-feature-settings</span> در سطح واژه اعمال می‌شوند؛ در بیلد اندروید
          همان گونه فقط روی خوشهٔ حرف انتخابی با HarfBuzz اعمال می‌شود و فیلتر «فقط گونه‌هایی که شکل حرف را عوض
          می‌کنند» هم آنجا کامل است.
        </p>
      </div>
    </div>
  )
}
