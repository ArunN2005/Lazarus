'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWebContainer, analyzeBackend } from '@/hooks/useWebContainer'
import { useStreamingEditor } from '@/hooks/useStreamingEditor'
import type { SSEEvent, FileTreeNode } from '@/types'

/** Build a nested file tree from flat paths for the FileTreePanel */
function buildFileTreeFromPaths(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  for (const filePath of paths.sort()) {
    const parts = filePath.split('/')
    let currentLevel = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')
      const existing = currentLevel.find((n) => n.name === part)
      if (existing) {
        if (existing.children) currentLevel = existing.children
      } else {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        currentLevel.push(node)
        if (node.children) currentLevel = node.children
      }
    }
  }
  return root
}

export function useResurrection() {
  const store = useWorkspaceStore()
  const { getToken } = useAuth()
  const { writeFile, runInstall, runBackendThenFrontend, injectDevtools } = useWebContainer()
  const { appendToken, clearEditor, setLanguage } = useStreamingEditor()
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingWritesRef = useRef<Promise<void>[]>([])
  const streamingRef = useRef(false)
  const completedFilesRef = useRef<Map<string, string>>(new Map())

  // Use refs so the EventSource handler always gets latest functions
  const writeFileRef = useRef(writeFile)
  const runInstallRef = useRef(runInstall)
  const runBackendThenFrontendRef = useRef(runBackendThenFrontend)
  const injectDevtoolsRef = useRef(injectDevtools)
  const appendTokenRef = useRef(appendToken)
  const clearEditorRef = useRef(clearEditor)
  const setLanguageRef = useRef(setLanguage)

  useEffect(() => { writeFileRef.current = writeFile }, [writeFile])
  useEffect(() => { runInstallRef.current = runInstall }, [runInstall])
  useEffect(() => { runBackendThenFrontendRef.current = runBackendThenFrontend }, [runBackendThenFrontend])
  useEffect(() => { injectDevtoolsRef.current = injectDevtools }, [injectDevtools])
  useEffect(() => { appendTokenRef.current = appendToken }, [appendToken])
  useEffect(() => { clearEditorRef.current = clearEditor }, [clearEditor])
  useEffect(() => { setLanguageRef.current = setLanguage }, [setLanguage])

  const startStreaming = useCallback(async () => {
    if (!store.jobId) return

    // Guard: prevent duplicate EventSource connections
    if (streamingRef.current || eventSourceRef.current) {
      return
    }
    streamingRef.current = true

    // Start elapsed timer
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      store.incrementElapsed()
    }, 1000)

    pendingWritesRef.current = []
    completedFilesRef.current = new Map()

    // EventSource can't send headers — pass token as query param
    const token = await getToken()
    const url = token
      ? `/api/stream/${store.jobId}?token=${encodeURIComponent(token)}`
      : `/api/stream/${store.jobId}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      const data: SSEEvent = JSON.parse(event.data)

      switch (data.type) {
        case 'file_start':
          store.setFileStreaming(data.file)
          clearEditorRef.current()
          setLanguageRef.current(data.file)
          break

        case 'token':
          store.appendToken(data.file, data.token)
          appendTokenRef.current(data.token)
          break

        case 'file_complete': {
          store.setFileComplete(data.file, data.content)
          completedFilesRef.current.set(data.file, data.content)
          const writePromise = writeFileRef.current(data.file, data.content)
          pendingWritesRef.current.push(writePromise)
          break
        }

        case 'asset_complete': {
          // Write binary image into Vite's public/ folder so it's served at /{file}.
          // Write to both public/ (single-repo) and frontend/public/ (monorepo) —
          // whichever matches the generated app structure will serve the file correctly.
          const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0))
          pendingWritesRef.current.push(
            writeFileRef.current(`public/${data.file}`, bytes),
            writeFileRef.current(`frontend/public/${data.file}`, bytes)
          )
          break
        }

        case 'install_start':
          store.addTerminalLog('Starting npm install...')
          break

        case 'install_log':
          store.addTerminalLog(data.line)
          break

        case 'preview_ready':
          store.setPreviewUrl(data.url)
          break

        case 'chat_complete':
          if (data.needsInstall) {
            store.addTerminalLog('package.json changed — re-running npm install...')
            const currentFiles = useWorkspaceStore.getState().generatedFiles
            runInstallRef.current(currentFiles)
          }
          break

        case 'cost_update':
          store.setTotalCostUSD(data.totalUSD)
          break

        case 'error':
          store.addTerminalLog(`Error: ${data.message}`)
          if (!data.recoverable) {
            store.setStatus('failed')
            es.close()
            eventSourceRef.current = null
            streamingRef.current = false
          }
          break

        case 'complete': {
          store.setStatus('complete')
          es.close()
          eventSourceRef.current = null
          streamingRef.current = false
          if (timerRef.current) clearInterval(timerRef.current)

          const allPaths = Array.from(completedFilesRef.current.keys())
          const tree = buildFileTreeFromPaths(allPaths)
          store.setFileTree(tree)

          const completedFiles = completedFilesRef.current

          Promise.all(pendingWritesRef.current).then(async () => {
            store.addTerminalLog(`All ${pendingWritesRef.current.length} files written to WebContainer.`)

            // Inject visual editing devtools before the dev server starts
            await injectDevtoolsRef.current(completedFiles)

            const backendInfo = analyzeBackend(completedFiles)
            if (backendInfo?.compatible) {
              // Show dialog — user will trigger the start
              store.setBackendInfo(backendInfo.root, backendInfo.framework)
              store.setShowBackendDialog(true)
            } else {
              // No compatible backend — start frontend directly
              runInstallRef.current(completedFiles)
            }
          })
          break
        }
      }
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        store.addTerminalLog('SSE connection closed.')
        eventSourceRef.current = null
        streamingRef.current = false
      } else {
        store.addTerminalLog('SSE connection error — retrying...')
      }
    }
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopStreaming = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    streamingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopStreaming()
    }
  }, [stopStreaming])

  return { startStreaming, stopStreaming }
}
