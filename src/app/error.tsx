'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="text-section-header text-text-primary mb-md">문제가 발생했습니다</h2>
        <p className="text-body text-text-secondary mb-lg">{error.message || '알 수 없는 오류가 발생했습니다'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-button text-body text-text-on-accent bg-accent hover:bg-accent-hover transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
