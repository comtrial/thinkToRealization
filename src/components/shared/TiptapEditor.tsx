'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef } from 'react'
import TurndownService from 'turndown'
import { cn } from '@/lib/utils'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

interface TiptapEditorProps {
  content: string
  onUpdate: (markdown: string) => void
  placeholder?: string
  className?: string
}

function htmlFromMarkdown(md: string): string {
  // Simple markdown-to-HTML for initial content loading
  // Tiptap's StarterKit input rules handle live editing
  let html = md
    // Code blocks (must be before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  // Wrap in paragraph if not already structured
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`
  }

  return html
}

export function TiptapEditor({ content, onUpdate, placeholder, className }: TiptapEditorProps) {
  const isInternalUpdate = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || '내용을 입력하세요...',
      }),
    ],
    content: content ? htmlFromMarkdown(content) : '',
    editorProps: {
      attributes: {
        class: 'tiptap-content outline-none min-h-[120px] p-3',
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true
      const html = ed.getHTML()
      const md = turndown.turndown(html)
      onUpdate(md)
    },
  })

  // Update editor content when content prop changes externally (e.g., node switch)
  // We use key prop on the parent to handle this instead of syncing

  return (
    <div
      data-testid="tiptap-editor"
      className={cn(
        'tiptap-editor rounded-node border border-border bg-surface',
        'hover:border-accent/50 transition-colors',
        'max-h-[400px] overflow-y-auto',
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
