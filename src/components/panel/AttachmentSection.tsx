'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Paperclip, Upload, X, FileText, Loader2, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { useMobile } from '@/hooks/useMobile'

interface AttachmentSectionProps {
  nodeId: string
}

interface AttachmentItem {
  id: string
  nodeId: string
  fileName: string
  fileType: string
  fileSize: number
  storagePath: string
  url: string
  createdAt: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageType(fileType: string): boolean {
  return fileType.startsWith('image/')
}

export function AttachmentSection({ nodeId }: AttachmentSectionProps) {
  const { addToast } = useToast()
  const isMobile = useMobile()
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/attachments`)
      if (res.ok) {
        const { data } = await res.json()
        setAttachments(data)
      }
    } catch {
      // silently fail on fetch
    } finally {
      setLoading(false)
    }
  }, [nodeId])

  useEffect(() => {
    setLoading(true)
    fetchAttachments()
  }, [fetchAttachments])

  const handleUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      addToast('error', '파일 크기가 10MB를 초과합니다')
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    // Mobile browsers may return empty file.type for camera captures — fallback to extension
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      addToast('error', '지원하지 않는 파일 형식입니다 (PNG, JPEG, GIF, WEBP, PDF만 가능)')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/nodes/${nodeId}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        addToast('success', '파일이 업로드되었습니다')
        await fetchAttachments()
      } else {
        const err = await res.json().catch(() => null)
        addToast('error', err?.error?.message || '파일 업로드에 실패했습니다')
      }
    } catch {
      addToast('error', '파일 업로드 중 오류가 발생했습니다')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDelete = async (attachment: AttachmentItem) => {
    setDeletingId(attachment.id)
    try {
      const res = await fetch(`/api/attachments/${attachment.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
        addToast('success', '파일이 삭제되었습니다')
      } else {
        addToast('error', '파일 삭제에 실패했습니다')
      }
    } catch {
      addToast('error', '파일 삭제 중 오류가 발생했습니다')
    } finally {
      setDeletingId(null)
    }
  }

  const images = attachments.filter((a) => isImageType(a.fileType))
  const files = attachments.filter((a) => !isImageType(a.fileType))

  return (
    <div className={cn("border-t border-border/30", attachments.length > 0 ? "pt-4" : "pt-2")}>
      {/* Section header */}
      <div className={cn("flex items-center justify-between", attachments.length > 0 ? "mb-3" : "mb-0")}>
        <div className="flex items-center gap-1.5">
          <Paperclip size={14} className="text-text-tertiary" />
          <span className="text-caption font-medium text-text-secondary">
            첨부파일
            {attachments.length > 0 && (
              <span className="text-text-tertiary ml-1">({attachments.length})</span>
            )}
          </span>
        </div>

        {/* Upload buttons */}
        <div className="flex items-center gap-1">
          {/* Camera button (mobile only) */}
          {isMobile && (
            <>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-button text-[11px] text-text-tertiary hover:text-accent hover:bg-surface-hover transition-colors disabled:opacity-50",
                  "min-h-[44px] min-w-[44px] justify-center"
                )}
              >
                <Camera size={14} />
                <span>촬영</span>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}

          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-button text-[11px] text-text-tertiary hover:text-accent hover:bg-surface-hover transition-colors disabled:opacity-50",
              isMobile && "min-h-[44px] min-w-[44px] justify-center"
            )}
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            <span>{uploading ? '업로드 중...' : '파일 추가'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={isMobile ? "image/*,.pdf" : "image/png,image/jpeg,image/gif,image/webp,application/pdf"}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Image thumbnails grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-lg overflow-hidden border border-border/50 bg-surface-hover/30 aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.fileName}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  setPreviewUrl(img.url)
                  setPreviewName(img.fileName)
                }}
                loading="lazy"
              />
              {/* Delete button — visible on mobile, hover on desktop */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(img)
                }}
                disabled={deletingId === img.id}
                className={cn(
                  'absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white',
                  'md:opacity-0 md:group-hover:opacity-100 transition-opacity',
                  'hover:bg-black/70',
                  'min-w-[28px] min-h-[28px] md:min-w-0 md:min-h-0 flex items-center justify-center',
                  deletingId === img.id && 'opacity-50'
                )}
              >
                {deletingId === img.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <X size={12} />
                )}
              </button>
              {/* File name overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-[10px] text-white truncate">{img.fileName}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Non-image file cards */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50 bg-surface-hover/30 group"
            >
              <FileText size={16} className="text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption text-text-primary hover:text-accent transition-colors block truncate"
                >
                  {file.fileName}
                </a>
                <span className="text-[11px] text-text-tertiary">
                  {formatFileSize(file.fileSize)}
                </span>
              </div>
              <button
                onClick={() => handleDelete(file)}
                disabled={deletingId === file.id}
                className={cn(
                  'p-1.5 rounded-button text-text-tertiary hover:text-red-500 hover:bg-surface-hover transition-colors shrink-0',
                  'md:opacity-0 md:group-hover:opacity-100',
                  'min-w-[32px] min-h-[32px] md:min-w-0 md:min-h-0 flex items-center justify-center',
                  deletingId === file.id && 'opacity-50'
                )}
              >
                {deletingId === file.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Full-size image preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={previewName}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-center text-white/80 text-caption mt-2">{previewName}</p>
          </div>
        </div>
      )}
    </div>
  )
}
