"use client"

/** پوستهٔ پنل ویرایش — پنج تب: واژه / حرف / کشیده / علامت‌ها / تاریخچه */

import { useEditorStore, type PanelTab } from "@/lib/pelc/store"
import { WordPanel } from "./panels/WordPanel"
import { LetterPanel } from "./panels/LetterPanel"
import { KashidaPanel } from "./panels/KashidaPanel"
import { MarksPanel } from "./panels/MarksPanel"
import { HistoryPanel } from "./panels/HistoryPanel"
import { Type, Shapes, MoveHorizontal, Palette, History } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  { id: "word", label: "واژه", icon: <Type className="size-4" /> },
  { id: "letter", label: "حرف", icon: <Shapes className="size-4" /> },
  { id: "kashida", label: "کشیده", icon: <MoveHorizontal className="size-4" /> },
  { id: "marks", label: "علامت‌ها", icon: <Palette className="size-4" /> },
  { id: "history", label: "تاریخچه", icon: <History className="size-4" /> },
]

export function Panels() {
  const activeTab = useEditorStore((s) => s.activeTab)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="پنل‌های ویرایش"
        className="pelc-scroll flex shrink-0 gap-0.5 overflow-x-auto border-b bg-card px-1.5 py-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors",
              activeTab === t.id
                ? "bg-accent font-semibold text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/40",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="pelc-scroll min-h-0 flex-1 overflow-y-auto p-3"
      >
        {activeTab === "word" && <WordPanel />}
        {activeTab === "letter" && <LetterPanel />}
        {activeTab === "kashida" && <KashidaPanel />}
        {activeTab === "marks" && <MarksPanel />}
        {activeTab === "history" && <HistoryPanel />}
      </div>
    </div>
  )
}
