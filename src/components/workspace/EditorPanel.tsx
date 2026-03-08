'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useStreamingEditor } from '@/hooks/useStreamingEditor'
import type { editor as monacoEditor } from 'monaco-editor'

export function EditorPanel() {
  const activeFile = useWorkspaceStore((s) => s.activeFile)
  const generatedFiles = useWorkspaceStore((s) => s.generatedFiles)
  const originalFiles = useWorkspaceStore((s) => s.originalFiles)
  const currentStreamingFile = useWorkspaceStore((s) => s.currentStreamingFile)
  const jobId = useWorkspaceStore((s) => s.jobId)
  const { setEditor } = useStreamingEditor()
  const [loading, setLoading] = useState(false)
  // Track files we've already tried to fetch (prevents infinite re-fetch on 404)
  const fetchedRef = useRef<Set<string>>(new Set())

  // Fetch original file content from S3 when clicking a file that's not yet loaded.
  // Deps are limited to activeFile/jobId only — reading Maps via getState() avoids
  // this effect being cancelled by every streaming token that updates generatedFiles.
  useEffect(() => {
    if (!activeFile || !jobId) return

    const { generatedFiles: gf, originalFiles: of } = useWorkspaceStore.getState()

    // Already have content — nothing to fetch
    if (gf.has(activeFile) || of.has(activeFile)) {
      setLoading(false)
      return
    }

    // Already tried fetching this file (prevents infinite loop on 404)
    if (fetchedRef.current.has(activeFile)) {
      setLoading(false)
      return
    }
    fetchedRef.current.add(activeFile)

    let cancelled = false
    setLoading(true)

    fetch(`/api/jobs/${jobId}/file?path=${encodeURIComponent(activeFile)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.content != null) {
          useWorkspaceStore.getState().setOriginalFile(activeFile, data.content)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeFile, jobId])

  // Prefer generated content, fall back to original
  const activeContent = activeFile
    ? generatedFiles.get(activeFile) ?? originalFiles.get(activeFile) ?? ''
    : ''
  const isStreaming = activeFile === currentStreamingFile

  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop() ?? ''
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      css: 'css',
      scss: 'scss',
      html: 'html',
      md: 'markdown',
      py: 'python',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      sh: 'shell',
      sql: 'sql',
    }
    return map[ext] ?? 'plaintext'
  }

  const handleEditorMount = useCallback(
    (editor: monacoEditor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      setEditor(editor, monaco)
    },
    [setEditor]
  )

  const breadcrumb = activeFile?.split('/') ?? []

  if (!activeFile) {
    return (
      <div className="h-full flex flex-col bg-[#1e1e1e]">
        <div className="h-8 bg-bg-panel border-b border-border-subtle" />
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          <div className="text-center">
            <span className="text-accent mr-1">&#9889;</span>
            Select a file to view
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Header bar */}
      <div className="h-8 bg-bg-panel border-b border-border-subtle flex items-center px-3 gap-1">
        {breadcrumb.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-text-muted text-xs">/</span>
            )}
            <span
              className={
                i === breadcrumb.length - 1
                  ? 'text-text-primary text-xs'
                  : 'text-text-muted text-xs'
              }
            >
              {part}
            </span>
          </span>
        ))}
        <div className="flex-1" />
        {!generatedFiles.has(activeFile) && originalFiles.has(activeFile) && (
          <span className="text-xs px-1.5 py-0.5 bg-yellow-900/30 border border-yellow-700/30 rounded text-yellow-400 mr-2">
            original
          </span>
        )}
        <span className="text-xs px-1.5 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-muted">
          {getLanguage(activeFile)}
        </span>
      </div>

      {/* Monaco */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {loading && !activeContent ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : (
          <Editor
            key={activeFile}
            height="100%"
            language={getLanguage(activeFile)}
            value={activeContent}
            theme="vs-dark"
            onMount={handleEditorMount}
            options={{
              readOnly: isStreaming || !generatedFiles.has(activeFile),
              fontSize: 13,
              fontFamily: "'Geist Mono', 'Fira Code', monospace",
              lineHeight: 1.6,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              renderLineHighlight: 'line',
              cursorBlinking: isStreaming ? 'phase' : 'blink',
            }}
          />
        )}
      </div>
    </div>
  )
}
