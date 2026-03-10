'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check, MoreHorizontal, Pencil } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useProject } from '@/components/providers/ProjectProvider'

export function ProjectSelector() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const { currentProject, setCurrentProject, projects, loading, refreshProjects } = useProject()

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    )
  }, [projects, search])

  // Focus and select all text when entering rename mode
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renaming])

  const startRename = useCallback(() => {
    if (!currentProject) return
    setRenameValue(currentProject.title)
    setRenaming(true)
  }, [currentProject])

  const cancelRename = useCallback(() => {
    setRenaming(false)
    setRenameValue('')
  }, [])

  const saveRename = useCallback(async () => {
    if (!currentProject) return
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === currentProject.title) {
      cancelRename()
      return
    }
    setRenameSaving(true)
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.ok) {
        const json = await res.json()
        const updated = json.data
        // Update currentProject with new title
        setCurrentProject({ ...currentProject, ...updated })
        // Refresh the full list so dropdown stays in sync
        await refreshProjects()
      }
    } catch {
      // silently fail
    } finally {
      setRenameSaving(false)
      setRenaming(false)
      setRenameValue('')
    }
  }, [currentProject, renameValue, cancelRename, setCurrentProject, refreshProjects])

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveRename()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelRename()
      }
    },
    [saveRename, cancelRename]
  )

  return (
    <div className="flex items-center gap-0.5">
      {renaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={saveRename}
          disabled={renameSaving}
          className="bg-background border border-accent rounded px-2 py-1 text-body text-text-primary outline-none w-[140px] md:w-[170px]"
        />
      ) : (
      <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-1 px-2 py-1 rounded-button text-body text-text-secondary hover:bg-surface-hover transition-colors">
            <span className="truncate max-w-[120px] md:max-w-[150px]">
              {currentProject ? currentProject.title : '프로젝트 선택'}
            </span>
            <ChevronDown size={14} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="w-[240px] bg-surface border border-border rounded-dropdown shadow-elevation-2 p-2 z-50"
            sideOffset={4}
            align="start"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="프로젝트 검색..."
              className="w-full px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent mb-2"
            />
            {loading ? (
              <p className="px-3 py-2 text-caption text-text-tertiary">불러오는 중...</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-caption text-text-tertiary">
                {projects.length === 0 ? '프로젝트가 없습니다' : '검색 결과가 없습니다'}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                {filtered.map((project) => {
                  const selected = currentProject?.id === project.id
                  return (
                    <li key={project.id}>
                      <button
                        onClick={() => {
                          setCurrentProject(project)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-button text-body transition-colors ${
                          selected
                            ? 'bg-surface-active text-text-primary'
                            : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <span className="truncate flex-1 text-left">{project.title}</span>
                        {selected && <Check size={14} className="text-accent shrink-0" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      )}

      {/* More options button — only when a project is selected */}
      {currentProject && !renaming && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex-shrink-0 p-1 min-w-[28px] min-h-[28px] md:min-w-[32px] md:min-h-[32px] flex items-center justify-center rounded-button text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
              aria-label="프로젝트 옵션"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[180px] bg-surface border border-border rounded-dropdown shadow-elevation-2 py-1 z-50"
              sideOffset={4}
              align="start"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-caption text-text-primary hover:bg-surface-hover cursor-pointer outline-none"
                onSelect={startRename}
              >
                <Pencil size={14} />
                <span>프로젝트 이름 변경</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  )
}
