'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  compact?: boolean
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-text-primary mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-text-primary mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-body text-text-secondary mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside text-body text-text-secondary mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside text-body text-text-secondary mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-body">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-surface-hover rounded-node p-2 text-caption font-mono overflow-x-auto mb-2">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-surface-hover rounded px-1 py-0.5 text-caption font-mono text-accent">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-3 text-body text-text-tertiary mb-2">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-accent underline hover:opacity-80" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-caption border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface-hover px-2 py-1 text-left font-semibold text-text-primary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 text-text-secondary">{children}</td>
  ),
  hr: () => <hr className="border-border my-3" />,
}

const compactComponents: Components = {
  ...components,
  h1: ({ children }) => <span className="font-bold text-text-primary">{children}</span>,
  h2: ({ children }) => <span className="font-semibold text-text-primary">{children}</span>,
  h3: ({ children }) => <span className="font-semibold text-text-primary">{children}</span>,
  p: ({ children }) => <span className="text-caption text-text-secondary">{children} </span>,
  ul: ({ children }) => <span className="text-caption text-text-secondary">{children}</span>,
  ol: ({ children }) => <span className="text-caption text-text-secondary">{children}</span>,
  li: ({ children }) => <span className="text-caption">{children} </span>,
}

export function MarkdownRenderer({ content, compact = false }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={compact ? compactComponents : components}
    >
      {content}
    </ReactMarkdown>
  )
}
