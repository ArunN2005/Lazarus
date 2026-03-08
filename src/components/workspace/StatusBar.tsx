'use client'

import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

function getStatusMessage(status: string): string {
  switch (status) {
    case 'scanning':
      return 'Analyzing repository...'
    case 'scanned':
      return 'Scan complete — ready to resurrect'
    case 'clarifying':
      return 'Waiting for your preferences...'
    case 'resurrecting':
      return 'Generating modernized codebase...'
    case 'complete':
      return 'Resurrection complete'
    case 'failed':
      return 'Resurrection failed'
    case 'rejected':
      return 'Repository rejected'
    default:
      return 'Idle'
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'scanning':
      return 'bg-info/10'
    case 'resurrecting':
      return 'bg-accent/10'
    case 'complete':
      return 'bg-success/10'
    case 'failed':
    case 'rejected':
      return 'bg-error/10'
    default:
      return 'bg-bg-panel'
  }
}

export function StatusBar() {
  const status = useWorkspaceStore((s) => s.status)
  const fileStatuses = useWorkspaceStore((s) => s.fileStatuses)
  const totalCost = useWorkspaceStore((s) => s.totalCostUSD)

  const totalFiles = fileStatuses.size
  const completeFiles = Array.from(fileStatuses.values()).filter(
    (s) => s === 'complete'
  ).length

  return (
    <div
      className={cn(
        'h-6 border-t border-border-subtle flex items-center px-3 gap-3 font-mono text-xs transition-colors',
        getStatusBg(status)
      )}
    >
      <span className="text-text-secondary">{getStatusMessage(status)}</span>

      {totalFiles > 0 && (
        <>
          <div className="w-px h-3 bg-border-subtle" />
          <span className="text-text-muted">
            Files: {completeFiles}/{totalFiles} complete
          </span>
        </>
      )}

      {status === 'resurrecting' && (
        <>
          <div className="w-px h-3 bg-border-subtle" />
          <span className="text-text-muted">Bedrock: streaming</span>
        </>
      )}

      <div className="flex-1" />

      <span className="text-text-muted">${totalCost.toFixed(2)} total</span>
      <div className="w-px h-3 bg-border-subtle" />
      <span className="text-text-muted">Claude Sonnet 4.6</span>
    </div>
  )
}
