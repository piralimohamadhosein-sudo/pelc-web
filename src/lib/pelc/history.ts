/**
 * تاریخچهٔ ویرایش سند — پورت مستقیم EditorHistory.kt نسخهٔ اندروید.
 *
 * پایه: عکس‌فوری کامل سند (مدل سند تغییرناپذیر است، پس عکس‌فوری ارزان است) +
 * «حالت آغازین + فهرست گام‌ها»:
 *  - undo فقط مکان‌نما را عقب می‌برد؛ بازگشت تا سند آغازین همیشه ممکن است.
 *  - گام‌های پیاپی هم‌نوع (تایپ، جابه‌جایی) با coalesceKey به یک گام ادغام می‌شوند.
 *  - باید ۵۰۰ عمل متوالی را بی‌خطا پشتیبانی کند (معیار پذیرش پروژه).
 */

import type { PelcDocument } from "./model"

export interface HistoryStep {
  label: string
  document: PelcDocument
}

export const DEFAULT_CAPACITY = 500
export const DEFAULT_COALESCE_MS = 1200

export class EditorHistory {
  private readonly base: PelcDocument
  private steps: HistoryStep[] = []
  private cursor = -1

  private lastCoalesceKey: string | null = null
  private lastCommitAt = 0

  /** شمارندهٔ تغییرات برای مشاهده‌گرها */
  version = 0

  constructor(
    initial: PelcDocument,
    private readonly capacity: number = DEFAULT_CAPACITY,
    private readonly clock: () => number = () => Date.now(),
  ) {
    this.base = initial
  }

  /** سند جاری بنا بر مکان‌نمای تاریخچه */
  get current(): PelcDocument {
    return this.cursor < 0 ? this.base : this.steps[this.cursor].document
  }

  get canUndo(): boolean {
    return this.cursor >= 0
  }

  get canRedo(): boolean {
    return this.cursor < this.steps.length - 1
  }

  get stepCount(): number {
    return this.steps.length
  }

  /** ۰ یعنی سند آغازین، stepCount یعنی آخرین گام */
  get position(): number {
    return this.cursor + 1
  }

  /** برچسب گام‌ها به ترتیب قدیم به جدید */
  labels(): string[] {
    return this.steps.map((s) => s.label)
  }

  /** فهرست کامل گام‌ها برای شیت تاریخچه */
  stepList(): HistoryStep[] {
    return [...this.steps]
  }

  /**
   * اعمال یک ویرایش. اگر coalesceKey داده شده و گام قبلی هم‌نوع و در بازهٔ
   * زمانی مجاور باشد، گام قبلی درجا به‌روز می‌شود (ادغام گام‌های تایپ).
   */
  apply(
    next: PelcDocument,
    label: string,
    coalesceKey: string | null = null,
    coalesceWindowMs: number = DEFAULT_COALESCE_MS,
  ): PelcDocument {
    const now = this.clock()
    const coalesce =
      coalesceKey !== null &&
      coalesceKey === this.lastCoalesceKey &&
      this.cursor >= 0 &&
      this.steps[this.cursor].label === label &&
      now - this.lastCommitAt <= coalesceWindowMs

    if (coalesce) {
      this.steps[this.cursor] = { label, document: next }
    } else {
      this.truncateRedo()
      this.steps.push({ label, document: next })
      if (this.steps.length > this.capacity) this.steps.shift()
      this.cursor = this.steps.length - 1
    }
    this.lastCoalesceKey = coalesceKey
    this.lastCommitAt = now
    this.version++
    return this.current
  }

  /** ثبت صریح یک وضعیت (مثلاً پایان کشیدن لایه روی بوم) */
  push(next: PelcDocument, label: string): PelcDocument {
    this.truncateRedo()
    this.steps.push({ label, document: next })
    if (this.steps.length > this.capacity) this.steps.shift()
    this.cursor = this.steps.length - 1
    this.lastCoalesceKey = null
    this.version++
    return this.current
  }

  undo(): PelcDocument | null {
    if (!this.canUndo) return null
    this.cursor--
    this.version++
    return this.current
  }

  redo(): PelcDocument | null {
    if (!this.canRedo) return null
    this.cursor++
    this.version++
    return this.current
  }

  /** پرش به گام [index]؛ -۱ یعنی سند آغازین */
  jumpTo(index: number): PelcDocument {
    if (!(index >= -1 && index <= this.steps.length - 1)) {
      throw new Error(`step index out of range: ${index}`)
    }
    this.cursor = index
    this.version++
    return this.current
  }

  private truncateRedo() {
    if (this.cursor < this.steps.length - 1) {
      this.steps = this.steps.slice(0, this.cursor + 1)
    }
  }
}
