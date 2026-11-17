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

/** کلید localStorage برای فونت‌های ستاره‌دار (علاقه‌مندی) */
const FAVORITES_KEY = "pelc-favorite-fonts"

export type PanelTab = "word" | "letter" | "kashida" | "marks" | "history"

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
  /** شناسهٔ لایهٔ انتخاب‌شده (انتخاب اصلی — پنل‌ها با همین کار می‌کنند) */
  selectedLayerId: string | null
  /** انتخاب چندگانه: شناسهٔ همهٔ لایه‌های انتخاب‌شده (خالی = انتخاب تکی) */
  selectedLayerIds: string[]
  /** اندیس UTF-16 آغازِ کلاستر حرف انتخاب‌شده (یا null) */
  selectedClusterStart: number | null
  activeTab: PanelTab
  /** پیام آزمون استرس تاریخچه */
  stressResult: string | null
  /** ضریب نمایش فعلی بوم (برای اندازه‌گیری‌های DOM) */
  viewScale: number
  /** فونت‌های ستاره‌دار (علاقه‌مندی کاربر) — بیرون از سند و تاریخچه */
  favoriteFontIds: string[]

  /* --- گفت‌وگوی افزودن/ویرایش متن (دکمهٔ «+») --- */
  /** باز بودن گفت‌وگوی متن */
  textDialogOpen: boolean
  /** لایهٔ در حال ویرایش در گفت‌وگو (null = افزودن لایهٔ تازه) */
  editingTextLayerId: string | null
  /** باز کردن گفت‌وگوی متن — با شناسه = ویرایش همان لایه، بدون شناسه = افزودن */
  openTextDialog: (editLayerId?: string | null) => void
  closeTextDialog: () => void

  /* --- انتخاب --- */
  selectLayer: (id: string) => void
  /** انتخاب همهٔ لایه‌ها برای جابه‌جایی گروهی راحت */
  selectAllLayers: () => void
  /** لغو انتخاب چندگانه */
  clearMultiSelect: () => void
  selectLetter: (clusterStart: number | null) => void
  setActiveTab: (tab: PanelTab) => void
  setViewScale: (scale: number) => void
  /** ستاره‌زدن/برداشتن ستارهٔ یک فونت */
  toggleFavoriteFont: (id: string) => void
  /** خواندن علاقه‌مندی‌ها از localStorage — فقط سمت مرورگر، یک‌بار هنگام راه‌اندازی */
  hydrateFavoriteFonts: () => void

  /* --- تاریخچه --- */
  undo: () => void
  redo: () => void
  jumpTo: (index: number) => void
  runStressTest: () => void

  /* --- ویرایش سند --- */
  commit: (next: PelcDocument, label: string, coalesceKey?: string) => void
  beginLiveUpdate: (next: PelcDocument) => void
  commitLiveUpdate: (label: string) => void

  /** افزودن لایهٔ متنی تازه با متن داده‌شده — در میانهٔ بوم؛ شناسهٔ لایه را برمی‌گرداند */
  addTextLayer: (text: string) => string | null
  /** افزودن لایهٔ عکس (عکس‌نوشته) — در پس‌زمینهٔ بوم، زیر همهٔ متن‌ها؛ پوشش کامل بوم */
  addImageLayer: (assetId: string, width: number, height: number) => void
  deleteLayer: (id: string) => void
  /** حذف همهٔ لایه‌های انتخاب‌شده (تکی یا انتخاب همه) در یک گام تاریخچه */
  deleteSelectedLayers: () => void
  duplicateLayer: (id: string) => void
  /** تغییر اندازهٔ بوم (صفحهٔ کار) — عرض/ارتفاع پیکسل و dpi؛ در محدودهٔ ۱۰۰ تا ۸۰۰۰ */
  setCanvasSize: (width: number, height: number, dpi?: number) => void

  /** تبدیل جملهٔ لایه به لایه‌های تک‌کلمه‌ای در همان جای فعلی */
  splitLayerIntoWords: (id: string, opts?: { auto?: boolean }) => boolean
  /** تکان‌دادن ریز لایهٔ انتخاب‌شده (جهت‌نماها) */
  nudgeSelectedLayer: (dx: number, dy: number) => void

  /** ویرایش متن یک لایه با شناسه (از گفت‌وگوی متن) */
  updateLayerText: (id: string, text: string) => void
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
  // حفظ انتخاب چندگانهٔ معتبر — شناسه‌های حذف‌شده کنار می‌روند
  const multi = get().selectedLayerIds.filter((id) => doc.layers.some((l) => l.id === id))
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
    selectedLayerIds: multi,
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
    selectedLayerIds: [],
    selectedClusterStart: null,
    activeTab: "word",
    stressResult: null,
    viewScale: 0.12,
    favoriteFontIds: [],

    // گفت‌وگوی افزودن/ویرایش متن — بسته به‌صورت پیش‌فرض
    textDialogOpen: false,
    editingTextLayerId: null,
    openTextDialog: (editLayerId) => set({ textDialogOpen: true, editingTextLayerId: editLayerId ?? null }),
    closeTextDialog: () => set({ textDialogOpen: false, editingTextLayerId: null }),

    selectLayer: (id) => set({ selectedLayerId: id, selectedClusterStart: null, selectedLayerIds: [] }),
    selectAllLayers: () => {
      // فقط متن‌ها انتخاب می‌شوند؛ عکس‌ها مستقل می‌مانند و در عمل گروهی نقشی ندارند
      const doc = get().doc
      const textIds = doc.layers.filter((l) => l.kind === "TEXT" && !l.locked).map((l) => l.id)
      const cur = get().selectedLayerId
      const curLayer = cur ? doc.layers.find((l) => l.id === cur) : undefined
      set({
        selectedLayerIds: textIds,
        // اگر لایهٔ تکی فعلی عکس است، در انتخاب‌همهٔ متنی باقی نمی‌ماند
        selectedLayerId: curLayer?.kind === "TEXT" ? cur : (textIds[0] ?? null),
        selectedClusterStart: null,
      })
    },
    clearMultiSelect: () => set({ selectedLayerIds: [] }),
    selectLetter: (clusterStart) => set({ selectedClusterStart: clusterStart }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setViewScale: (scale) => set({ viewScale: scale }),
    toggleFavoriteFont: (id) => {
      if (!PELC_FONT_IDS.has(id)) return
      const cur = get().favoriteFontIds
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
        } catch {
          /* حافظه در دسترس نیست (مثلاً حالت خصوصی) — فقط در حافظهٔ نشست */
        }
      }
      set({ favoriteFontIds: next })
    },
    hydrateFavoriteFonts: () => {
      if (typeof window === "undefined") return
      try {
        const raw = window.localStorage.getItem(FAVORITES_KEY)
        if (!raw) return
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return
        // فقط شناسه‌های معتبر مخزن قلم پذیرفته می‌شوند
        set({
          favoriteFontIds: parsed.filter(
            (x): x is string => typeof x === "string" && PELC_FONT_IDS.has(x),
          ),
        })
      } catch {
        /* دادهٔ خراب — نادیده گرفته می‌شود */
      }
    },

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
        const backToBase = h.position === 0
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

    addTextLayer: (text) => {
      const state = get()
      const trimmed = text.trim()
      if (!trimmed) return null
      const n = state.doc.layers.length
      const layer = newLayer(`متن ${n + 1}`)
      layer.text = { ...layer.text!, text: trimmed }
      // جای تقریبی: میانهٔ افقی بوم و یک‌سوم بالا — با پلهٔ مورب کوچک برای هر
      // لایهٔ موجود تا متن‌های پشت‌سرهم دقیقاً روی هم نیفتند؛ کاربر با کشیدن
      // یا تاچ‌پد دقیق می‌کند.
      const step = (n % 8) * 48
      layer.transform = {
        tx: Math.round(state.doc.canvas.width / 2 - 320 + step),
        ty: Math.round(state.doc.canvas.height / 2 - 120 + step),
        scaleX: 1,
        scaleY: 1,
        rotationDeg: 0,
      }
      const next: PelcDocument = { ...state.doc, layers: [...state.doc.layers, layer] }
      state.commit(next, "افزودن متن")
      set({ selectedLayerId: layer.id, selectedClusterStart: null, selectedLayerIds: [], activeTab: "word" })
      return layer.id
    },
    addImageLayer: (assetId, width, height) => {
      const state = get()
      const layer = newLayer("عکس")
      layer.kind = "IMAGE"
      layer.text = null
      layer.image = { assetId, width, height }
      // پوشش کامل بوم (cover) وسط‌چین — متن‌های آماده روی آن می‌نشینند؛
      // کاربر با کشیدن جابه‌جا و با دستگیره‌های گوشه بزرگ/کوچک می‌کند.
      const s = Math.max(state.doc.canvas.width / width, state.doc.canvas.height / height)
      layer.transform = {
        tx: Math.round((state.doc.canvas.width - width * s) / 2),
        ty: Math.round((state.doc.canvas.height - height * s) / 2),
        scaleX: s,
        scaleY: s,
        rotationDeg: 0,
      }
      // پایین‌ترین ترتیب — زیر همهٔ لایه‌های متنی تا متن روی عکس بیفتد
      const next: PelcDocument = { ...state.doc, layers: [layer, ...state.doc.layers] }
      state.commit(next, "افزودن عکس")
      set({ selectedLayerId: layer.id, selectedClusterStart: null, selectedLayerIds: [] })
    },
    deleteLayer: (id) => {
      const state = get()
      if (!state.doc.layers.some((l) => l.id === id)) return
      const next: PelcDocument = { ...state.doc, layers: state.doc.layers.filter((l) => l.id !== id) }
      state.commit(next, "حذف لایه")
      // اگر لایهٔ انتخاب‌شده حذف شد، انتخاب روی صفر می‌نشیند (سند می‌تواند کاملاً خالی شود)
      set({
        selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
        selectedLayerIds: state.selectedLayerIds.filter((x) => x !== id),
        selectedClusterStart: null,
      })
    },
    deleteSelectedLayers: () => {
      const state = get()
      const ids = new Set<string>(state.selectedLayerIds)
      if (state.selectedLayerId) ids.add(state.selectedLayerId)
      if (ids.size === 0) return
      const layers = state.doc.layers.filter((l) => !ids.has(l.id))
      if (layers.length === state.doc.layers.length) return
      state.commit({ ...state.doc, layers }, ids.size > 1 ? "حذف لایه‌ها" : "حذف لایه")
      set({ selectedLayerId: null, selectedClusterStart: null, selectedLayerIds: [] })
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
      set({ selectedLayerId: copy.id, selectedClusterStart: null, selectedLayerIds: [] })
    },

    splitLayerIntoWords: (id, opts) => {
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
      state.commit(
        { ...state.doc, layers },
        opts?.auto ? "جدا شدن خودکار کلمه‌های جمله" : "تبدیل جمله به کلماتِ مستقل",
      )
      set({ selectedLayerId: wordLayers[0].id, selectedClusterStart: null, selectedLayerIds: [] })
      return true
    },

    nudgeSelectedLayer: (dx, dy) => {
      const state = get()
      // انتخاب چندگانه فعال است: همه با هم تکان می‌خورند (یک گام تاریخچه)
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked
              ? { ...l, transform: { ...l.transform, tx: l.transform.tx + dx, ty: l.transform.ty + dy } }
              : l,
          ),
        }
        state.commit(next, "تکان‌دادن همهٔ لایه‌ها", "nudge:multi")
        return
      }
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({
        ...l,
        transform: { ...l.transform, tx: l.transform.tx + dx, ty: l.transform.ty + dy },
      }))
      state.commit(next, "تکان‌دادن لایه", `nudge:${layer.id}`)
    },

    updateLayerText: (id, text) => {
      const state = get()
      const layer = findLayer(state.doc, id)
      if (!layer?.text) return
      const perLetter = reconcilePerLetter(text, layer.text.perLetter)
      const next = withLayer(state.doc, id, (l) => ({
        ...l,
        text: { ...l.text!, text, perLetter },
      }))
      state.commit(next, "ویرایش متن", `text:${id}`)
    },
    setLayerFont: (fontId) => {
      const state = get()
      if (!PELC_FONT_IDS.has(fontId)) return
      // انتخاب چندگانه فعال است («انتخاب همه»): یک قلم روی همهٔ لایه‌های
      // انتخاب‌شده اعمال می‌شود؛ لایه‌های قفل‌شده و بی‌متن مستثنا هستند —
      // همان الگوی رنگ گروهی، یک گام تاریخچه با کلید ادغام.
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked && l.text ? { ...l, text: { ...l.text, fontId } } : l,
          ),
        }
        state.commit(next, "قلم همهٔ لایه‌های انتخاب‌شده", "font:multi")
        return
      }
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
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
      // انتخاب چندگانه فعال است («انتخاب همه»): یک رنگ روی همهٔ لایه‌های
      // انتخاب‌شده اعمال می‌شود؛ لایه‌های قفل‌شده مستثنا هستند — همان الگوی
      // تکان‌دادن گروهی، یک گام تاریخچه با کلید ادغام برای رنگ‌گیر پیوسته.
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked
              ? {
                  ...l,
                  style: { ...l.style, color: argb },
                  text: l.text ? { ...l.text, color: argb } : l.text,
                }
              : l,
          ),
        }
        state.commit(next, "رنگ همهٔ لایه‌های انتخاب‌شده", "color:multi")
        return
      }
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
      // انتخاب چندگانه فعال است («انتخاب همه»): حالت پرکردن روی همهٔ لایه‌های
      // انتخاب‌شده اعمال می‌شود؛ لایه‌های قفل‌شده مستثنا هستند.
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked ? { ...l, style: { ...l.style, fillMode: mode } } : l,
          ),
        }
        state.commit(next, "حالت پرکردن همهٔ لایه‌ها", "fill:multi")
        return
      }
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, style: { ...l.style, fillMode: mode } }))
      state.commit(next, "حالت پرکردن")
    },
    setStrokeWidth: (w) => {
      const state = get()
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked ? { ...l, style: { ...l.style, strokeWidth: w } } : l,
          ),
        }
        state.commit(next, "ضخامت خط دور همهٔ لایه‌ها", "stroke:multi")
        return
      }
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, (l) => ({ ...l, style: { ...l.style, strokeWidth: w } }))
      state.commit(next, "ضخامت خط دور", `stroke:${layer.id}`)
    },
    setGold: (enabled) => {
      const state = get()
      const applyGold = (l: Layer): Layer => ({
        ...l,
        style: {
          ...l.style,
          fillMode: enabled ? "GOLD" : l.style.fillMode === "GOLD" ? "SOLID" : l.style.fillMode,
          gold: { enabled, innerColor: 0xffffd700, outerColor: 0xff8a5a00 },
        },
      })
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) => (ids.has(l.id) && !l.locked ? applyGold(l) : l)),
        }
        state.commit(
          next,
          enabled ? "افکت طلایی همهٔ لایه‌ها روشن" : "افکت طلایی همهٔ لایه‌ها خاموش",
          "gold:multi",
        )
        return
      }
      const layer = findLayer(state.doc, state.selectedLayerId)
      if (!layer) return
      const next = withLayer(state.doc, layer.id, applyGold)
      state.commit(next, enabled ? "افکت طلایی روشن" : "افکت طلایی خاموش")
    },
    setShadow: (enabled) => {
      const state = get()
      if (state.selectedLayerIds.length > 1) {
        const ids = new Set(state.selectedLayerIds)
        const next: PelcDocument = {
          ...state.doc,
          layers: state.doc.layers.map((l) =>
            ids.has(l.id) && !l.locked
              ? {
                  ...l,
                  style: { ...l.style, shadow: enabled ? { radius: 24, dx: 0, dy: 12, color: 0x66000000 } : null },
                }
              : l,
          ),
        }
        state.commit(next, enabled ? "سایهٔ همهٔ لایه‌ها روشن" : "سایهٔ همهٔ لایه‌ها خاموش", "shadow:multi")
        return
      }
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
    setCanvasSize: (width, height, dpi) => {
      const state = get()
      const w = Math.min(8000, Math.max(100, Math.round(width)))
      const h = Math.min(8000, Math.max(100, Math.round(height)))
      const d = dpi === undefined ? state.doc.canvas.dpi : Math.min(1200, Math.max(36, Math.round(dpi)))
      if (w === state.doc.canvas.width && h === state.doc.canvas.height && d === state.doc.canvas.dpi) return
      const next: PelcDocument = { ...state.doc, canvas: { width: w, height: h, dpi: d } }
      state.commit(next, "اندازهٔ بوم")
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
        selectedLayerIds: [],
        selectedClusterStart: null,
        activeTab: "word",
        stressResult: null,
        textDialogOpen: false,
        editingTextLayerId: null,
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

// قلاب آزمون مرورگری: دسترسی مستقیم استور در کنسول برای عیب‌یابی.
// باید «بعد از» ساخت استور اجرا شود؛ نوشتنش داخل initializer تابع create
// به خطای «Cannot access 'useEditorStore' before initialization» می‌انجامد،
// چون create فراخوانِ initializer را پیش از پایان انتساب const اجرا می‌کند.
if (typeof window !== "undefined") {
  ;(window as unknown as Record<string, unknown>).__pelcStore = useEditorStore
}
