'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useRef } from 'react'
import TurndownService from 'turndown'
import { marked } from 'marked'
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
  // Use marked for proper markdown → HTML conversion
  // marked.parse can return string or Promise<string>; we use sync mode
  const result = marked.parse(md, { async: false }) as string
  return result
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

  return (
    <div
      data-testid="tiptap-editor"
      className={cn(
        'tiptap-editor rounded-node border border-transparent',
        'focus-within:border-accent/50 transition-colors',
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
