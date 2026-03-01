'use client'

import { useUIStore } from '@/stores/ui-store'
import * as Tabs from '@radix-ui/react-tabs'

const tabs = [
  { value: 'overview' as const, label: '개요' },
  { value: 'sessions' as const, label: '세션' },
  { value: 'files' as const, label: '파일' },
]

export function PanelTabs() {
  const panelTab = useUIStore((s) => s.panelTab)
  const setPanelTab = useUIStore((s) => s.setPanelTab)

  return (
    <Tabs.Root value={panelTab} onValueChange={(v) => setPanelTab(v as typeof panelTab)}>
      <Tabs.List className="flex border-b border-border shrink-0">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className={[
              'flex-1 py-2.5 text-caption text-center transition-colors relative',
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
