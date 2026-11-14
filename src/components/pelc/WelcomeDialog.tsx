"use client"

/**
 * گفت‌وگوی خوش‌آمد — هنگام باز شدن برنامه نمایش داده می‌شود و با دکمهٔ
 * «شروع کنیم» (یا Esc / کلیک بیرون) بسته می‌شود.
 */

import { PenTool } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function WelcomeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <PenTool className="size-6" />
          </span>
          <DialogTitle className="text-xl leading-8">به pelc خوش آمدید ✒️</DialogTitle>
          <DialogDescription className="leading-6">
            اینجا هر حرف، اثری از قلم شماست.
            <br />
            با فونت‌های خوشنویسی گوناگون بنویسید، هر حرف را به شکل دلخواه درآورید و خروجی را بدون واترمارک،
            به‌صورت PSD لایه‌باز یا JPG تحویل بگیرید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border bg-accent/40 p-3 text-center text-xs leading-5 text-muted-foreground">
          <p>
            طراح و سازنده: <span className="font-semibold text-foreground">محمد حسین پیرعلی</span>
          </p>
          <p>
            تلگرام / پشتیبانی:{" "}
            <a
              href="https://t.me/MohammadhosseinP"
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="font-medium text-primary underline underline-offset-4"
            >
              @MohammadhosseinP
            </a>
          </p>
        </div>

        <p className="text-center text-sm font-semibold">شروع کنیم؟</p>
        <Button onClick={() => onOpenChange(false)} className="w-full">
          شروع کنیم
        </Button>
      </DialogContent>
    </Dialog>
  )
}
