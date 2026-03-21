'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useMobile } from '@/hooks/useMobile'
import { EditorMobileToolbar } from './EditorMobileToolbar'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

// Table support for turndown (HTML → Markdown)
// Tiptap produces <table><tbody><tr><th>...</th></tr><tr><td>...</td></tr></tbody></table>
// (no <thead>), so we detect th cells in rows to insert the separator line
turndown.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement: (content) => ` ${content.trim().replace(/\n/g, ' ')} |`,
})
turndown.addRule('tableRow', {
  filter: 'tr',
  replacement: function (content, node) {
    const row = `|${content}\n`
    // If this row contains <th> cells, add separator after it
    const hasTh = node.querySelector?.('th')
    if (hasTh) {
      const cellCount = node.querySelectorAll?.('th, td')?.length || 0
      return `${row}|${' --- |'.repeat(cellCount)}\n`
    }
    return row
  },
})
turndown.addRule('tableSection', {
  filter: ['thead', 'tbody', 'tfoot'],
  replacement: (content) => content,
})
turndown.addRule('table', {
  filter: 'table',
  replacement: (content) => `\n${content.trim()}\n\n`,
})

interface TiptapEditorProps {
  content: string
  onUpdate: (markdown: string) => void
  onBlurSave?: () => void
  placeholder?: string
  className?: string
  editorRef?: React.MutableRefObject<Editor | null>
}

function htmlFromMarkdown(md: string): string {
  const result = marked.parse(md, { async: false }) as string
  return result
}

export function TiptapEditor({ content, onUpdate, onBlurSave, placeholder, className, editorRef }: TiptapEditorProps) {
  const isInternalUpdate = useRef(false)
  const [isFocused, setIsFocused] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useMobile()

  // Use refs for callbacks so Tiptap always calls the latest version
  const onUpdateRef = useRef(onUpdate)
  const onBlurSaveRef = useRef(onBlurSave)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onBlurSaveRef.current = onBlurSave }, [onBlurSave])

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false)
      onBlurSaveRef.current?.()
    }, 150)
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || '내용을 입력하세요...',
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
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
      onUpdateRef.current(md)
    },
    onFocus: handleFocus,
    onBlur: handleBlur,
  })

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

  // Clean up blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

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
      {isMobile && editor && isFocused && (
        <EditorMobileToolbar editor={editor} />
      )}
    </div>
  )
}
