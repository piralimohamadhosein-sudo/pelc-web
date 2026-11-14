"use client"

/** تب «کشیده» — درج/حذف تطویل پیش از حرف انتخابی، با اعتبارسنجی اتصال */

import { useEditorStore } from "@/lib/pelc/store"
import { canKashidaBefore, letterClusters } from "@/lib/pelc/arabicText"
import { findLayer } from "@/lib/pelc/model"
import { ClusterChips } from "./ClusterChips"
import { Button } from "@/components/ui/button"
import { Maximize2, Minimize2, Info } from "lucide-react"

export function KashidaPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const selectedClusterStart = useEditorStore((s) => s.selectedClusterStart)
  const insertKashida = useEditorStore((s) => s.insertKashida)
  const removeKashida = useEditorStore((s) => s.removeKashida)
  const stressResult = useEditorStore((s) => s.stressResult)
  void stressResult

  const layer = findLayer(doc, selectedLayerId)
  const text = layer?.text?.text ?? ""
  const clusters = letterClusters(text)
  const selected = clusters.find((c) => c.start === selectedClusterStart) ?? null

  const canInsert =
    selected !== null &&
    selected.kashidaBefore < 8 &&
    canKashidaBefore(text, selected.start)
  const canRemove = selected !== null && selected.kashidaBefore > 0

  let hint = "اول یک حرف را انتخاب کنید."
  if (selected) {
    if (canRemove) hint = `این حرف ${selected.kashidaBefore} کشیده دارد — می‌توانید کم کنید یا بیشتر کنید.`
    else if (canInsert) hint = "می‌توانید پیش از این حرف کشیده درج کنید."
    else hint = "اینجا کشیده نمی‌شود: میان دو حرفِ متصل درست است (مثلاً پس از الف، واو، دال یا جفت «لا» مجاز نیست)."
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <p className="text-sm font-semibold">۱. حرف را انتخاب کنید</p>
        <ClusterChips showKashidaBadge />
      </section>

      <section className="space-y-3">
        <p className="text-sm font-semibold">۲. درج یا حذف کشیده</p>
        <div className="flex gap-2">
          <Button onClick={insertKashida} disabled={!canInsert} className="flex-1">
            <Maximize2 className="size-4" /> درج کشیده
          </Button>
          <Button onClick={removeKashida} disabled={!canRemove} variant="outline" className="flex-1">
            <Minimize2 className="size-4" /> حذف کشیده
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </section>

      <div className="flex gap-2 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3 text-xs leading-5 text-muted-foreground">
        <Info className="size-4 shrink-0 text-chart-2" />
        <p>
          کشیده به‌صورت نویسهٔ تَطویل (U+0640) در خود متن درج می‌شود — پس اتصال حروف اطراف هرگز نمی‌شکند و در
          خروجی‌های وکتوری هم دقیقاً همین شکل حفظ می‌شود. بیشینهٔ کشیده پشت‌سرهم: ۸.
        </p>
      </div>
    </div>
  )
}
