"use client"

/**
 * چیپ‌های کلاستر حرف — مؤلفهٔ مشترک تب‌های «حرف»، «کشیده» و «علامت‌ها».
 * هر چیپ یک کلاستر (حرف پایه + علائم چسبان) را نشان می‌دهد؛ انتخاب‌ها بر پایهٔ
 * اندیس UTF-16 آغاز کلاستر هستند تا گونه/قلم سر جایش بماند.
 */

import { useEditorStore } from "@/lib/pelc/store"
import { clusterDisplayLabel, letterClusters, type LetterCluster } from "@/lib/pelc/arabicText"
import { findLayer, LETTER_FORM_TITLES, normalizeLetterForm } from "@/lib/pelc/model"
import { cn } from "@/lib/utils"

export function useSelectedLayerText(): string | null {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  return findLayer(doc, selectedLayerId)?.text?.text ?? null
}

export function ClusterChips({ showKashidaBadge = false }: { showKashidaBadge?: boolean }) {
  const text = useSelectedLayerText()
  const selectedClusterStart = useEditorStore((s) => s.selectedClusterStart)
  const selectLetter = useEditorStore((s) => s.selectLetter)
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)

  if (!text) {
    return <p className="text-sm text-muted-foreground">این لایه متنی ندارد. اول از تب «واژه» متن بنویسید.</p>
  }

  const clusters = letterClusters(text)
  const layer = findLayer(doc, selectedLayerId)
  const perLetter = layer?.text?.perLetter ?? {}

  return (
    <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="انتخاب حرف">
      {clusters.map((c) => {
        const ov = perLetter[String(c.start)]
        return (
          <Chip
            key={c.start}
            cluster={c}
            selected={c.start === selectedClusterStart}
            variant={ov?.variantTag ?? null}
            form={ov ? normalizeLetterForm(ov.formOverride) : "AUTO"}
            letterFont={ov?.fontId ?? null}
            markCount={ov?.marks.length ?? 0}
            showKashidaBadge={showKashidaBadge}
            onSelect={() => selectLetter(c.start === selectedClusterStart ? null : c.start)}
          />
        )
      })}
    </div>
  )
}

function Chip({
  cluster,
  selected,
  variant,
  form,
  letterFont,
  markCount,
  showKashidaBadge,
  onSelect,
}: {
  cluster: LetterCluster
  selected: boolean
  variant: string | null
  form: string
  letterFont: string | null
  markCount: number
  showKashidaBadge: boolean
  onSelect: () => void
}) {
  const isWhitespace = cluster.base === " " || cluster.base === "\n" || cluster.base === "\u200C"
  const hasForm = form !== "AUTO"
  const titleParts: string[] = []
  if (variant) titleParts.push(`گونهٔ ${variant}`)
  if (hasForm) titleParts.push(`فرم ${LETTER_FORM_TITLES[form as keyof typeof LETTER_FORM_TITLES] ?? form}`)
  if (letterFont) titleParts.push(`قلم اختصاصی`)
  const title = titleParts.length > 0 ? titleParts.join(" · ") : clusterDisplayLabel(cluster)
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative min-w-11 rounded-lg border px-2.5 py-2 text-center transition-colors",
        isWhitespace && "min-w-16",
        selected
          ? "border-primary bg-accent text-accent-foreground shadow-sm"
          : "bg-card text-card-foreground hover:bg-accent/60",
      )}
      title={title}
    >
      <span className="text-lg leading-6">{clusterDisplayLabel(cluster)}</span>
      {showKashidaBadge && cluster.kashidaBefore > 0 && (
        <span className="absolute -top-1.5 -start-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {cluster.kashidaBefore}
        </span>
      )}
      {variant && (
        <span
          className="absolute -top-1.5 -end-1.5 rounded-full bg-chart-2 px-1.5 text-[9px] font-bold text-white"
          dir="ltr"
        >
          {variant}
        </span>
      )}
      {!variant && hasForm && (
        <span
          className="absolute -top-1.5 -end-1.5 rounded-full bg-chart-1 px-1.5 text-[9px] font-bold text-white"
          title={`فرم ${LETTER_FORM_TITLES[form as keyof typeof LETTER_FORM_TITLES] ?? form}`}
        >
          {LETTER_FORM_TITLES[form as keyof typeof LETTER_FORM_TITLES]?.slice(0, 3) ?? "!"}
        </span>
      )}
      {!variant && !hasForm && letterFont && (
        <span className="absolute -top-1.5 -end-1.5 size-2.5 rounded-full border border-white bg-chart-5" />
      )}
      {!variant && !hasForm && !letterFont && markCount > 0 && (
        <span className="absolute -top-1.5 -end-1.5 rounded-full bg-chart-3 px-1.5 text-[9px] font-bold text-white">
          {markCount}
        </span>
      )}
    </button>
  )
}
