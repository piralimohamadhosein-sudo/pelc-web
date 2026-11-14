"use client"

/**
 * گفت‌وگوی ذخیره — همان جریان نسخهٔ اندروید: روی ذخیره، قالب از کاربر پرسیده
 * می‌شود و سند همیشه به‌صورت .pelc هم ذخیره می‌شود.
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useEditorStore } from "@/lib/pelc/store"
import {
  downloadBlob,
  exportJpg,
  exportPelcJson,
  exportPng,
  exportSvg,
  safeFilename,
  type ExportFormat,
} from "@/lib/pelc/export"
import { useToast } from "@/hooks/use-toast"
import { Download, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "PNG", label: "PNG", hint: "شفاف یا با پس‌زمینه — بی‌افت‌خیز" },
  { id: "JPG", label: "JPG", hint: "با کنترل کیفیت" },
  { id: "SVG", label: "SVG", hint: "وکتوری فونت‌مستقل" },
  { id: "PELC", label: "پروژهٔ ‎.pelc", hint: "همهٔ لایه‌ها و ویرایش‌ها" },
]

export function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const doc = useEditorStore((s) => s.doc)
  const { toast } = useToast()
  const [format, setFormat] = useState<ExportFormat>("PNG")
  const [scale, setScale] = useState<1 | 2>(1)
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)
  /** پاسخ پرسش پس‌زمینه: null = هنوز انتخاب نشده، true = شفاف (پوستر)، false = پس‌زمینهٔ سند */
  const [transparentBg, setTransparentBg] = useState<boolean | null>(null)

  const save = async () => {
    setBusy(true)
    try {
      const base = safeFilename(doc.title)
      const pelc = exportPelcJson(doc)
      const wantTransparent = transparentBg === true
      if (format === "PNG") {
        downloadBlob(await exportPng(doc, { scale, quality, transparent: wantTransparent }), `${base}.png`)
      } else if (format === "JPG") {
        downloadBlob(await exportJpg(doc, { scale, quality, transparent: wantTransparent }), `${base}.jpg`)
      } else if (format === "SVG") {
        downloadBlob(await exportSvg(doc, { transparent: wantTransparent }), `${base}.svg`)
      }
      // سند همیشه به‌صورت .pelc هم ذخیره می‌شود (با پس‌زمینهٔ خودِ سند)
      downloadBlob(pelc, `${base}.pelc`)
      toast({
        title: "ذخیره شد",
        description: `${FORMATS.find((f) => f.id === format)?.label} + فایل پروژهٔ ‎.pelc${wantTransparent ? " — پس‌زمینهٔ شفاف" : ""}`,
      })
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "خطا در ذخیره",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ذخیره در چه قالبی؟</DialogTitle>
          <DialogDescription>
            علاوه بر قالب انتخابی، همیشه یک نسخهٔ پروژهٔ <span dir="ltr">.pelc</span> هم دانلود می‌شود تا همهٔ
            لایه‌ها و ویرایش‌ها حفظ بماند.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-lg border p-3 text-start transition-colors",
                format === f.id ? "border-primary bg-accent" : "bg-card hover:bg-accent/50",
              )}
            >
              <span className="block text-sm font-semibold" dir={f.id === "PELC" ? "rtl" : "ltr"}>
                {f.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{f.hint}</span>
            </button>
          ))}
        </div>

        {/* ---------- پرسش پس‌زمینهٔ شفاف ---------- */}
        <div className="space-y-2 rounded-lg border-2 border-dashed border-chart-2/50 bg-chart-2/5 p-3">
          <Label className="text-sm font-semibold">می‌خواهی کل پروژه با پس‌زمینهٔ شفاف ذخیره شود؟</Label>
          <p className="text-xs leading-5 text-muted-foreground">
            پس‌زمینهٔ شفاف برای استفاده روی پوستر و ترکیب با تصاویر دیگر مناسب است. قالب‌های PNG و SVG شفافیت را
            نگه می‌دارند؛ JPG شفافیت ندارد و روی سفید ذخیره می‌شود.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTransparentBg(false)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                transparentBg === false ? "border-primary bg-accent" : "bg-card hover:bg-accent/50",
              )}
            >
              نه — با پس‌زمینهٔ سند
            </button>
            <button
              type="button"
              onClick={() => setTransparentBg(true)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                transparentBg === true ? "border-primary bg-accent" : "bg-card hover:bg-accent/50",
              )}
            >
              بله — شفاف (پوستر)
            </button>
          </div>
          {format === "JPG" && transparentBg === true && (
            <p className="text-xs font-medium text-chart-2">
              JPG شفافیت ندارد؛ خروجی روی پس‌زمینهٔ سفید ذخیره می‌شود. برای شفاف واقعی PNG یا SVG را انتخاب کنید.
            </p>
          )}
          <p className="text-[11px] leading-4 text-muted-foreground">
            این انتخاب فقط روی فایل خروجی اعمال می‌شود؛ پروژهٔ ‎.pelc پس‌زمینهٔ خود سند را نگه می‌دارد.
          </p>
        </div>

        {(format === "PNG" || format === "JPG") && (
          <div className="space-y-1.5">
            <Label className="text-sm">بزرگ‌نمایی خروجی</Label>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  dir="ltr"
                  onClick={() => setScale(s)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    scale === s ? "border-primary bg-accent" : "bg-card hover:bg-accent/50",
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">خروجی ۴× بدون کاهش کیفیت در بیلد اندروید پشتیبانی می‌شود.</p>
          </div>
        )}

        {format === "JPG" && (
          <div>
            <Label className="text-sm">
              کیفیت JPG: <span dir="ltr">{quality}</span>
            </Label>
            <Slider min={60} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} className="mt-2" />
          </div>
        )}

        {format === "SVG" && (
          <p className="text-xs text-muted-foreground">
            فونت‌های به‌کاررفته داخل فایل جاسازی می‌شوند؛ SVG در هر دستگاهی همان شکل را نشان می‌دهد.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            انصراف
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} دانلود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
