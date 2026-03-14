'use client'

import { useCallback } from 'react'
import type { editor as monacoEditor } from 'monaco-editor'

// ── Module-level singleton refs ─────────────────────────────────────────────
// Shared across ALL consumers (EditorPanel mount + useResurrection streaming).
// This is the fix: previously each useStreamingEditor() call created its own
// useRef, so the streaming hook in useResurrection never saw the editor instance
// that EditorPanel mounted.
let _editor: monacoEditor.IStandaloneCodeEditor | null = null
let _monaco: typeof import('monaco-editor') | null = null

export function useStreamingEditor() {
  const setEditor = useCallback(
    (
      editor: monacoEditor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      _editor = editor
      _monaco = monaco
    },
    []
  )

  const appendToken = useCallback((token: string) => {
    const editor = _editor
    const monaco = _monaco
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const lastLine = model.getLineCount()
    const lastCol = model.getLineLength(lastLine) + 1

    editor.executeEdits('stream', [
      {
        range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
        text: token,
        forceMoveMarkers: true,
      },
    ])

    editor.revealLine(
      model.getLineCount(),
      monaco.editor.ScrollType.Smooth
    )
  }, [])

  const clearEditor = useCallback(() => {
    const editor = _editor
    if (!editor) return
    editor.setValue('')
  }, [])

  const setContent = useCallback((content: string) => {
    const editor = _editor
    if (!editor) return
    editor.setValue(content)
  }, [])

  const setLanguage = useCallback((filePath: string) => {
    const editor = _editor
    const monaco = _monaco
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const ext = filePath.split('.').pop() ?? ''
    const langMap: Record<string, string> = {
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
      rb: 'ruby',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      svg: 'xml',
      sh: 'shell',
      bash: 'shell',
      sql: 'sql',
      graphql: 'graphql',
      vue: 'html',
      svelte: 'html',
    }

    const language = langMap[ext] ?? 'plaintext'
    monaco.editor.setModelLanguage(model, language)
  }, [])

  /** Get the current editor instance (for imperative updates outside streaming) */
  const getEditor = useCallback(() => _editor, [])

  return {
    setEditor,
    appendToken,
    clearEditor,
    setContent,
    setLanguage,
    getEditor,
  }
}
