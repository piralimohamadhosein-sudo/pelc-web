"use client"

/**
 * انتخابگر قلم پلک با ستارهٔ علاقه‌مندی.
 *
 * چرا منوی بازشو و نه <select>؟ چون داخل گزینه‌های <select> بومی نمی‌توان
 * دکمهٔ ستاره گذاشت. اینجا هر ردیف یک دکمهٔ ستاره مستقل دارد:
 *  - کلیک روی ردیف = انتخاب قلم
 *  - کلیک روی ستاره = افزودن/برداشتن از علاقه‌مندی‌ها
 * فونت‌های ستاره‌دار به بالای فهرست می‌آیند و ستارهٔ توپُر طلایی دارند.
 * ستاره‌ها در localStorage می‌مانند (در بیلد اندروید معادل DataStore است).
 */

import { useEffect, useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { PELC_FONTS, fontById, ensureFontLoaded } from "@/lib/pelc/fonts"
import { ChevronDown, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface FontPickerProps {
  /** شناسهٔ قلم فعلی */
  value: string
  onChange: (id: string) => void
  /** گزینهٔ «هیچ» — برای «قلم اختصاصی حرف» (بازگشت به قلم لایه) */
  noneValue?: string
  /** برچسب گزینهٔ «هیچ» */
  noneLabel?: string
  ariaLabel?: string
  className?: string
}

export function FontPicker({ value, onChange, noneValue, noneLabel, ariaLabel, className }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const favorites = useEditorStore((s) => s.favoriteFontIds)
  const toggleFavorite = useEditorStore((s) => s.toggleFavoriteFont)

  // بستن منو با کلیک بیرون یا کلید Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const isNone = noneValue !== undefined && value === noneValue
  const current = fontById(value)
  // ستاره‌دارها اول، بقیه به ترتیب مخزن
  const ordered = [...PELC_FONTS].sort((a, b) => {
    const fa = favorites.includes(a.id) ? 0 : 1
    const fb = favorites.includes(b.id) ? 0 : 1
    return fa - fb
  })

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        dir="rtl"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-sm shadow-sm transition-colors hover:bg-accent/40"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {!isNone && favorites.includes(value) && (
            <Star className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
          )}
          <span className="truncate font-medium">{isNone ? noneLabel : current.displayName}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {!isNone && <span>{current.style}</span>}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          role="listbox"
          aria-label="فهرست قلم‌ها"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {isNone && noneValue !== undefined && noneLabel && (
            <FontRow label={noneLabel} style="" starred={false} selected onSelect={() => setOpen(false)} />
          )}
          {noneValue !== undefined && !isNone && noneLabel && (
            <FontRow
              label={noneLabel}
              style=""
              starred={false}
              selected={false}
              onSelect={() => {
                onChange(noneValue)
                setOpen(false)
              }}
            />
          )}
          {ordered.map((f) => (
            <FontRow
              key={f.id}
              label={f.displayName}
              style={f.style}
              starred={favorites.includes(f.id)}
              selected={value === f.id}
              onSelect={() => {
                void ensureFontLoaded(f.id)
                onChange(f.id)
                setOpen(false)
              }}
              onToggleStar={() => toggleFavorite(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FontRowProps {
  label: string
  style: string
  starred: boolean
  selected: boolean
  onSelect: () => void
  /** اگر داده نشود ستاره نشان داده نمی‌شود (ردیف گزینهٔ «هیچ») */
  onToggleStar?: () => void
}

function FontRow({ label, style, starred, selected, onSelect, onToggleStar }: FontRowProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        )}
      >
        <span className="truncate font-medium">{label}</span>
        {style && <span className="shrink-0 text-[10px] text-muted-foreground">{style}</span>}
      </button>
      {onToggleStar && (
        <button
          type="button"
          aria-label={starred ? "برداشتن ستاره از این قلم" : "ستاره‌زدن به این قلم"}
          title={starred ? "برداشتن از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleStar()
          }}
          className="grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-accent/60"
        >
          <Star
            className={cn("size-4 transition-colors", starred ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/45")}
          />
        </button>
      )}
    </div>
  )
}
