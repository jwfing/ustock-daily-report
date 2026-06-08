// kami · 紙 candlestick mark — stone down-candle, ink-blue up-candles, ascending.
// Tokens mirror tailwind.config.js (ink #1B365D, stone #6b6a64). Coords divisible by 4.
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      {/* down candle (stone) */}
      <line x1="8" y1="12" x2="8" y2="26" stroke="#6b6a64" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="16" width="4" height="8" rx="1" fill="#6b6a64" />
      {/* up candle (ink) */}
      <line x1="16" y1="6" x2="16" y2="26" stroke="#1B365D" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="10" width="4" height="12" rx="1" fill="#1B365D" />
      {/* up candle (ink) */}
      <line x1="24" y1="2" x2="24" y2="20" stroke="#1B365D" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="22" y="4" width="4" height="12" rx="1" fill="#1B365D" />
    </svg>
  )
}
