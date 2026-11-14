"use client"

/** گفت‌وگوی «دربارهٔ نسخهٔ وب» — تفاوت‌های نسخهٔ آزمایشی وب با بیلد اندروید */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ROWS: { web: string; android: string; title: string }[] = [
  {
    title: "شکل‌دهی متن",
    web: "HarfBuzz مرورگر — اتصال حروف و جای علامت‌ها کامل و درست",
    android: "HarfBuzz روی NDK — همان نتیجه، وکتور مستقل از فونت دستگاه",
  },
  {
    title: "گونه‌های حرف (variant)",
    web: "اعمال در سطح واژه با font-feature-settings؛ برچسب‌ها از GSUB فونت خوانده می‌شود",
    android: "اعمال خوشه‌به‌خوشه روی حرف انتخابی + فیلتر «فقط گونه‌هایی که شکل را عوض می‌کنند»",
  },
  {
    title: "قلم-به-حرف",
    web: "قلم در سطح واژه",
    android: "هر حرف می‌تواند فونت مستقل داشته باشد",
  },
  {
    title: "تنظیم دستی علامت‌ها",
    web: "درج/حذف علامت با جای‌گذاری GPOS فونت",
    android: "به‌علاوه جابه‌جایی و بزرگ‌نمایی دستیِ تک‌علامت",
  },
  {
    title: "خروجی‌ها",
    web: "PNG، JPG، SVG، ‎.pelc",
    android: "همهٔ این‌ها + PSD لایه‌باز، PDF وکتوری، DXF",
  },
]

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>نسخهٔ آزمایشی وب پلک</DialogTitle>
          <DialogDescription>
            این نسخه برای تست تجربهٔ ویرایش فاز ۱ پیش از بیلد اندروید ساخته شده است: واژه/حرف، کشیده، علامت‌ها و
            تاریخچهٔ ۵۰۰ گامی دقیقاً با همان منطق نسخهٔ اندروید (پورت ۱:۱ از Kotlin) کار می‌کنند.
          </DialogDescription>
        </DialogHeader>
        <div className="pelc-scroll max-h-80 space-y-2 overflow-y-auto pe-1">
          {ROWS.map((r) => (
            <div key={r.title} className="rounded-lg border bg-card p-3 text-sm">
              <p className="mb-1 font-semibold">{r.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">وب:</span> {r.web}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">اندروید:</span> {r.android}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          فونت‌های همراه همگی SIL OFL 1.1 هستند: امیری، شهرزاد نو، عارف رقعه، ریم کوفی، کوفی نوتو، لطیف، نسخ نوتو،
          گلزار و نستعلیق اردو. سبک ثلث و دیوانی فونت بازتوزیع‌پذیر ندارند — در بیلد اندروید ورود قلم شخصی با SAF
          فراهم است.
        </p>
      </DialogContent>
    </Dialog>
  )
}
