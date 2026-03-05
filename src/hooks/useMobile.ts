'use client'

import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

// Server snapshot always returns false (no window on server)
function getServerSnapshot() {
  return false
}

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}

/**
 * Returns true if viewport width <= 768px.
 * Uses useSyncExternalStore for consistent SSR hydration.
 * On the server, always returns false.
 * On the client, returns the correct value immediately on first render.
 */
export function useMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Non-hook version for use outside React components (e.g., Zustand stores) */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
}
