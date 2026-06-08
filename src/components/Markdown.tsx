import { marked } from 'marked'

export function Markdown({ md }: { md: string }) {
  const html = marked.parse(md) as string
  return <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
