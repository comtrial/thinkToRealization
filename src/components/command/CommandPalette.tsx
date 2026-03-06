'use client'

import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '@/stores/ui-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useNodeStore } from '@/stores/node-store'
import { useProject } from '@/components/providers/ProjectProvider'
import { NodeTypeIcon } from '@/components/shared/NodeTypeIcon'
import { StatusDot } from '@/components/shared/Badge'
import {
  Search, Plus, LayoutGrid, Maximize, PlayCircle,
  SquareTerminal, PanelLeftClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobile } from '@/hooks/useMobile'
import type { NodeType, NodeStatus } from '@/lib/types/api'

export function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, setActiveTab, toggleSidebar } = useUIStore()
  const nodes = useCanvasStore((s) => s.nodes)
  const addNode = useCanvasStore((s) => s.addNode)
  const selectNode = useNodeStore((s) => s.selectNode)
  const { currentProject } = useProject()
  const isMobile = useMobile()
  const [search, setSearch] = useState('')

  // Reset search when opening
  useEffect(() => {
    if (commandPaletteOpen) setSearch('')
  }, [commandPaletteOpen])

  const openPanel = useUIStore((s) => s.openPanel)

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      setActiveTab('canvas')
      openPanel(nodeId)
      toggleCommandPalette()
    },
    [selectNode, setActiveTab, openPanel, toggleCommandPalette]
  )

  const handleCreateNodeFromPalette = useCallback(async () => {
    if (!currentProject) return
    toggleCommandPalette()
    setActiveTab('canvas')
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature' as NodeType,
          title: '새 기능개발',
          canvasX: 100 + Math.random() * 200,
          canvasY: 100 + Math.random() * 200,
        }),
      })
      if (!res.ok) {
        console.error('Node creation failed:', res.status)
        return
      }
      const { data } = await res.json()
      addNode({
        id: data.id,
        type: 'baseNode',
        position: { x: data.canvasX, y: data.canvasY },
        data,
      })
    } catch (err) {
      console.error('Failed to create node from palette:', err)
    }
  }, [currentProject, toggleCommandPalette, setActiveTab, addNode])

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-surface-overlay"
        onClick={toggleCommandPalette}
      />
      {/* Palette */}
      <div className={cn(
        isMobile
          ? 'absolute bottom-0 left-0 right-0 px-0'
          : 'absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[640px] px-4'
      )}>
        <Command
          className={cn(
            'bg-surface border border-border shadow-elevation-3',
            'overflow-hidden',
            isMobile ? 'rounded-t-palette' : 'rounded-palette'
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
              autoFocus={!isMobile}
            />
            {!isMobile && (
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-tertiary">
                ESC
              </kbd>
            )}
          </div>

          <Command.List className={cn(
            'overflow-y-auto py-2',
            isMobile ? 'max-h-[70vh]' : 'max-h-[360px]'
          )}>
            <Command.Empty className="py-6 text-center text-caption text-text-tertiary">
              결과가 없습니다
            </Command.Empty>

            {/* Actions */}
            <Command.Group heading="액션" className="px-2">
              <CommandItem
                icon={<Plus size={14} />}
                label="새 노드 생성"
                shortcut="⌘N"
                onSelect={handleCreateNodeFromPalette}
                isMobile={isMobile}
              />
              <CommandItem
                icon={<LayoutGrid size={14} />}
                label="자동 정렬"
                shortcut="⌘L"
                onSelect={() => {
                  toggleCommandPalette()
                }}
                isMobile={isMobile}
              />
              <CommandItem
                icon={<Maximize size={14} />}
                label="줌 맞춤"
                shortcut="⌘0"
                onSelect={() => {
                  toggleCommandPalette()
                }}
                isMobile={isMobile}
              />
              <CommandItem
                icon={<PanelLeftClose size={14} />}
                label="사이드바 토글"
                shortcut="["
                onSelect={() => {
                  toggleSidebar()
                  toggleCommandPalette()
                }}
                isMobile={isMobile}
              />
              <CommandItem
                icon={<PlayCircle size={14} />}
                label="대시보드"
                shortcut="⌘1"
                onSelect={() => {
                  setActiveTab('dashboard')
                  toggleCommandPalette()
                }}
                isMobile={isMobile}
              />
              <CommandItem
                icon={<SquareTerminal size={14} />}
                label="캔버스"
                shortcut="⌘2"
                onSelect={() => {
                  setActiveTab('canvas')
                  toggleCommandPalette()
                }}
                isMobile={isMobile}
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
                        'flex items-center gap-2 px-3 rounded-button',
                        'text-body text-text-primary',
                        'cursor-pointer',
                        'aria-selected:bg-surface-hover',
                        'outline-none',
                        isMobile ? 'py-3' : 'py-2'
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
  isMobile,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onSelect: () => void
  isMobile?: boolean
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-2 px-3 rounded-button',
        'text-body text-text-primary',
        'cursor-pointer',
        'aria-selected:bg-surface-hover',
        'outline-none',
        isMobile ? 'py-3' : 'py-2'
      )}
    >
      <span className="text-text-tertiary">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && !isMobile && (
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-tertiary">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  )
}
