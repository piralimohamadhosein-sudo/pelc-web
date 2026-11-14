/**
 * استور ویرایشگر پلک — معماری UDF مانند EditorViewModel.kt اندروید:
 * هر تغییر سند از طریق تاریخچه (EditorHistory) می‌گذرد؛ کشیدن لایه روی بوم
 * به‌صورت زنده (بدون تاریخچه) پیش‌نمایش می‌شود و در پایان یک‌جا ثبت می‌گردد.
 */

"use client"

import { create } from "zustand"
import {
  defaultLetterOverride,
  findLayer,
  isDefaultOverride,
  LETTER_FORM_TITLES,
  newId,
  newDocument,
  newLayer,
  normalizeLetterForm,
  withLayer,
  type Layer,
  type LetterForm,
  type LetterOverride,
  type MarkType,
  type PelcDocument,
} from "./model"
import { measureWordPositions, slicePerLetter, tokenizeWords } from "./measure"
import {
  insertKashidaBefore,
  insertMarkAfter,
  letterClusters,
  MAX_KASHIDA_BEFORE,
  reconcilePerLetter,
  remapPerLetter,
  removeKashidaBefore,
  removeMarkAt,
  type LetterCluster,
  type TextMutation,
} from "./arabicText"
import { EditorHistory, DEFAULT_CAPACITY } from "./history"
import { PELC_FONTS } from "./fonts"

const PELC_FONT_IDS = new Set(PELC_FONTS.map((f) => f.id))

export type PanelTab = "layers" | "word" | "letter" | "kashida" | "marks" | "history"

interface EditorState {
  /** سند جاری */
  doc: PelcDocument
  /** نسخهٔ تاریخچه برای رندر مجدد (خود تاریخچه بیرون از استور است) */
  historyVersion: number
  stepCount: number
  position: number
  canUndo: boolean
  canRedo: boolean
  labels: string[]
  /** شناسهٔ لایهٔ انتخاب‌شده */
  selectedLayerId: string | null
  /** اندیس UTF-16 آغازِ کلاستر حرف انتخاب‌شده (یا null) */
  selectedClusterStart: number | null
  activeTab: PanelTab
  /** پیام آزمون استرس تاریخچه */
  stressResult: string | null
  /** ضریب نمایش فعلی بوم (برای اندازه‌گیری‌های DOM) */
  viewScale: number

  /* --- انتخاب --- */
  selectLayer: (id: string) => void
  selectLetter: (clusterStart: number | null) => void
  setActiveTab: (tab: PanelTab) => void
  setViewScale: (scale: number) => void

  /* --- تاریخچه --- */
  undo: () => void
  redo: () => void
  jumpTo: (index: number) => void
  runStressTest: () => void

  /* --- ویرایش سند --- */
  commit: (next: PelcDocument, label: string, coalesceKey?: string) => void
  beginLiveUpdate: (next: PelcDocument) => void
  commitLiveUpdate: (label: string) => void

  addLayer: () => void
  deleteLayer: (id: string) => void
  duplicateLayer: (id: string) => void

  /** تبدیل جملهٔ لایه به لایه‌های تک‌کلمه‌ای در همان جای فعلی */
  splitLayerIntoWords: (id: string) => boolean
  /** تکان‌دادن ریز لایهٔ انتخاب‌شده (جهت‌نماها) */
  nudgeSelectedLayer: (dx: number, dy: number) => void

  setLayerText: (text: string) => void
  setLayerFont: (fontId: string) => void
  setLayerFontSize: (size: number) => void
  setLayerColor: (argb: number) => void
  setLayerOpacity: (opacity: number) => void
  setLayerVisibility: (visible: boolean) => void
  setFillMode: (mode: Layer["style"]["fillMode"]) => void
  setStrokeWidth: (w: number) => void
  setGold: (enabled: boolean) => void
  setShadow: (enabled: boolean) => void
  setTransform: (t: Partial<Layer["transform"]>) => void
  setDocTitle: (title: string) => void
  setBackground: (color: number, transparent?: boolean) => void
  resetDocument: () => void

  /* --- ویرایش حرف --- */
  setLetterVariant: (tag: string | null) => void
  setLetterForm: (form: LetterForm) => void
  setLetterFont: (fontId: string | null) => void
  insertKashida: () => void
  removeKashida: () => void
  addMark: (type: MarkType) => void
  removeMark: (markIndex: number) => void

  /* --- کمکی‌ها --- */
  clusters: () => LetterCluster[]
}

/** تاریخچه بیرون از استور نگه داشته می‌شود (عکس‌فوری‌ها عمق‌نمایی نمی‌خواهند) */
let history: EditorHistory | null = null
let liveDoc: PelcDocument | null = null

function ensureHistory(initial: PelcDocument): EditorHistory {
  if (!history) history = new EditorHistory(initial, DEFAULT_CAPACITY)
  return history
}

/** اعمال سند تازه از تاریخچه + حفظ انتخاب‌های معتبر */
function syncFromHistory(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  doc: PelcDocument,
) {
  const h = history!
  const sel = get().selectedLayerId
  const layer = doc.layers.some((l) => l.id === sel) ? sel : (doc.layers[0]?.id ?? null)
  const keepStart = get().selectedClusterStart
  let nextStart = keepStart
  if (keepStart !== null) {
    const l = doc.layers.find((x) => x.id === layer)
    const text = l?.text?.text ?? ""
    if (!l?.text || !letterClusters(text).some((c) => c.start === keepStart)) nextStart = null
  }
  set({
    doc,
    historyVersion: h.version,
    stepCount: h.stepCount,
    position: h.position,
    canUndo: h.canUndo,
    canRedo: h.canRedo,
    labels: h.labels(),
    selectedLayerId: layer,
    selectedClusterStart: nextStart,
  })
}

function markChar(type: MarkType): string {
  const table: Record<MarkType, string> = {
    FATHA: "\u064E",
    DAMMA: "\u064F",
    KASRA: "\u0650",
    SHADDA: "\u0651",
    SUKUN: "\u0652",
    FATHATAN: "\u064B",
    DAMMATAN: "\u064C",
    KASRATAN: "\u064D",
  }
  return table[type]
}

function markTitle(type: MarkType): string {
  const table: Record<MarkType, string> = {
    FATHA: "فتحه",
    DAMMA: "ضمه",
    KASRA: "کسره",
    SHADDA: "تشدید",
    SUKUN: "سکون",
    FATHATAN: "تنوین فتح",
    DAMMATAN: "تنوین ضم",
    KASRATAN: "تنوین کسر",
  }
  return table[type]
}

export const useEditorStore = create<EditorState>((set, get) => {
  // قلاب آزمون مرورگری: دسترسی مستقیم استور در کنسول برای عیب‌یابی
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__pelcStore = useEditorStore
  }
  /** اعمال جهش متن با بازنگاشت perLetter و پیگیری انتخاب حرف */
  const commitTextMutation = (mutation: TextMutation, label: string, extraPerLetter?: Record<string, LetterOverride>) => {
    const state = get()
    const layer = findLayer(state.doc, state.selectedLayerId)
    if (!layer?.text) return
    const base = extraPerLetter ?? layer.text.perLetter
    const perLetter = remapPerLetter(base, mutation)
    const next = withLayer(state.doc, layer.id, (l) => ({
      ...l,
      text: { ...l.text!, text: mutation.newText, perLetter },
    }))
    const keepStart = state.selectedClusterStart
    state.commit(next, label)
    if (keepStart !== null) {
      const mapped = keepStart >= mutation.shiftFrom ? keepStart + mutation.delta : keepStart
      const clusters = letterClusters(mutation.newText)
      if (clusters.some((c) => c.start === mapped)) {
        set({ selectedClusterStart: mapped })
      }
    }
  }

  const initialDoc = newDocument()
  history = new EditorHistory(initialDoc, DEFAULT_CAPACITY)

  return {
    doc: initialDoc,
    historyVersion: 0,
    stepCount: 0,
    position: 0,
    canUndo: false,
    canRedo: false,
    labels: [],
    selectedLayerId: initialDoc.layers[0]?.id ?? null,
    selectedClusterStart: null,
    activeTab: "word",
    stressResult: null,
    viewScale: 0.12,

    selectLayer: (id) => set({ selectedLayerId: id, selectedClusterStart: null }),
    selectLetter: (clusterStart) => set({ selectedClusterStart: clusterStart }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setViewScale: (scale) => set({ viewScale: scale }),

    undo: () => {
      const h = ensureHistory(get().doc)
      const doc = h.undo()
      if (doc) syncFromHistory(set, get, doc)
    },
    redo: () => {
      const h = ensureHistory(get().doc)
      const doc = h.redo()
      if (doc) syncFromHistory(set, get, doc)
    },
    jumpTo: (index) => {
      const h = ensureHistory(get().doc)
      const doc = h.jumpTo(index)
      syncFromHistory(set, get, doc)
    },
    runStressTest: () => {
      // معیار پذیرش پروژه: ۵۰۰ عمل متوالی بدون خطا + واگرد تا سند آغازین
      const h = ensureHistory(get().doc)
      let doc = get().doc
      const layerId = doc.layers[0]?.id
      if (!layerId) {
        set({ stressResult: "سند بدون لایه است" })
        return
      }
      try {
        const t0 = performance.now()
        for (let i = 0; i < 500; i++) {
          const kashida = "\u0640".repeat((i % 3) + 1)
          const next = withLayer(doc, layerId, (cur) => ({
            ...cur,
            text: { ...cur.text!, text: `آزمونِ تاریخچه ${i + 1}${kashida}` },
          }))
          doc = h.apply(next, `گام آزمون ${i + 1}`)
        }
        const elapsed = Math.round(performance.now() - t0)
        syncFromHistory(set, get, doc)
        // بررسی واگرد کامل
        let ok = true
        for (let i = 0; i < 500; i++) {
          const d = h.undo()
          if (d === null) { ok = false; break }
        }
        const backToBase = h.current === h["base"] || h.position === 0
        set({
          stressResult: `موفق: ۵۰۰ گام در ${elapsed} میلی‌ثانیه ثبت شد (ظرفیت ${DEFAULT_CAPACITY}). واگرد کامل تا سند آغازین: ${ok && backToBase ? "بله" : "خیر"}`,
        })
        // بازگشت به آخرین وضعیت
        for (let i = 0; i < 500; i++) {
          if (!h.redo()) break
        }
        syncFromHistory(set, get, h.current)
      } catch (e) {
        set({ stressResult: `خطا: ${e instanceof Error ? e.message : String(e)}` })
      }
    },

    commit: (next, label, coalesceKey) => {
      const h = ensureHistory(next)
      const doc = h.apply(next, label, coalesceKey ?? null)
      syncFromHistory(set, get, doc)
    },
    beginLiveUpdate: (next) => {
      liveDoc = next
      set({ doc: next })
    },
    commitLiveUpdate: (label) => {
      if (!liveDoc) return
      const h = ensureHistory(liveDoc)
      const doc = h.push(liveDoc, label)
      liveDoc = null
      syncFromHistory(set, get, doc)
    },

    addLayer: () => {
      const state = get()
      const layer = newLayer(`لایهٔ ${state.doc.layers.length + 1}`)
      const next: PelcDocument = { ...state.doc, layers: [...state.doc.layers, layer] }
      state.commit(next, "افزودن لایه")
      set({ selectedLayerId: layer.id, selectedClusterStart: null, activeTab: "word" })
    },
    deleteLayer: (id) => {
      const state = get()
      if (state.doc.layers.length <= 1) return
      const next: PelcDocument = { ...state.doc, layers: state.doc.layers.filter((l) => l.id !== id) }
      state.commit(next, "حذف لایه")
    },
    duplicateLayer: (id) => {
      const state = get()
      const src = state.doc.layers.find((l) => l.id === id)
      if (!src) return
      const copy: Layer = JSON.parse(JSON.stringify(src))
      copy.id = `${src.id}-copy-${Date.now()}`
      copy.name = `${src.name} (کپی)`
      const idx = state.doc.layers.findIndex((l) => l.id === id)
      const layers = [...state.doc.layers]
      layers.splice(idx + 1, 0, copy)
      state.commit({ ...state.doc, layers }, "تکثیر لایه")
      set({ selectedLayerId: copy.id, selectedClusterStart: null })
    },

    splitLayerIntoWords: (id) => {
      const state = get()
      const layer = findLayer(state.doc, id)
      if (!layer?.text) return false
      const tokens = tokenizeWords(layer.text.text)
      if (tokens.length < 2) return false
      const boxes = measureWordPositions(layer, state.viewScale)
      if (!boxes) return false

      const wordLayers: Layer[] = tokens.map((tk, i) => {
        const copy: Layer = JSON.parse(JSON.stringify(layer))
        copy.id = newId()
        copy.name = `کلمه: ${tk.token.slice(0, 16)}`
        copy.text = {
          ...layer.text!,
          text: tk.token,
          perLetter: slicePerLetter(layer.text!.perLetter, tk.rawStart, tk.token.length),
        }
        copy.transform = {
          ...layer.transform,
          tx: Math.round(layer.transform.tx + boxes[i].x),
          ty: Math.round(layer.transform.ty + boxes[i].y),
        }
        return copy
      })

      const idx = state.doc.layers.findIndex((l) => l.id === id)
      const layers = [...state.doc.layers]
      layers.splice(idx, 1, ...wordLayers)
      state.commit({ ...state.doc, layers }, "تبدیل جمله به کلماتِ مستقل")
      set({ selectedLayerId: wordLayers[0].id, selectedClusterStart: null })
      return true
    },

    nudgeSelectedLayer: (dx, dy) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        transform: { ...l.transform, tx: l.transform.tx + dx, ty: l.transform.ty + dy },
      }))
      state.commit(next, "تکان‌دادن لایه", `nudge:${layer.id}`)
    },

    setLayerText: (text) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer?.text) return
      const perLetter = reconcilePerLetter(text, layer.text.perLetter)
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        text: { ...l.text!, text, perLetter },
      }))
      state.commit(next, "ویرایش متن", `text:${layer.id}`)
    },
    setLayerFont: (fontId) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer || !PELC_FONT_IDS.has(fontId)) return
      const next = withLayer(state.doc, layer.id, (l) =>
        l.text ? { ...l, text: { ...l.text, fontId } } : l,
      )
      state.commit(next, "تغییر قلم")
    },
    setLayerFontSize: (size) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) =>
        l.text ? { ...l, text: { ...l.text, fontSize: size } } : l,
      )
      state.commit(next, "اندازهٔ قلم", `size:${layer.id}`)
    },
    setLayerColor: (argb) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        style: { ...l.style, color: argb },
        text: l.text ? { ...l.text, color: argb } : l.text,
      }))
      state.commit(next, "رنگ لایه")
    },
    setLayerOpacity: (opacity) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, opacity }))
      state.commit(next, "شفافیت لایه", `opacity:${layer.id}`)
    },
    setLayerVisibility: (visible) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, visible }))
      state.commit(next, visible ? "نمایش لایه" : "پنهان‌کردن لایه")
    },
    setFillMode: (mode) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, style: { ...l.style, fillMode: mode } }))
      state.commit(next, "حالت پرکردن")
    },
    setStrokeWidth: (w) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, style: { ...l.style, strokeWidth: w } }))
      state.commit(next, "ضخامت خط دور", `stroke:${layer.id}`)
    },
    setGold: (enabled) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        style: {
          ...l.style,
          fillMode: enabled ? "GOLD" : l.style.fillMode === "GOLD" ? "SOLID" : l.style.fillMode,
          gold: { enabled, innerColor: 0xffffd700, outerColor: 0xff8a5a00 },
        },
      }))
      state.commit(next, enabled ? "افکت طلایی روشن" : "افکت طلایی خاموش")
    },
    setShadow: (enabled) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        style: { ...l.style, shadow: enabled ? { radius: 24, dx: 0, dy: 12, color: 0x66000000 } : null },
      }))
      state.commit(next, enabled ? "سایه روشن" : "سایه خاموش")
    },
    setTransform: (t) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, transform: { ...l.transform, ...t } }))
      state.commit(next, "جابه‌جایی لایه", `move:${layer.id}`)
    },
    setDocTitle: (title) => {
      const state = get()
      state.commit({ ...state.doc, title }, "عنوان سند", "doc-title")
    },
    setBackground: (color, transparent) => {
      const state = get()
      const next: PelcDocument = {
        ...state.doc,
        background: { color, transparent: transparent ?? state.doc.background.transparent },
      }
      state.commit(next, "پس‌زمینهٔ سند")
    },
    resetDocument: () => {
      const doc = newDocument()
      history = new EditorHistory(doc, DEFAULT_CAPACITY)
      liveDoc = null
      set({
        doc,
        historyVersion: 0,
        stepCount: 0,
        position: 0,
        canUndo: false,
        canRedo: false,
        labels: [],
        selectedLayerId: doc.layers[0]?.id ?? null,
        selectedClusterStart: null,
        activeTab: "word",
        stressResult: null,
      })
    },

    setLetterVariant: (tag) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const key = String(start)
      const existing: LetterOverride = layer.text.perLetter[key] ?? defaultLetterOverride()
      const updated: LetterOverride = { ...existing, variantTag: tag }
      const perLetter = { ...layer.text.perLetter }
      if (tag === null && isDefaultOverride(updated)) {
        delete perLetter[key]
      } else {
        perLetter[key] = updated
      }
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, text: { ...l.text!, perLetter } }))
      state.commit(next, tag ? `گونهٔ ${tag} روی حرف` : "حذف گونهٔ حرف")
    },
    setLetterForm: (form) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const key = String(start)
      const existing: LetterOverride = layer.text.perLetter[key] ?? defaultLetterOverride()
      const updated: LetterOverride = { ...existing, formOverride: form === "AUTO" ? null : normalizeLetterForm(form) }
      const perLetter = { ...layer.text.perLetter }
      if (isDefaultOverride(updated)) delete perLetter[key]
      else perLetter[key] = updated
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, text: { ...l.text!, perLetter } }))
      state.commit(next, form === "AUTO" ? "بازگشت فرم حرف به خودکار" : `فرم حرف: ${LETTER_FORM_TITLES[form]}`)
    },
    setLetterFont: (fontId) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      if (fontId !== null && !PELC_FONT_IDS.has(fontId)) return
      const key = String(start)
      const existing: LetterOverride = layer.text.perLetter[key] ?? defaultLetterOverride()
      const updated: LetterOverride = { ...existing, fontId }
      const perLetter = { ...layer.text.perLetter }
      if (isDefaultOverride(updated)) delete perLetter[key]
      else perLetter[key] = updated
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, text: { ...l.text!, perLetter } }))
      state.commit(next, fontId ? "قلمِ این حرف" : "حذف قلمِ اختصاصی حرف")
    },
    insertKashida: () => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const cluster = letterClusters(layer.text.text).find((c) => c.start === start)
      if (!cluster) return
      if (cluster.kashidaBefore >= MAX_KASHIDA_BEFORE) return
      const mutation = insertKashidaBefore(layer.text.text, start)
      if (!mutation) return
      commitTextMutation(mutation, "درج کشیده")
    },
    removeKashida: () => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const mutation = removeKashidaBefore(layer.text.text, start)
      if (!mutation) return
      commitTextMutation(mutation, "حذف کشیده")
    },
    addMark: (type) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const mutation = insertMarkAfter(layer.text.text, start, markChar(type))
      if (!mutation) return
      // رکورد تنظیم علامت در perLetter.marks ثبت می‌شود (سازگار با مدل اندروید)
      const key = String(start)
      const existing = layer.text.perLetter[key] ?? defaultLetterOverride()
      const perLetter0 = {
        ...layer.text.perLetter,
        [key]: { ...existing, marks: [...existing.marks, { type, dx: 0, dy: 0, scale: 1 }] },
      }
      commitTextMutation(mutation, `افزودن ${markTitle(type)}`, perLetter0)
    },
    removeMark: (markIndex) => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      const start = state.selectedClusterStart
      if (!layer?.text || start === null) return
      const mutation = removeMarkAt(layer.text.text, start, markIndex)
      if (!mutation) return
      const key = String(start)
      const existing = layer.text.perLetter[key]
      const perLetter0 = { ...layer.text.perLetter }
      if (existing) {
        const updated = { ...existing, marks: existing.marks.filter((_, i) => i !== markIndex) }
        if (isDefaultOverride(updated)) delete perLetter0[key]
        else perLetter0[key] = updated
      }
      commitTextMutation(mutation, "حذف علامت", perLetter0)
    },

    clusters: () => {
      const state = get()
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer?.text) return []
      return letterClusters(layer.text.text)
    },
  }
})
