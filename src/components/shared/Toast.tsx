'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDismissing(true), 5000)
    return () => clearTimeout(timer)
  }, [toast.id])

  useEffect(() => {
    if (dismissing) {
      const timer = setTimeout(() => onDismiss(toast.id), 300)
      return () => clearTimeout(timer)
    }
  }, [dismissing, toast.id, onDismiss])

  const handleDismiss = () => setDismissing(true)

  const iconMap = {
    success: <CheckCircle size={16} className="text-success flex-shrink-0" />,
    error: <AlertCircle size={16} className="text-error flex-shrink-0" />,
    info: <Info size={16} className="text-info flex-shrink-0" />,
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-node bg-surface border shadow-elevation-2',
        'animate-slideUp min-w-0 md:min-w-[280px] max-w-full md:max-w-[400px]',
        dismissing && 'animate-fadeOut',
        toast.type === 'error' && 'border-error/30',
        toast.type === 'success' && 'border-success/30',
        toast.type === 'info' && 'border-border'
      )}
    >
      {iconMap[toast.type]}
      <span className="text-body text-text-primary flex-1">{toast.message}</span>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded hover:bg-surface-hover transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
      >
        <X size={14} className="text-text-tertiary" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    setToasts((prev) => [...prev.slice(-4), { id, type, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-[60px] right-4 left-4 md:left-auto z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
