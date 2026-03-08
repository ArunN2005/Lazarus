'use client'

import { useCallback, useRef } from 'react'
import type { editor as monacoEditor } from 'monaco-editor'

export function useStreamingEditor() {
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

  const setEditor = useCallback(
    (
      editor: monacoEditor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor
      monacoRef.current = monaco
    },
    []
  )

  const appendToken = useCallback((token: string) => {
    const editor = editorRef.current
    const monaco = monacoRef.current
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
    const editor = editorRef.current
    if (!editor) return
    editor.setValue('')
  }, [])

  const setContent = useCallback((content: string) => {
    const editor = editorRef.current
    if (!editor) return
    editor.setValue(content)
  }, [])

  const setLanguage = useCallback((filePath: string) => {
    const editor = editorRef.current
    const monaco = monacoRef.current
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

  return {
    setEditor,
    appendToken,
    clearEditor,
    setContent,
    setLanguage,
    editorRef,
  }
}
