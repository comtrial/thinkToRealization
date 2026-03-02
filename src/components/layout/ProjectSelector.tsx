'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { useProject } from '@/components/providers/ProjectProvider'

export function ProjectSelector() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { currentProject, setCurrentProject, projects, loading } = useProject()

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 rounded-button text-body text-text-secondary hover:bg-surface-hover transition-colors">
          <span className="truncate max-w-[150px]">
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
  )
}
