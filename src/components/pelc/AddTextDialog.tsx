"use client"

/**
 * گفت‌وگوی افزودن/ویرایش متن — تنها راه ورود متن در رابط تازه.
 *
 * دکمهٔ طلایی «+» بوم آن را برای افزودن متن تازه باز می‌کند و دوبارزدن روی
 * هر لایهٔ متنی همان را با متنِ موجود باز می‌کند. با تأیید، جملهٔ چندکلمه‌ای
 * خودکار به لایه‌های تک‌کلمه‌ای مستقل شکسته می‌شود (همان رفتار پیشین فیلد
 * متن) تا هر واژه جداگانه جابه‌جا و آراسته شود.
 */

import { useRef, useState } from "react"
import { useEditorStore } from "@/lib/pelc/store"
import { findLayer } from "@/lib/pelc/model"
import { tokenizeWords } from "@/lib/pelc/measure"
import { Plus, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function AddTextDialog() {
  const open = useEditorStore((s) => s.textDialogOpen)
  const editingId = useEditorStore((s) => s.editingTextLayerId)
  const closeTextDialog = useEditorStore((s) => s.closeTextDialog)
  const editingLayer = useEditorStore((s) => (s.editingTextLayerId ? findLayer(s.doc, s.editingTextLayerId) : null))

  const [draft, setDraft] = useState("")
  /** مقدار قبلی «باز» — برای پرکردن پیش‌نویس هنگام تغییر وضعیت گفت‌وگو در خود رندر */
  const [wasOpen, setWasOpen] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // الگوی توصیه‌شدهٔ React «تنظیم وضعیت هنگام تغییر ویژگی»: هنگام باز شدن
  // گفت‌وگو، پیش‌نویس از متن لایه (در ویرایش) یا خالی (در افزودن) پر می‌شود
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(editingLayer?.text?.text ?? "")
  }

  const isEditing = Boolean(editingId && editingLayer)
  const canConfirm = draft.trim().length > 0

  const confirm = () => {
    const text = draft.trim()
    if (!text) return
    const st = useEditorStore.getState()
    if (isEditing && editingId) {
      st.updateLayerText(editingId, text)
      st.closeTextDialog()
      // جملهٔ چندکلمه‌ای پس از به‌روزرسانی رندر، خودکار به کلمه‌های مستقل شکسته می‌شود
      if (tokenizeWords(text).length >= 2) {
        window.setTimeout(() => {
          useEditorStore.getState().splitLayerIntoWords(editingId, { auto: true })
        }, 80)
      }
    } else {
      const id = st.addTextLayer(text)
      st.closeTextDialog()
      if (id && tokenizeWords(text).length >= 2) {
        window.setTimeout(() => {
          useEditorStore.getState().splitLayerIntoWords(id, { auto: true })
        }, 80)
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeTextDialog()
      }}
    >
      <DialogContent className="pelc-gilded sm:max-w-md" dir="rtl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-[#e4c35c] to-[#b08f2f] text-[#2a1f06] shadow-sm"
            aria-hidden
          >
            {isEditing ? <Pencil className="size-6" /> : <Plus className="size-6" />}
          </span>
          <DialogTitle className="text-xl leading-8">{isEditing ? "ویرایش متن لایه" : "افزودن متن نو"}</DialogTitle>
          <DialogDescription className="leading-6">
            متن را بنویسید — کلمه‌های جمله خودکار به لایه‌های مستقل جدا می‌شوند تا هر واژه جداگانه چیده شود.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          ref={areaRef}
          dir="rtl"
          rows={3}
          autoFocus
          className="text-base leading-relaxed"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter = تأیید و بستن؛ Shift+Enter = خط جدید
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              confirm()
            }
          }}
          placeholder="مثلاً: بسم الله الرحمن الرحیم"
          aria-label="متن"
        />

        <div className="flex items-center gap-2">
          <Button variant="ghost" className="flex-1" onClick={closeTextDialog}>
            انصراف
          </Button>
          <Button className="flex-1" disabled={!canConfirm} onClick={confirm}>
            {isEditing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {isEditing ? "ذخیره" : "افزودن"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
