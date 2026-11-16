/**
 * شمسه — ستارهٔ هشت‌پرِ کاشی‌کاری ایرانی.
 * دو مربع چرخیده روی هم، نشانِ تکرارشوندهٔ هویت پلک در هدر، گفت‌وگوها و تاچ‌پد.
 * رنگ از currentColor می‌آید تا با هر زمینه‌ای هماهنگ شود.
 */
export function Shamsa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="7.2" y="7.2" width="9.6" height="9.6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="miter" />
      <rect
        x="7.2"
        y="7.2"
        width="9.6"
        height="9.6"
        transform="rotate(45 12 12)"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="miter"
      />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    </svg>
  )
}
