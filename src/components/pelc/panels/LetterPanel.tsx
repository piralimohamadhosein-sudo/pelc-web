"use client"

/**
 * تب «حرف» — تغییر حالت هر حرف در فونت:
 *  ۱) حالت حرف (تنها/آغازی/میانی/پایانی) — در همهٔ فونت‌ها کار می‌کند
 *     (با نویسه‌های صفرعرض در متنِ نمایش؛ متن اصلی دست‌نخورده می‌ماند)
 *  ۲) قلم اختصاصی همان حرف — حرف با فونت دیگر از بقیهٔ واژه
 *  ۳) گونه‌های GSUB فونت (salt/ss01/ss02/cv...) — فقط در فونت‌هایی که دارند
 */

import { useEffect, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { findLayer, LETTER_FORM_TITLES, type LetterForm } from "@/lib/pelc/model"
import { fontById, PELC_FONTS } from "@/lib/pelc/fonts"
import { detectVariantTags, variantTagLabel } from "@/lib/pelc/variants"
import { formAvailability } from "@/lib/pelc/arabicText"
import { ClusterChips } from "./ClusterChips"
import { Skeleton } from "@/components/ui/skeleton"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

const FORM_SAMPLE: Record<LetterForm, string> = {
  AUTO: "خودِ فونت",
  ISOLATED: "ب",
  INITIAL: "بـ",
  MEDIAL: "ـبـ",
  FINAL: "ـب",
}

const FORM_HINT: Record<LetterForm, string> = {
  AUTO: "شکل طبیعی حرف در زمینهٔ واژه",
  ISOLATED: "حرف بدون اتصال، جدا از دو طرف",
  INITIAL: "اتصال فقط از جلو — مثل آغاز واژه",
  MEDIAL: "اتصال از هر دو طرف — مثل میانهٔ واژه",
  FINAL: "اتصال فقط از عقب — مثل پایان واژه",
}

export function LetterPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedClusterStart = useEditorStore((s) => s.selectedClusterStart)
  const setLetterVariant = useEditorStore((s) => s.setLetterVariant)
  const setLetterForm = useEditorStore((s) => s.setLetterForm)
  const setLetterFont = useEditorStore((s) => s.setLetterFont)

  const layer = findLayer(doc, selectedLayerId)
  const fontId = layer?.text?.fontId ?? "amiri"
  const text = layer?.text?.text ?? ""

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

  const selectedKey = selectedClusterStart !== null ? String(selectedClusterStart) : null
  const override = selectedKey ? layer?.text?.perLetter[selectedKey] : undefined
  const activeTag = override?.variantTag ?? null
  const activeForm = override?.formOverride ?? "AUTO"
  const activeLetterFont = override?.fontId ?? null
  const availability: Record<LetterForm, boolean> | null =
    selectedClusterStart !== null && layer?.text ? formAvailability(text, selectedClusterStart) : null

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <p className="text-sm font-semibold">۱. یک حرف را انتخاب کنید</p>
        <ClusterChips />
      </section>

      {selectedClusterStart === null ? (
        <p className="text-sm text-muted-foreground">برای تغییر حالت، اول از بالا یک حرف انتخاب کنید.</p>
      ) : (
        <>
          {/* ---------- حالت حرف ---------- */}
          <section className="space-y-2 rounded-lg border bg-card p-3">
            <p className="text-sm font-semibold">۲. حالت حرف — در همهٔ فونت‌ها کار می‌کند</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(["AUTO", "ISOLATED", "INITIAL", "MEDIAL", "FINAL"] as LetterForm[]).map((form) => {
                const enabled = availability?.[form] ?? false
                const active = activeForm === form
                return (
                  <button
                    key={form}
                    type="button"
                    disabled={!enabled}
                    title={`${FORM_HINT[form]}${enabled ? "" : " — برای این حرف ممکن نیست"}`}
                    onClick={() => setLetterForm(form)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors",
                      active
                        ? "border-primary bg-accent text-accent-foreground shadow-sm"
                        : "bg-card hover:bg-accent/50",
                      !enabled && "cursor-not-allowed opacity-35 hover:bg-card",
                    )}
                  >
                    <span className="text-base leading-6">{FORM_SAMPLE[form]}</span>
                    <span className="text-[10px] leading-3">{LETTER_FORM_TITLES[form]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              فرم دلخواه با نویسه‌های صفرعرض در «متنِ نمایش» ساخته می‌شود؛ متن اصلی، کشیده و علامت‌ها دست‌نخورده
              می‌مانند. اگر گزینه‌ای خاموش است یعنی آن حرف از آن سمت نمی‌چسبد (مثل الف، دال، ر، و).
            </p>
          </section>

          {/* ---------- قلم این حرف ---------- */}
          <section className="space-y-2 rounded-lg border bg-card p-3">
            <p className="text-sm font-semibold">۳. قلم اختصاصی این حرف</p>
            <select
              dir="rtl"
              value={activeLetterFont ?? ""}
              onChange={(e) => setLetterFont(e.target.value === "" ? null : e.target.value)}
              className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
              aria-label="قلم اختصاصی حرف"
            >
              <option value="">همان قلم لایه ({fontById(fontId).displayName})</option>
              {PELC_FONTS.filter((f) => f.id !== fontId).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName} — {f.style}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">
              حرف با فونت دیگر، طبیعتاً از اتصال واژه جدا می‌افتد؛ بعدش می‌توانید با کشیده یا جابه‌جایی دستی در بیلد
              اندروید نزدیکش کنید.
            </p>
          </section>
        </>
      )}

      {/* ---------- گونه‌های GSUB فونت ---------- */}
      <section className="space-y-2">
        <p className="text-sm font-semibold">۴. گونه‌های طراحی فونت (variant)</p>
        {selectedClusterStart === null ? (
          <p className="text-sm text-muted-foreground">اول یک حرف انتخاب کنید.</p>
        ) : tags === null ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            این فونت گونهٔ جایگزین GSUB ندارد — ولی «حالت حرف» و «قلمِ حرف» بالا همیشه کار می‌کنند. فونت‌های امیری،
            عارف رقعه، شهرزاد، لطیف و ریم‌کوفی گونهٔ GSUB دارند.
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
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs",
                  tag === activeTag
                    ? "border-primary bg-accent font-medium shadow-sm"
                    : "bg-card hover:bg-accent/60",
                )}
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
          از این نسخه گونه‌ها، قلمِ حرف و رنگ حرف فقط روی همان حرف اعمال می‌شود (نه کل جمله). فیلتر «فقط گونه‌هایی
          که شکل را عوض می‌کنند» در بیلد اندروید با HarfBuzz کامل می‌شود.
        </p>
      </div>
    </div>
  )
}
