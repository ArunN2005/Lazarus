'use client'

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Loader2,
  Check,
  X,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import type { FileTreeNode } from '@/types'

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'streaming':
      return <Loader2 className="w-2.5 h-2.5 text-accent-light animate-spin" />
    case 'complete':
      return <Check className="w-3 h-3 text-success" />
    case 'error':
      return <X className="w-3 h-3 text-error" />
    default:
      return <span className="w-2 h-2 rounded-full bg-text-muted/30" />
  }
}

function TreeItem({
  node,
  depth = 0,
}: {
  node: FileTreeNode
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const activeFile = useWorkspaceStore((s) => s.activeFile)
  const fileStatuses = useWorkspaceStore((s) => s.fileStatuses)
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile)

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 h-7 px-2 hover:bg-bg-hover transition-colors text-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
          )}
          <Folder className="w-4 h-4 text-accent-light flex-shrink-0" />
          <span className="text-text-primary truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }

  const isActive = activeFile === node.path
  const status = fileStatuses.get(node.path)

  return (
    <button
      onClick={() => setActiveFile(node.path)}
      className={cn(
        'w-full flex items-center gap-1 h-7 px-2 text-sm transition-colors',
        isActive
          ? 'bg-accent-dim border-l-2 border-accent'
          : 'hover:bg-bg-hover'
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <File className="w-4 h-4 text-text-muted flex-shrink-0" />
      <span
        className={cn(
          'truncate',
          isActive ? 'text-text-primary' : 'text-text-secondary'
        )}
      >
        {node.name}
      </span>
      <span className="ml-auto flex-shrink-0">
        <StatusIcon status={status} />
      </span>
    </button>
  )
}

export function FileTreePanel() {
  const fileTree = useWorkspaceStore((s) => s.fileTree)
  const fileStatuses = useWorkspaceStore((s) => s.fileStatuses)

  const total = fileStatuses.size
  const complete = Array.from(fileStatuses.values()).filter(
    (s) => s === 'complete'
  ).length
  const streaming = Array.from(fileStatuses.values()).filter(
    (s) => s === 'streaming'
  ).length
  const pending = total - complete - streaming

  return (
    <div className="flex flex-col h-full bg-bg-panel">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-text-muted font-medium">
          Files
        </span>
        {total > 0 && (
          <span className="text-xs text-text-muted">{total}</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {fileTree.length === 0 ? (
            <div className="px-3 py-4 text-sm text-text-muted">
              Waiting for files...
            </div>
          ) : (
            fileTree.map((node) => (
              <TreeItem key={node.path} node={node} />
            ))
          )}
        </div>
      </ScrollArea>

      {total > 0 && (
        <div className="px-3 py-2 border-t border-border-subtle text-xs text-text-muted flex items-center gap-2">
          <span>{total} files</span>
          {complete > 0 && <span className="text-success">&#10003; {complete}</span>}
          {streaming > 0 && <span className="text-accent-light">&#8635; {streaming}</span>}
          {pending > 0 && <span>&#9675; {pending}</span>}
        </div>
      )}
    </div>
  )
}
