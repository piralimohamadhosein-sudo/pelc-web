"use client"

/**
 * گفت‌وگوی پشتیبانی — از دکمهٔ «پشتیبانی» نوار بالا باز می‌شود و اطلاعات
 * طراح و سازنده و راه ارتباطی تلگرام را نشان می‌دهد.
 */

import { MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function SupportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pelc-gilded sm:max-w-md" dir="rtl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-sm"
            aria-hidden
          >
            <MessageCircle className="size-6" />
          </span>
          <DialogTitle className="text-xl leading-8">پشتیبانی</DialogTitle>
          <DialogDescription className="leading-6">
            برای سؤال، پیشنهاد یا گزارش مشکل، از راه زیر در ارتباط باشید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border bg-accent/40 p-3 text-center text-sm leading-6">
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

        <Button asChild className="w-full">
          <a href="https://t.me/MohammadhosseinP" target="_blank" rel="noreferrer">
            <MessageCircle className="size-4" />
            گفت‌وگو در تلگرام
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
