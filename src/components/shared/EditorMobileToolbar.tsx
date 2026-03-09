'use client'

import { useState, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Heading2, List, ListOrdered,
  Code, Quote, IndentIncrease, IndentDecrease, ChevronDown,
} from 'lucide-react'

interface EditorMobileToolbarProps {
  editor: Editor
}

export function EditorMobileToolbar({ editor }: EditorMobileToolbarProps) {
  const [bottomOffset, setBottomOffset] = useState(0)

  // Track visual viewport to position above keyboard
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const handleResize = () => {
      // Calculate the distance from viewport bottom to window bottom (= keyboard height)
      const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop
      setBottomOffset(Math.max(0, keyboardHeight))
    }

    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)
    handleResize()

    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
    }
  }, [])

  const actions = [
    {
      icon: Bold, label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      icon: Italic, label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      icon: Heading2, label: 'Heading',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      icon: List, label: 'Bullet List',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered, label: 'Ordered List',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      icon: Code, label: 'Code Block',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive('codeBlock'),
    },
    {
      icon: Quote, label: 'Blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
    {
      icon: IndentIncrease, label: 'Indent',
      action: () => editor.chain().focus().sinkListItem('listItem').run(),
      isActive: () => false,
      disabled: () => !editor.can().sinkListItem('listItem'),
    },
    {
      icon: IndentDecrease, label: 'Outdent',
      action: () => editor.chain().focus().liftListItem('listItem').run(),
      isActive: () => false,
      disabled: () => !editor.can().liftListItem('listItem'),
    },
  ]

  return (
    <div
      className="editor-mobile-toolbar fixed left-0 right-0 z-50 bg-surface border-t border-border flex items-center px-1 overflow-x-auto"
      style={{ bottom: `${bottomOffset}px`, height: '44px' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 flex-nowrap">
        {actions.map((item) => {
          const Icon = item.icon
          const active = item.isActive()
          const disabled = item.disabled?.() ?? false
          return (
            <button
              key={item.label}
              onClick={(e) => {
                e.preventDefault()
                item.action()
              }}
              disabled={disabled}
              className={`min-w-[40px] h-[36px] flex items-center justify-center rounded-md transition-colors ${
                active
                  ? 'bg-accent/10 text-accent'
                  : disabled
                  ? 'text-text-tertiary/40'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
              aria-label={item.label}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>

      {/* Dismiss keyboard button -- pushed to the right */}
      <button
        onClick={() => editor.commands.blur()}
        className="ml-auto min-w-[40px] h-[36px] flex items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover"
        aria-label="Dismiss keyboard"
      >
        <ChevronDown size={18} />
      </button>
    </div>
  )
}
