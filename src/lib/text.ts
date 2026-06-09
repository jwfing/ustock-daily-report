// Estimate reading time from raw Markdown. Counts CJK characters (~400/min)
// and whitespace-delimited Latin words (~200/min) so mixed EN/ZH reports
// estimate sensibly in either language. Always at least 1 minute.
export function readingMinutes(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ') // drop code fences
    .replace(/[#>*_`~|-]+/g, ' ') // drop common Markdown punctuation
  const cjk = (text.match(/[一-鿿぀-ヿ]/g) ?? []).length
  const latin = (text.replace(/[一-鿿぀-ヿ]/g, ' ').match(/\b\w+\b/g) ?? []).length
  return Math.max(1, Math.round(cjk / 400 + latin / 200))
}
