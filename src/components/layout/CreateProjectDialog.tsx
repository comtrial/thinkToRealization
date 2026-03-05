'use client'

import { useState, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, FolderOpen, ChevronRight, ChevronDown, GitBranch, FileText, ArrowUp } from 'lucide-react'
import { useProject } from '@/components/providers/ProjectProvider'
import { cn } from '@/lib/utils'

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || `project-${Date.now()}`
}

interface DirectoryEntry {
  name: string
  path: string
  hasGit: boolean
  hasClaudeMd: boolean
}

interface DirectoryBrowserProps {
  onSelect: (dirPath: string, claudeMdPath: string | null) => void
  selectedPath: string
}

function DirectoryBrowser({ onSelect, selectedPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [directories, setDirectories] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [childDirs, setChildDirs] = useState<Record<string, DirectoryEntry[]>>({})

  const loadDirectories = useCallback(async (path?: string) => {
    setLoading(true)
    setError('')
    try {
      const url = path
        ? `/api/filesystem/directories?path=${encodeURIComponent(path)}`
        : '/api/filesystem/directories'
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json()
        setError(json.error?.message || '디렉토리를 불러올 수 없습니다')
        return
      }
      const { data } = await res.json()
      setCurrentPath(data.currentPath)
      setParentPath(data.parentPath)
      setDirectories(data.directories)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectories()
  }, [loadDirectories])

  const loadChildren = async (dirPath: string) => {
    try {
      const res = await fetch(`/api/filesystem/directories?path=${encodeURIComponent(dirPath)}`)
      if (res.ok) {
        const { data } = await res.json()
        setChildDirs((prev) => ({ ...prev, [dirPath]: data.directories }))
      }
    } catch {
      // ignore child load errors
    }
  }

  const toggleExpand = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
        if (!childDirs[dirPath]) {
          loadChildren(dirPath)
        }
      }
      return next
    })
  }

  const handleSelect = (dir: DirectoryEntry) => {
    const claudeMdPath = dir.hasClaudeMd ? `${dir.path}/CLAUDE.md` : null
    onSelect(dir.path, claudeMdPath)
  }

  const renderEntry = (dir: DirectoryEntry, depth = 0) => {
    const isExpanded = expandedDirs.has(dir.path)
    const isSelected = selectedPath === dir.path
    const children = childDirs[dir.path]

    return (
      <div key={dir.path}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 rounded-button cursor-pointer transition-colors text-caption',
            isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-surface-hover text-text-primary'
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(dir.path)}
            className="p-0.5 hover:bg-surface-hover rounded flex-shrink-0"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <button
            type="button"
            onClick={() => handleSelect(dir)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <FolderOpen size={14} className="flex-shrink-0 text-text-tertiary" />
            <span className="truncate">{dir.name}</span>
            {dir.hasGit && (
              <span className="flex-shrink-0 text-[10px] px-1 py-0.5 rounded-badge bg-green-100 text-green-700 flex items-center gap-0.5">
                <GitBranch size={10} />
                git
              </span>
            )}
            {dir.hasClaudeMd && (
              <span className="flex-shrink-0 text-[10px] px-1 py-0.5 rounded-badge bg-violet-100 text-violet-700 flex items-center gap-0.5">
                <FileText size={10} />
                CLAUDE.md
              </span>
            )}
          </button>
        </div>
        {isExpanded && children && children.map((child) => renderEntry(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="border border-border rounded-button bg-background overflow-hidden">
      {/* Current path + navigate up */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-surface">
        {parentPath && (
          <button
            type="button"
            onClick={() => loadDirectories(parentPath)}
            className="p-0.5 hover:bg-surface-hover rounded text-text-tertiary"
            title="상위 폴더"
          >
            <ArrowUp size={14} />
          </button>
        )}
        <span className="text-[10px] text-text-tertiary truncate font-mono">{currentPath}</span>
      </div>

      {/* Directory list */}
      <div className="max-h-[200px] overflow-y-auto py-1">
        {loading && (
          <p className="text-[10px] text-text-tertiary px-3 py-2">로딩 중...</p>
        )}
        {error && (
          <p className="text-[10px] text-red-500 px-3 py-2">{error}</p>
        )}
        {!loading && !error && directories.length === 0 && (
          <p className="text-[10px] text-text-tertiary px-3 py-2">하위 디렉토리가 없습니다</p>
        )}
        {!loading && directories.map((dir) => renderEntry(dir))}
      </div>
    </div>
  )
}

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { refreshProjects, setCurrentProject } = useProject()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState('')
  const [projectDir, setProjectDir] = useState('')
  const [claudeMdPath, setClaudeMdPath] = useState<string | null>(null)
  const [claudeMdPreview, setClaudeMdPreview] = useState<string | null>(null)
  const [claudeMdOpen, setClaudeMdOpen] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reset = useCallback(() => {
    setTitle('')
    setSlug('')
    setSlugManual(false)
    setDescription('')
    setProjectDir('')
    setClaudeMdPath(null)
    setClaudeMdPreview(null)
    setClaudeMdOpen(false)
    setShowBrowser(false)
    setError('')
    setSubmitting(false)
  }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!slugManual) {
      setSlug(toSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugManual(true)
    setSlug(value)
  }

  const handleDirectorySelect = useCallback(async (dirPath: string, detectedClaudeMdPath: string | null) => {
    setProjectDir(dirPath)
    setClaudeMdPath(detectedClaudeMdPath)
    setClaudeMdPreview(null)

    // Auto-fill title from directory name if empty
    if (!title.trim()) {
      const dirName = dirPath.split('/').pop() || ''
      handleTitleChange(dirName)
    }

    // Load CLAUDE.md preview if detected
    if (detectedClaudeMdPath) {
      try {
        const res = await fetch(`/api/filesystem/file?path=${encodeURIComponent(detectedClaudeMdPath)}`)
        if (res.ok) {
          const { data } = await res.json()
          setClaudeMdPreview(data.content)
        }
      } catch {
        // ignore preview errors
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !projectDir.trim()) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug || toSlug(title),
          description: description.trim() || undefined,
          projectDir: projectDir.trim(),
          claudeMdPath: claudeMdPath || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? '프로젝트 생성에 실패했습니다')
        return
      }

      await refreshProjects()
      if (json.data) {
        setCurrentProject(json.data)
      }
      reset()
      onOpenChange(false)
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content data-testid="create-project-dialog" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-h-[85vh] bg-surface border border-border rounded-dropdown shadow-elevation-3 p-6 z-50 focus:outline-none overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-section-header text-text-primary font-semibold">
              새 프로젝트
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-surface-hover text-text-tertiary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Project directory - with browser */}
            <div className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">
                프로젝트 경로 <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-2">
                <input
                  data-testid="project-dir-input"
                  type="text"
                  value={projectDir}
                  onChange={(e) => {
                    setProjectDir(e.target.value)
                    setClaudeMdPath(null)
                    setClaudeMdPreview(null)
                  }}
                  placeholder="/Users/username/my-project"
                  className="flex-1 px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowBrowser(!showBrowser)}
                  className={cn(
                    'px-3 py-2 text-body rounded-button border transition-colors',
                    showBrowser
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  )}
                  title="디렉토리 탐색"
                >
                  <FolderOpen size={16} />
                </button>
              </div>

              {/* Directory browser */}
              {showBrowser && (
                <DirectoryBrowser
                  onSelect={handleDirectorySelect}
                  selectedPath={projectDir}
                />
              )}

              {/* CLAUDE.md detected badge */}
              {claudeMdPath && (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setClaudeMdOpen(!claudeMdOpen)}
                    className="flex items-center gap-1.5 text-[11px] text-violet-700 bg-violet-50 px-2 py-1 rounded-badge w-fit hover:bg-violet-100 transition-colors"
                  >
                    <FileText size={12} />
                    <span>CLAUDE.md 감지됨</span>
                    {claudeMdOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  {claudeMdOpen && claudeMdPreview && (
                    <pre className="text-[10px] text-text-secondary bg-background border border-border rounded-button p-2 max-h-[120px] overflow-y-auto whitespace-pre-wrap font-mono">
                      {claudeMdPreview.length > 2000
                        ? claudeMdPreview.slice(0, 2000) + '\n...(truncated)'
                        : claudeMdPreview}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">
                프로젝트 이름 <span className="text-red-500">*</span>
              </span>
              <input
                data-testid="project-title-input"
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="예: DevFlow v2"
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">슬러그</span>
              <input
                data-testid="project-slug-input"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="devflow-v2"
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent font-mono"
              />
              <span className="text-xs text-text-tertiary">
                영문 소문자, 숫자, 하이픈만 사용
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-caption text-text-secondary font-medium">설명</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트에 대한 간단한 설명"
                rows={2}
                className="px-3 py-2 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent resize-none"
              />
            </label>

            {error && (
              <p className="text-caption text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-body text-text-secondary rounded-button hover:bg-surface-hover transition-colors"
                >
                  취소
                </button>
              </Dialog.Close>
              <button
                data-testid="create-project-submit"
                type="submit"
                disabled={submitting || !title.trim() || !projectDir.trim()}
                className="px-4 py-2 text-body text-white bg-accent rounded-button hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '생성 중...' : '생성'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
