'use client'

import { useEffect } from 'react'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePlanStore } from '@/stores/plan-store'
import { useNodeStore } from '@/stores/node-store'
import { PlanViewer } from '@/components/plan/PlanViewer'

export function PlanTab() {
  const selectedNode = useNodeStore((s) => s.selectedNode)
  const plans = usePlanStore((s) => s.plans)
  const currentPlan = usePlanStore((s) => s.currentPlan)
  const isGenerating = usePlanStore((s) => s.isGenerating)
  const error = usePlanStore((s) => s.error)
  const loadPlans = usePlanStore((s) => s.loadPlans)
  const generatePlan = usePlanStore((s) => s.generatePlan)
  const selectPlan = usePlanStore((s) => s.selectPlan)

  useEffect(() => {
    if (selectedNode) {
      loadPlans(selectedNode.id)
    }
  }, [selectedNode, loadPlans])

  if (!selectedNode) return null

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Generate button */}
      <button
        onClick={() => generatePlan(selectedNode.id)}
        disabled={isGenerating}
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-2.5 rounded-button text-body transition-colors',
          isGenerating
            ? 'bg-accent/10 text-accent cursor-wait'
            : 'bg-accent text-white hover:opacity-90'
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            실행 계획서 생성 중...
          </>
        ) : plans.length > 0 ? (
          <>
            <RefreshCw size={16} />
            실행 계획서 재생성
          </>
        ) : (
          <>
            <Sparkles size={16} />
            @Claude 실행 계획서 생성
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="p-2 rounded-badge bg-red-50 border border-red-200">
          <p className="text-caption text-red-600">{error}</p>
        </div>
      )}

      {/* Plan version selector */}
      {plans.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => selectPlan(plan)}
              className={cn(
                'text-[10px] px-2 py-1 rounded-badge transition-colors',
                currentPlan?.id === plan.id
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-tertiary hover:bg-surface-hover'
              )}
            >
              v{plan.version}
              {plan.status === 'approved' && ' \u2713'}
            </button>
          ))}
        </div>
      )}

      {/* Plan viewer */}
      {currentPlan && <PlanViewer plan={currentPlan} />}

      {/* Empty state */}
      {!isGenerating && plans.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles size={32} className="text-text-tertiary mb-2" />
          <p className="text-caption text-text-tertiary">
            아직 실행 계획서가 없습니다
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">
            @Claude 버튼을 눌러 실행 계획서를 생성하세요
          </p>
        </div>
      )}
    </div>
  )
}
