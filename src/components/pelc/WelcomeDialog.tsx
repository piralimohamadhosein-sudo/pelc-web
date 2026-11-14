"use client"

/**
 * گفت‌وگوی خوش‌آمد — فقط بار اول باز شدن برنامه نمایش داده می‌شود؛ پس از بستن
 * کلید WELCOME_SEEN_KEY در localStorage ثبت می‌شود تا دوباره نیاید.
 * اطلاعات طراح و پشتیبانی به گفت‌وگوی «پشتیبانی» (SupportDialog) منتقل شده است.
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

/** کلید localStorage: اگر «۱» باشد، پیام خوش‌آمد دیگر نمایش داده نمی‌شود */
export const WELCOME_SEEN_KEY = "pelc-welcome-seen"

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

        <p className="text-center text-sm font-semibold">شروع کنیم؟</p>
        <Button onClick={() => onOpenChange(false)} className="w-full">
          شروع کنیم
        </Button>
      </DialogContent>
    </Dialog>
  )
}
