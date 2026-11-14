"use client"

/**
 * پلک — نسخهٔ آزمایشی وب (فاز ۱)
 * ویرایش واژه/حرف، کشیده، علامت‌ها و تاریخچه — پیش‌نمایش پیش از بیلد اندروید.
 */

import { useEffect, useState } from "react"
import { EditorCanvas } from "@/components/pelc/EditorCanvas"
import { Panels } from "@/components/pelc/Panels"
import { SaveDialog } from "@/components/pelc/SaveDialog"
import { AboutDialog } from "@/components/pelc/AboutDialog"
import { WelcomeDialog } from "@/components/pelc/WelcomeDialog"
import { useEditorStore } from "@/lib/pelc/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Undo2, Redo2, Save, Info, PenTool } from "lucide-react"

export default function Home() {
  const doc = useEditorStore((s) => s.doc)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const setDocTitle = useEditorStore((s) => s.setDocTitle)
  const hydrateFavoriteFonts = useEditorStore((s) => s.hydrateFavoriteFonts)
  const [saveOpen, setSaveOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  // پیام خوش‌آمد هر بار هنگام باز شدن برنامه می‌آید و با «شروع کنیم» می‌رود
  const [welcomeOpen, setWelcomeOpen] = useState(true)

  // خواندن فونت‌های ستاره‌دار از localStorage — فقط سمت مرورگر، پس از هیدراسیون
  useEffect(() => {
    hydrateFavoriteFonts()
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
      {/* نوار بالا */}
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <PenTool className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">پلک</p>
            <p className="text-[10px] text-muted-foreground">نسخهٔ آزمایشی وب — فاز ۱</p>
          </div>
        </div>

        <Input
          value={doc.title}
          onChange={(e) => setDocTitle(e.target.value)}
          aria-label="عنوان سند"
          className="mx-2 hidden h-9 max-w-56 flex-1 text-sm sm:block"
        />

        <div className="ms-auto flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label="واگرد" disabled={!canUndo} onClick={undo}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="ازنو" disabled={!canRedo} onClick={redo}>
            <Redo2 className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setSaveOpen(true)}>
            <Save className="size-4" /> ذخیره
          </Button>
          <Button variant="ghost" size="icon" aria-label="دربارهٔ نسخهٔ وب" onClick={() => setAboutOpen(true)}>
            <Info className="size-4" />
          </Button>
        </div>
      </header>

      {/* بوم + پنل */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-[38vh] flex-1 lg:min-h-0" aria-label="بوم ویرایش">
          <EditorCanvas />
        </section>
        <aside
          className="h-[46vh] w-full shrink-0 border-t bg-card lg:h-auto lg:w-96 lg:border-s lg:border-t-0"
          aria-label="پنل ویرایش"
        >
          <Panels />
        </aside>
      </main>

      <SaveDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <WelcomeDialog open={welcomeOpen} onOpenChange={setWelcomeOpen} />
    </div>
  )
}
