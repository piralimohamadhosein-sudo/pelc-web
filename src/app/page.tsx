"use client"

/**
 * پلک — نسخهٔ آزمایشی وب (فاز ۱)
 * ویرایش واژه/حرف، کشیده، علامت‌ها و تاریخچه — پیش‌نمایش پیش از بیلد اندروید.
 */

import { useEffect, useState } from "react"
import { EditorCanvas } from "@/components/pelc/EditorCanvas"
import { Panels } from "@/components/pelc/Panels"
import { SaveDialog } from "@/components/pelc/SaveDialog"
import { WelcomeDialog, WELCOME_SEEN_KEY } from "@/components/pelc/WelcomeDialog"
import { SupportDialog } from "@/components/pelc/SupportDialog"
import { Shamsa } from "@/components/pelc/Shamsa"
import { useEditorStore } from "@/lib/pelc/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Undo2, Redo2, Save, MessageCircle } from "lucide-react"

export default function Home() {
  const doc = useEditorStore((s) => s.doc)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const setDocTitle = useEditorStore((s) => s.setDocTitle)
  const hydrateFavoriteFonts = useEditorStore((s) => s.hydrateFavoriteFonts)
  const [saveOpen, setSaveOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  // پیام خوش‌آمد فقط بار اول نمایش داده می‌شود؛ پس از بستن در localStorage ثبت می‌شود
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  const handleWelcomeOpenChange = (v: boolean) => {
    setWelcomeOpen(v)
    if (!v && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(WELCOME_SEEN_KEY, "1")
      } catch {
        /* حافظه در دسترس نیست — فقط برای همین نشست بسته می‌شود */
      }
    }
  }

  // خواندن فونت‌های ستاره‌دار از localStorage — فقط سمت مرورگر، پس از هیدراسیون
  useEffect(() => {
    hydrateFavoriteFonts()
    // پیام خوش‌آمد فقط وقتی باز می‌شود که قبلاً دیده نشده باشد — با یک تیک تأخیر
    // تا setState همزمان با بدنهٔ اثر، رندر آبشاری نسازد.
    const t = window.setTimeout(() => {
      let seen = false
      try {
        seen = window.localStorage.getItem(WELCOME_SEEN_KEY) === "1"
      } catch {
        seen = false
      }
      if (!seen) setWelcomeOpen(true)
    }, 0)
    return () => window.clearTimeout(t)
  }, [hydrateFavoriteFonts])

  // میان‌برهای صفحه‌کلید: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault()
        setSaveOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      {/* نوار بالا — هدر باریک با مدالیون شمسه و حاشیهٔ گره‌چینی */}
      <header className="shrink-0">
        <div className="flex items-center gap-2 border-b bg-card px-3 py-1.5">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-sm"
            aria-hidden
          >
            <Shamsa className="size-5" />
          </span>
          {/* لوگوی برند — «پلک» با قلم امیری (نسخ قرآنی) و طلای تذهیب */}
          <p className="pelc-brand text-[1.7rem] leading-none">پلک</p>

          <Input
            value={doc.title}
            onChange={(e) => setDocTitle(e.target.value)}
            aria-label="عنوان سند"
            className="mx-1 hidden h-8 max-w-52 flex-1 bg-secondary/60 text-xs sm:block"
          />

          <div className="ms-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="واگرد"
              title="واگرد (Ctrl+Z)"
              disabled={!canUndo}
              onClick={undo}
              className="size-8"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="ازنو"
              title="ازنو (Ctrl+Shift+Z)"
              disabled={!canRedo}
              onClick={redo}
              className="size-8"
            >
              <Redo2 className="size-4" />
            </Button>
            <Button size="sm" onClick={() => setSaveOpen(true)} className="h-8 px-2.5 text-xs">
              <Save className="size-4" /> ذخیره
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="پشتیبانی"
              onClick={() => setSupportOpen(true)}
              className="h-8 px-2.5 text-xs"
            >
              <MessageCircle className="size-4" /> پشتیبانی
            </Button>
          </div>
        </div>
        <div className="pelc-girih-strip" aria-hidden="true" />
      </header>

      {/* بوم + پنل */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-[42vh] flex-1 lg:min-h-0" aria-label="بوم ویرایش">
          <EditorCanvas />
        </section>
        <aside
          className="h-[46vh] w-full shrink-0 border-t bg-card lg:h-auto lg:w-[360px] lg:border-s lg:border-t-0"
          aria-label="پنل ویرایش"
        >
          <Panels />
        </aside>
      </main>

      <SaveDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <WelcomeDialog open={welcomeOpen} onOpenChange={handleWelcomeOpenChange} />
      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </div>
  )
}
