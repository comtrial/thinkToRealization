'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import * as Tabs from '@radix-ui/react-tabs'

const allTabs = [
  { value: 'overview' as const, label: '개요' },
  { value: 'sessions' as const, label: '세션', localOnly: true },
  { value: 'plans' as const, label: '계획서', localOnly: true },
]

interface PanelTabsProps {
  hidden?: boolean
}

export function PanelTabs({ hidden }: PanelTabsProps) {
  const panelTab = useUIStore((s) => s.panelTab)
  const setPanelTab = useUIStore((s) => s.setPanelTab)

  const [isLocal, setIsLocal] = useState(false)
  useEffect(() => {
    const host = window.location.hostname
    setIsLocal(host === 'localhost' || host === '127.0.0.1')
  }, [])

  if (hidden) return null

  const tabs = allTabs.filter((tab) => !tab.localOnly || isLocal)

  return (
    <Tabs.Root value={panelTab} onValueChange={(v) => setPanelTab(v as typeof panelTab)}>
      <Tabs.List className="flex border-b border-border/30 shrink-0">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className={[
              'flex-1 py-3 min-h-[44px] text-caption text-center transition-colors relative',
              'hover:text-text-primary',
              panelTab === tab.value
                ? 'text-text-primary'
                : 'text-text-secondary',
            ].join(' ')}
          >
            {tab.label}
            {panelTab === tab.value && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}
