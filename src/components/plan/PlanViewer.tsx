'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileCode,
  Plus,
  Minus,
  Pencil,
  Shield,
  TestTube,
} from 'lucide-react'
import type { PlanResponse, PlanContent, PlanStatus } from '@/lib/types/api'
import { usePlanStore } from '@/stores/plan-store'

// --- PlanHeader ---
function PlanHeader({ plan }: { plan: PlanResponse }) {
  const statusConfig: Record<PlanStatus, { label: string; className: string }> = {
    draft: { label: '초안', className: 'bg-gray-100 text-gray-700' },
    approved: { label: '승인됨', className: 'bg-green-100 text-green-700' },
    rejected: { label: '수정 요청', className: 'bg-red-100 text-red-700' },
    revised: { label: '수정됨', className: 'bg-amber-100 text-amber-700' },
  }
  const config = statusConfig[plan.status]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-caption text-text-tertiary">v{plan.version}</span>
        <span className={cn('text-badge px-1.5 py-0.5 rounded-badge', config.className)}>
          {config.label}
        </span>
      </div>
      <p className="text-body text-text-primary font-medium">{plan.content.summary}</p>
      <span className="text-[10px] text-text-tertiary">
        {new Date(plan.createdAt).toLocaleDateString('ko-KR', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </span>
      {plan.reviewNote && (
        <div className="p-2 rounded-badge bg-red-50 border border-red-200">
          <span className="text-[10px] text-red-600 font-medium">수정 요청 사유:</span>
          <p className="text-caption text-red-700 mt-0.5">{plan.reviewNote}</p>
        </div>
      )}
    </div>
  )
}

// --- PlanAffectedFiles ---
function PlanAffectedFiles({ files }: { files: PlanContent['affectedFiles'] }) {
  if (files.length === 0) return null

  const actionConfig = {
    create: { icon: <Plus size={12} />, className: 'text-green-600', label: '생성' },
    modify: { icon: <Pencil size={12} />, className: 'text-amber-600', label: '수정' },
    delete: { icon: <Minus size={12} />, className: 'text-red-600', label: '삭제' },
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <FileCode size={14} className="text-text-tertiary" />
        <span className="text-caption text-text-secondary font-medium">
          영향 파일 ({files.length})
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {files.map((file, i) => {
          const config = actionConfig[file.action]
          return (
            <div key={i} className="flex items-start gap-2 p-1.5 rounded-badge hover:bg-surface-hover">
              <span className={cn('flex-shrink-0 mt-0.5', config.className)}>{config.icon}</span>
              <div className="min-w-0 flex-1">
                <span className="text-caption text-text-primary font-mono block truncate">{file.path}</span>
                {file.description && (
                  <span className="text-[10px] text-text-tertiary">{file.description}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- PlanChanges ---
function PlanChanges({ changes }: { changes: PlanContent['changes'] }) {
  if (changes.length === 0) return null

  const riskConfig = {
    low: { className: 'border-green-200 bg-green-50', badge: 'bg-green-100 text-green-700' },
    medium: { className: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
    high: { className: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-700' },
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Pencil size={14} className="text-text-tertiary" />
        <span className="text-caption text-text-secondary font-medium">
          변경 사항 ({changes.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {changes.map((change, i) => {
          const config = riskConfig[change.risk]
          return (
            <div key={i} className={cn('p-2 rounded-badge border', config.className)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-caption text-text-primary font-medium">{change.title}</span>
                <span className={cn('text-[10px] px-1 py-0.5 rounded-badge', config.badge)}>
                  {change.risk}
                </span>
              </div>
              <p className="text-[10px] text-text-secondary">{change.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- PlanTestPlan ---
function PlanTestPlan({ tests }: { tests: PlanContent['testPlan'] }) {
  if (tests.length === 0) return null

  const typeConfig = {
    unit: 'bg-blue-100 text-blue-700',
    integration: 'bg-violet-100 text-violet-700',
    e2e: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <TestTube size={14} className="text-text-tertiary" />
        <span className="text-caption text-text-secondary font-medium">
          테스트 계획 ({tests.length})
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {tests.map((test, i) => (
          <div key={i} className="flex items-start gap-2 p-1.5">
            <input type="checkbox" disabled className="mt-0.5 accent-accent" />
            <span className="text-caption text-text-primary flex-1">{test.description}</span>
            <span className={cn('text-[10px] px-1 py-0.5 rounded-badge flex-shrink-0', typeConfig[test.type])}>
              {test.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- PlanRisks ---
function PlanRisks({ risks }: { risks: PlanContent['risks'] }) {
  if (risks.length === 0) return null

  const severityConfig = {
    low: { icon: <Shield size={12} className="text-green-600" />, className: 'border-green-200' },
    medium: { icon: <AlertTriangle size={12} className="text-amber-600" />, className: 'border-amber-200' },
    high: { icon: <AlertTriangle size={12} className="text-red-600" />, className: 'border-red-200' },
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={14} className="text-text-tertiary" />
        <span className="text-caption text-text-secondary font-medium">
          위험 요소 ({risks.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {risks.map((risk, i) => {
          const config = severityConfig[risk.severity]
          return (
            <div key={i} className={cn('p-2 rounded-badge border', config.className)}>
              <div className="flex items-center gap-1.5 mb-1">
                {config.icon}
                <span className="text-caption text-text-primary">{risk.description}</span>
              </div>
              <p className="text-[10px] text-text-tertiary">
                대응: {risk.mitigation}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- PlanActions ---
function PlanActions({ plan }: { plan: PlanResponse }) {
  const approvePlan = usePlanStore((s) => s.approvePlan)
  const rejectPlan = usePlanStore((s) => s.rejectPlan)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  if (plan.status === 'approved') {
    return (
      <div className="flex items-center gap-1.5 p-2 rounded-badge bg-green-50 border border-green-200">
        <CheckCircle size={14} className="text-green-600" />
        <span className="text-caption text-green-700 font-medium">승인됨</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => approvePlan(plan.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-caption text-white bg-green-600 rounded-button hover:bg-green-700 transition-colors"
        >
          <CheckCircle size={14} />
          승인
        </button>
        <button
          onClick={() => setShowRejectDialog(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-caption text-red-600 bg-red-50 border border-red-200 rounded-button hover:bg-red-100 transition-colors"
        >
          <XCircle size={14} />
          수정 요청
        </button>
      </div>

      {showRejectDialog && (
        <div className="flex flex-col gap-2 p-3 rounded-badge border border-border bg-surface">
          <label className="text-caption text-text-secondary font-medium">수정 요청 사유</label>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="수정이 필요한 이유를 작성해주세요..."
            rows={3}
            className="px-2 py-1.5 text-caption bg-background border border-border rounded-button focus:outline-none focus:border-accent resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowRejectDialog(false); setRejectNote('') }}
              className="px-3 py-1.5 text-caption text-text-secondary hover:bg-surface-hover rounded-button transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                rejectPlan(plan.id, rejectNote)
                setShowRejectDialog(false)
                setRejectNote('')
              }}
              disabled={!rejectNote.trim()}
              className="px-3 py-1.5 text-caption text-white bg-red-600 rounded-button hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              수정 요청 보내기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main PlanViewer ---
export function PlanViewer({ plan }: { plan: PlanResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <PlanHeader plan={plan} />
      <hr className="border-border" />
      <PlanAffectedFiles files={plan.content.affectedFiles} />
      <PlanChanges changes={plan.content.changes} />
      <PlanTestPlan tests={plan.content.testPlan} />
      <PlanRisks risks={plan.content.risks} />
      <hr className="border-border" />
      <PlanActions plan={plan} />
    </div>
  )
}
