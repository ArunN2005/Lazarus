'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWebContainer } from '@/hooks/useWebContainer'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Viewport = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
}

export function PreviewPanel() {
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [editMode, setEditMode] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const previewUrl = useWorkspaceStore((s) => s.previewUrl)
  const status = useWorkspaceStore((s) => s.status)
  const generatedFiles = useWorkspaceStore((s) => s.generatedFiles)
  const setFileComplete = useWorkspaceStore((s) => s.setFileComplete)
  const previewRefreshKey = useWorkspaceStore((s) => s.previewRefreshKey)
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview)

  const { writeFile, writeOverrideCSS } = useWebContainer()

  const editModeRef = useRef(false)

  const sendEditMode = useCallback((enabled: boolean) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'lazarus:set-edit', enabled },
      '*'
    )
  }, [])

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev
      editModeRef.current = next
      sendEditMode(next)
      return next
    })
  }, [sendEditMode])

  // Whenever the iframe finishes loading, re-send the current edit mode.
  // This is the reliable path — onLoad fires after the devtools script is ready.
  const handleIframeLoad = useCallback(() => {
    if (editModeRef.current) {
      sendEditMode(true)
    }
  }, [sendEditMode])

  // Apply a text replacement coming from the in-iframe devtools overlay
  const applyTextEdit = useCallback(
    (oldText: string, newText: string) => {
      for (const [filePath, content] of Array.from(generatedFiles.entries())) {
        if (content.includes(oldText)) {
          const updated = content.replace(oldText, newText)
          setFileComplete(filePath, updated)
          writeFile(filePath, updated)
          return
        }
      }
    },
    [generatedFiles, setFileComplete, writeFile]
  )

  // Persist drag positions by accumulating into a CSS override file
  const dragOverridesRef = useRef<Map<string, string>>(new Map())

  const applyDragWithCSS = useCallback(
    (selector: string, transform: string) => {
      dragOverridesRef.current.set(selector, transform)
      const css = Array.from(dragOverridesRef.current.entries())
        .map(([sel, tr]) => `${sel} { transform: ${tr} !important; }`)
        .join('\n')
      writeOverrideCSS(css)
    },
    [writeOverrideCSS]
  )

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data) return
      if (event.data.type === 'lazarus:text-edit') {
        const { oldText, newText } = event.data as { oldText: string; newText: string }
        if (!oldText || !newText || oldText === newText) return
        applyTextEdit(oldText, newText)
      } else if (event.data.type === 'lazarus:drag-end') {
        const { selector, transform } = event.data as { selector: string; transform: string }
        if (!selector || !transform) return
        applyDragWithCSS(selector, transform)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [applyTextEdit, applyDragWithCSS])

  const isLive = !!previewUrl

  return (
    <div className="flex flex-col h-full bg-bg-panel">
      {/* Header */}
      <div className="h-8 border-b border-border-subtle flex items-center px-3 gap-2">
        <span className="text-xs uppercase tracking-wide text-text-muted font-medium">
          Preview
        </span>

        <div className="flex items-center gap-1 ml-2">
          {(
            [
              ['desktop', Monitor],
              ['tablet', Tablet],
              ['mobile', Smartphone],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={cn(
                'p-1 rounded transition-colors',
                viewport === v
                  ? 'text-text-primary bg-bg-hover'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {isLive && (
          <>
            <button
              onClick={toggleEditMode}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors',
                editMode
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-transparent border-border text-text-muted hover:text-text-secondary hover:border-border-strong'
              )}
            >
              <Pencil className="w-2.5 h-2.5" />
              Edit {editMode ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-1.5 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">LIVE</span>
            </div>
          </>
        )}

        <button
          onClick={() => previewUrl && window.open(previewUrl, '_blank')}
          disabled={!isLive}
          className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={refreshPreview}
          disabled={!isLive}
          className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-bg-base p-2 overflow-hidden">
        {isLive ? (
          <div
            className={cn(
              'h-full transition-all duration-300 bg-white rounded-lg overflow-hidden',
              viewport === 'tablet' && 'shadow-lg',
              viewport === 'mobile' && 'shadow-lg rounded-2xl'
            )}
            style={{ width: VIEWPORT_WIDTHS[viewport], maxWidth: '100%' }}
          >
            <iframe
              key={previewRefreshKey}
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={handleIframeLoad}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            {status === 'resurrecting' ? (
              <>
                <div className="w-3/4 space-y-3">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-32 w-full mt-4" />
                  <Skeleton className="h-4 w-1/2 mt-4" />
                </div>
                <span className="text-sm text-text-muted">
                  Generating files...
                </span>
              </>
            ) : (
              <span className="text-sm text-text-muted">
                {status === 'scanning'
                  ? 'Analyzing repository...'
                  : 'Your preview will appear here'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
