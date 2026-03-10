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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingWritesRef = useRef<Promise<void>[]>([])
  const streamingRef = useRef(false)
  const completedFilesRef = useRef<Map<string, string>>(new Map())
  const eventIndexRef = useRef(0)

  // Use refs so the poll handler always gets latest functions
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

  const handleEventRef = useRef<(data: SSEEvent) => void>(() => {})

  const handleEvent = useCallback((data: SSEEvent) => {
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
        }
        break

      case 'complete': {
        store.setStatus('complete')
        streamingRef.current = false
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        const allPaths = Array.from(completedFilesRef.current.keys())
        const tree = buildFileTreeFromPaths(allPaths)
        store.setFileTree(tree)

        const completedFiles = completedFilesRef.current

        Promise.all(pendingWritesRef.current).then(async () => {
          store.addTerminalLog(`All ${pendingWritesRef.current.length} files written to WebContainer.`)

          await injectDevtoolsRef.current(completedFiles)

          const backendInfo = analyzeBackend(completedFiles)
          if (backendInfo?.compatible) {
            store.setBackendInfo(backendInfo.root, backendInfo.framework)
            store.setShowBackendDialog(true)
          } else {
            runInstallRef.current(completedFiles)
          }
        })
        break
      }
    }
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleEventRef.current = handleEvent }, [handleEvent])

  const startStreaming = useCallback(async () => {
    if (!store.jobId) return

    // Guard: prevent duplicate poll loops
    if (streamingRef.current || pollIntervalRef.current) return
    streamingRef.current = true

    // Start elapsed timer
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      store.incrementElapsed()
    }, 1000)

    pendingWritesRef.current = []
    completedFilesRef.current = new Map()
    eventIndexRef.current = 0

    const jobId = store.jobId

    const poll = async () => {
      if (!streamingRef.current) return
      try {
        const token = await getToken()
        const url = `/api/stream/${jobId}?since=${eventIndexRef.current}`
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) {
          if (res.status === 401) {
            store.addTerminalLog('Stream auth error — retrying...')
          }
          return // retry next interval
        }

        const data = await res.json() as {
          events: SSEEvent[]
          nextIndex: number
          done: boolean
        }

        eventIndexRef.current = data.nextIndex

        for (const event of data.events) {
          handleEventRef.current(event)
          if (event.type === 'complete' || (event.type === 'error' && !event.recoverable)) {
            // handleEvent already cleans up the interval
            return
          }
        }
      } catch {
        // network error — retry next interval
      }
    }

    pollIntervalRef.current = setInterval(poll, 500)
    // Run first poll immediately so we don't wait 500ms for the first events
    void poll()
  }, [store, getToken, handleEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopStreaming = useCallback(() => {
    streamingRef.current = false
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
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
