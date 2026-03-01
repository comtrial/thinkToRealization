'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '@/stores/ui-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useNodeStore } from '@/stores/node-store'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { StatusDot } from '@/components/shared/Badge'
import {
  Search, Plus, LayoutGrid, Maximize, PlayCircle,
  SquareTerminal, PanelLeftClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeType, NodeStatus } from '@/lib/types/api'

export function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, setActiveTab, toggleSidebar } = useUIStore()
  const nodes = useCanvasStore((s) => s.nodes)
  const selectNode = useNodeStore((s) => s.selectNode)
  const [search, setSearch] = useState('')

  // Reset search when opening
  useEffect(() => {
    if (commandPaletteOpen) setSearch('')
  }, [commandPaletteOpen])

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      setActiveTab('canvas')
      toggleCommandPalette()
    },
    [selectNode, setActiveTab, toggleCommandPalette]
  )

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-surface-overlay"
        onClick={toggleCommandPalette}
      />
      {/* Palette */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[640px] px-4">
        <Command
          className={cn(
            'bg-surface rounded-palette border border-border shadow-elevation-3',
            'overflow-hidden'
          )}
          shouldFilter
        >
          <div className="flex items-center gap-2 px-4 border-b border-border">
            <Search size={16} className="text-text-tertiary flex-shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="무엇을 할까요?"
              className={cn(
                'flex-1 py-3 text-body text-text-primary bg-transparent',
                'focus:outline-none placeholder:text-text-tertiary'
              )}
              autoFocus
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-tertiary">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto py-2">
            <Command.Empty className="py-6 text-center text-caption text-text-tertiary">
              결과가 없습니다
            </Command.Empty>

            {/* Actions */}
            <Command.Group heading="액션" className="px-2">
              <CommandItem
                icon={<Plus size={14} />}
                label="새 노드 생성"
                shortcut="⌘N"
                onSelect={() => {
                  setActiveTab('canvas')
                  toggleCommandPalette()
                }}
              />
              <CommandItem
                icon={<LayoutGrid size={14} />}
                label="자동 정렬"
                shortcut="⌘L"
                onSelect={() => {
                  toggleCommandPalette()
                }}
              />
              <CommandItem
                icon={<Maximize size={14} />}
                label="줌 맞춤"
                shortcut="⌘0"
                onSelect={() => {
                  toggleCommandPalette()
                }}
              />
              <CommandItem
                icon={<PanelLeftClose size={14} />}
                label="사이드바 토글"
                shortcut="["
                onSelect={() => {
                  toggleSidebar()
                  toggleCommandPalette()
                }}
              />
              <CommandItem
                icon={<PlayCircle size={14} />}
                label="대시보드"
                shortcut="⌘1"
                onSelect={() => {
                  setActiveTab('dashboard')
                  toggleCommandPalette()
                }}
              />
              <CommandItem
                icon={<SquareTerminal size={14} />}
                label="캔버스"
                shortcut="⌘2"
                onSelect={() => {
                  setActiveTab('canvas')
                  toggleCommandPalette()
                }}
              />
            </Command.Group>

            {/* Node search results */}
            {nodes.length > 0 && (
              <Command.Group heading="노드" className="px-2">
                {nodes.map((node) => {
                  const d = node.data as Record<string, unknown>
                  return (
                    <Command.Item
                      key={node.id}
                      value={`${d.title} ${d.type} ${d.status}`}
                      onSelect={() => handleSelectNode(node.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-button',
                        'text-body text-text-primary',
                        'cursor-pointer',
                        'aria-selected:bg-surface-hover',
                        'outline-none'
                      )}
                    >
                      <NodeTypeIcon type={d.type as NodeType} size={14} />
                      <span className="flex-1 truncate">{d.title as string}</span>
                      <StatusDot status={d.status as NodeStatus} />
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

function CommandItem({
  icon,
  label,
  shortcut,
  onSelect,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onSelect: () => void
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-button',
        'text-body text-text-primary',
        'cursor-pointer',
        'aria-selected:bg-surface-hover',
        'outline-none'
      )}
    >
      <span className="text-text-tertiary">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-tertiary">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  )
}
