import { create } from 'zustand'
import type { PlanResponse } from '@/lib/types/api'

interface PlanStore {
  currentPlan: PlanResponse | null
  plans: PlanResponse[]
  isGenerating: boolean
  error: string | null
  loadPlans: (nodeId: string) => Promise<void>
  generatePlan: (nodeId: string) => Promise<void>
  approvePlan: (planId: string) => Promise<void>
  rejectPlan: (planId: string, note: string) => Promise<void>
  selectPlan: (plan: PlanResponse) => void
  clearPlans: () => void
}

export const usePlanStore = create<PlanStore>((set) => ({
  currentPlan: null,
  plans: [],
  isGenerating: false,
  error: null,

  loadPlans: async (nodeId) => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/plans`)
      if (res.ok) {
        const { data } = await res.json()
        const plans = data as PlanResponse[]
        set({ plans, currentPlan: plans[0] || null, error: null })
      }
    } catch (err) {
      console.error('Failed to load plans:', err)
    }
  },

  generatePlan: async (nodeId) => {
    set({ isGenerating: true, error: null })
    try {
      const res = await fetch(`/api/nodes/${nodeId}/plans`, { method: 'POST' })
      if (res.ok) {
        const { data } = await res.json()
        const plan = data as PlanResponse
        set((s) => ({
          plans: [plan, ...s.plans],
          currentPlan: plan,
          isGenerating: false,
        }))
      } else {
        const json = await res.json().catch(() => ({}))
        set({
          isGenerating: false,
          error: json.error?.message || '실행 계획서 생성에 실패했습니다',
        })
      }
    } catch (err) {
      console.error('Failed to generate plan:', err)
      set({ isGenerating: false, error: '네트워크 오류가 발생했습니다' })
    }
  },

  approvePlan: async (planId) => {
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (res.ok) {
        const { data } = await res.json()
        const updated = data as PlanResponse
        set((s) => ({
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
          currentPlan: s.currentPlan?.id === planId ? updated : s.currentPlan,
        }))
      }
    } catch (err) {
      console.error('Failed to approve plan:', err)
    }
  },

  rejectPlan: async (planId, note) => {
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reviewNote: note }),
      })
      if (res.ok) {
        const { data } = await res.json()
        const updated = data as PlanResponse
        set((s) => ({
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
          currentPlan: s.currentPlan?.id === planId ? updated : s.currentPlan,
        }))
      }
    } catch (err) {
      console.error('Failed to reject plan:', err)
    }
  },

  selectPlan: (plan) => set({ currentPlan: plan }),

  clearPlans: () => set({ currentPlan: null, plans: [], isGenerating: false, error: null }),
}))
