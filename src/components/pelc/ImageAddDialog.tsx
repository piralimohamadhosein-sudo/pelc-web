"use client"

/**
 * گفت‌وگوی افزودن عکس — ساخت «عکس‌نوشته»: عکس انتخابی در پس‌زمینهٔ بوم
 * می‌نشیند و متن‌هایی که کاربر از قبل آماده کرده روی آن قرار می‌گیرند.
 * جابه‌جایی با کشیدن و تغییر اندازه با دستگیره‌های گوشهٔ عکس انجام می‌شود.
 */

import { useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { importImageFile, registerImage, type ImageAsset } from "@/lib/pelc/images"
import { ImagePlus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function ImageAddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addImageLayer = useEditorStore((s) => s.addImageLayer)
  const inputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<{ file: File; previewUrl: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFile = (file: File | undefined) => {
    setError(null)
    setPicked(null)
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("فقط فایل عکس انتخاب کنید.")
      return
    }
    setPicked({ file, previewUrl: URL.createObjectURL(file) })
  }

  const confirm = async () => {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      const asset: ImageAsset = await importImageFile(picked.file)
      const assetId = registerImage(asset)
      addImageLayer(assetId, asset.width, asset.height)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "ورود عکس ناموفق بود.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPicked(null)
          setError(null)
          setBusy(false)
        }
        onOpenChange(v)
      }}
    >
      <DialogContent className="pelc-gilded sm:max-w-md" dir="rtl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-sm"
            aria-hidden
          >
            <ImagePlus className="size-6" />
          </span>
          <DialogTitle className="text-xl leading-8">افزودن عکس — عکس‌نوشته</DialogTitle>
          <DialogDescription className="leading-6">
            عکس را انتخاب کنید؛ در پس‌زمینهٔ بوم می‌نشیند و متن‌های آمادهٔ شما روی آن قرار می‌گیرند. جابه‌جایی با
            کشیدن و بزرگ/کوچک‌کردن با دستگیره‌های گوشهٔ عکس.
          </DialogDescription>
        </DialogHeader>

        {/* ناحیهٔ انتخاب عکس */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${
            picked ? "border-primary/60 bg-accent/30" : "border-border hover:border-primary/50 hover:bg-accent/20"
          }`}
        >
          {picked ? (
            <>
              <img
                src={picked.previewUrl}
                alt="پیش‌نمایش عکس"
                className="max-h-36 rounded-lg border shadow-sm"
              />
              <span className="max-w-full truncate text-xs text-muted-foreground" dir="ltr">
                {picked.file.name}
              </span>
            </>
          ) : (
            <>
              <ImagePlus className="size-7 text-primary" aria-hidden />
              <span className="text-sm font-medium">انتخاب عکس از دستگاه</span>
              <span className="text-[11px] text-muted-foreground">JPG ، PNG و قالب‌های دیگر عکس</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button className="flex-1" disabled={!picked || busy} onClick={confirm}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            افزودن به بوم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
