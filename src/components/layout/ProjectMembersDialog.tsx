'use client'

import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, UserPlus, Trash2, ChevronDown } from 'lucide-react'
import { useProject } from '@/components/providers/ProjectProvider'
import { useAuthStore } from '@/stores/auth-store'
import { UserAvatar } from '@/components/shared/UserAvatar'
import type { ProjectMemberResponse, MemberRole } from '@/lib/types/api'

interface ProjectMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: '소유자',
  admin: '관리자',
  member: '멤버',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-amber-100 text-amber-700',
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-gray-100 text-gray-600',
}

export function ProjectMembersDialog({ open, onOpenChange }: ProjectMembersDialogProps) {
  const { currentProject } = useProject()
  const currentUser = useAuthStore((s) => s.user)

  const [members, setMembers] = useState<ProjectMemberResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Current user's role in this project
  const currentMembership = members.find((m) => m.user.id === currentUser?.id)
  const currentRole = currentMembership?.role ?? 'member'
  const canInvite = currentRole === 'owner' || currentRole === 'admin'
  const canChangeRoles = currentRole === 'owner'

  const fetchMembers = useCallback(async () => {
    if (!currentProject) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/members`)
      if (res.ok) {
        const json = await res.json()
        setMembers(json.data ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [currentProject])

  useEffect(() => {
    if (open && currentProject) {
      fetchMembers()
      setError('')
      setSuccessMsg('')
      setInviteEmail('')
      setInviteRole('member')
    }
  }, [open, currentProject, fetchMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProject || !inviteEmail.trim()) return

    setInviting(true)
    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? '멤버 초대에 실패했습니다')
        return
      }

      setSuccessMsg(`${inviteEmail.trim()} 님을 초대했습니다`)
      setInviteEmail('')
      setInviteRole('member')
      await fetchMembers()
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (member: ProjectMemberResponse) => {
    if (!currentProject) return

    const confirmMsg = member.user.id === currentUser?.id
      ? '프로젝트에서 나가시겠습니까?'
      : `${member.user.name} 님을 프로젝트에서 제거하시겠습니까?`

    if (!window.confirm(confirmMsg)) return

    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch(
        `/api/projects/${currentProject.id}/members/${member.id}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const json = await res.json()
        setError(json.error?.message ?? '멤버 제거에 실패했습니다')
        return
      }

      // If removing self, close dialog
      if (member.user.id === currentUser?.id) {
        onOpenChange(false)
        window.location.reload()
        return
      }

      await fetchMembers()
    } catch {
      setError('네트워크 오류가 발생했습니다')
    }
  }

  const handleChangeRole = async (member: ProjectMemberResponse, newRole: 'admin' | 'member') => {
    if (!currentProject) return

    setError('')
    setSuccessMsg('')

    try {
      const res = await fetch(
        `/api/projects/${currentProject.id}/members/${member.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }
      )

      if (!res.ok) {
        const json = await res.json()
        setError(json.error?.message ?? '역할 변경에 실패했습니다')
        return
      }

      await fetchMembers()
    } catch {
      setError('네트워크 오류가 발생했습니다')
    }
  }

  const canRemoveMember = (member: ProjectMemberResponse) => {
    // Self-removal is always allowed (unless last owner, but the API handles that)
    if (member.user.id === currentUser?.id) return true
    // Owner can remove anyone
    if (currentRole === 'owner') return true
    // Admin can remove members
    if (currentRole === 'admin' && member.role === 'member') return true
    return false
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[520px] max-h-[80vh] md:max-h-[85vh] bg-surface border border-border rounded-dropdown shadow-elevation-3 p-4 md:p-6 z-50 focus:outline-none overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-section-header text-text-primary font-semibold">
              프로젝트 멤버
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 md:p-1 rounded hover:bg-surface-hover text-text-tertiary min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Invite form — only for owner/admin */}
          {canInvite && (
            <form onSubmit={handleInvite} className="mb-4 pb-4 border-b border-border">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex-1 min-w-0">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="이메일 주소로 초대"
                    className="w-full px-3 py-2 min-h-[44px] md:min-h-0 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 focus-ring"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 md:flex-none">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                      className="appearance-none w-full md:w-auto pl-3 pr-7 py-2 min-h-[44px] md:min-h-0 text-body bg-background border border-border rounded-button focus:outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="member">멤버</option>
                      {currentRole === 'owner' && (
                        <option value="admin">관리자</option>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] md:min-h-0 text-body text-white bg-accent rounded-button hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus-ring whitespace-nowrap"
                  >
                    <UserPlus size={14} />
                    {inviting ? '초대 중...' : '초대'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Messages */}
          {error && (
            <p className="text-caption text-red-500 mb-3">{error}</p>
          )}
          {successMsg && (
            <p className="text-caption text-green-600 mb-3">{successMsg}</p>
          )}

          {/* Members list */}
          <div className="flex flex-col gap-1">
            {loading ? (
              <p className="text-caption text-text-tertiary py-4 text-center">불러오는 중...</p>
            ) : members.length === 0 ? (
              <p className="text-caption text-text-tertiary py-4 text-center">멤버가 없습니다</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-button hover:bg-surface-hover transition-colors group"
                >
                  <UserAvatar
                    name={member.user.name}
                    avatarUrl={member.user.avatarUrl}
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body text-text-primary font-medium truncate">
                        {member.user.name}
                      </span>
                      {member.user.id === currentUser?.id && (
                        <span className="text-micro text-text-tertiary">(나)</span>
                      )}
                    </div>
                    <span className="text-caption text-text-tertiary truncate block">
                      {member.user.email}
                    </span>
                  </div>

                  {/* Role badge / role selector */}
                  {canChangeRoles && member.role !== 'owner' && member.user.id !== currentUser?.id ? (
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member, e.target.value as 'admin' | 'member')}
                        className={`appearance-none pl-2 pr-6 py-1 min-h-[44px] md:min-h-0 rounded-badge text-badge cursor-pointer border-0 focus:outline-none ${ROLE_COLORS[member.role]}`}
                      >
                        <option value="admin">관리자</option>
                        <option value="member">멤버</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-1 rounded-badge text-badge ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}

                  {/* Remove button */}
                  {canRemoveMember(member) && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-2 md:p-1 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center rounded hover:bg-red-50 text-text-tertiary hover:text-red-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      title={member.user.id === currentUser?.id ? '프로젝트 나가기' : '멤버 제거'}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Member count */}
          {!loading && members.length > 0 && (
            <p className="text-micro text-text-tertiary mt-3 text-center">
              {members.length}명의 멤버
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
