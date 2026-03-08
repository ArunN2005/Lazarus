'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout'
import { ClarificationModal } from '@/components/workspace/ClarificationModal'
import { MigrationPlanModal } from '@/components/workspace/MigrationPlanModal'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useResurrection } from '@/hooks/useResurrection'
import { useWebContainer } from '@/hooks/useWebContainer'
import type { FileTreeNode } from '@/types'

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
        if (existing.children) {
          currentLevel = existing.children
        }
      } else {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        currentLevel.push(node)
        if (node.children) {
          currentLevel = node.children
        }
      }
    }
  }

  return root
}

export default function WorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()
  const jobId = params.jobId as string
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const store = useWorkspaceStore()
  const { startStreaming } = useResurrection()
  const streamStartedRef = useRef(false)

  // Boot WebContainer
  useWebContainer()

  // Redirect if not signed in (skip in dev — Clerk clock skew causes false negatives)
  const isDev = process.env.NODE_ENV === 'development'
  useEffect(() => {
    if (!isDev && isLoaded && !isSignedIn) {
      router.push('/sign-in')
    }
  }, [isLoaded, isSignedIn, router, isDev])

  // Load job data with polling
  useEffect(() => {
    if (!jobId) return

    const alreadyInit = store.jobId === jobId
    if (!alreadyInit) {
      store.setJobId(jobId)
    }

    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return

        const data = await res.json()
        const job = data.job

        store.setStatus(job.status)
        if (job.techStack) store.setTechStack(job.techStack)
        if (job.totalCostUSD) store.setTotalCostUSD(job.totalCostUSD)
        if (job.envVars?.length > 0) store.setDetectedEnvVars(job.envVars)

        // Build file tree from S3 paths
        if (data.filePaths?.length > 0 && store.fileTree.length === 0) {
          const tree = buildFileTreeFromPaths(data.filePaths)
          store.setFileTree(tree)
        }

        if (typeof job.legacyScore === 'number' && job.legacyScore > 0) {
          store.setRepoAnalysis(job.legacyScore, job.weaknesses ?? [])
        }

        if (job.clarificationQuestions?.length > 0) {
          store.setClarificationQuestions(job.clarificationQuestions)
          if (job.status === 'clarifying') {
            store.setShowClarificationModal(true)
          }
        }

        // Stop polling once past scanning
        if (
          job.status !== 'scanning' &&
          job.status !== 'idle'
        ) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
        }

        // If already resurrecting, connect to stream (only once)
        if (job.status === 'resurrecting' && !streamStartedRef.current) {
          streamStartedRef.current = true
          startStreaming()
        }
      } catch {
        // Network error, keep polling
      }
    }

    fetchJob()
    pollRef.current = setInterval(fetchJob, 2000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Start Resurrection" button → open migration plan modal
  const handleStartResurrection = useCallback(() => {
    store.setShowMigrationPlanModal(true)
  }, [store])

  // Called when user approves the migration plan modal
  const handleMigrationSubmit = useCallback(
    async (migrationOptions: string[], additionalRequirements: string) => {
      store.setShowMigrationPlanModal(false)
      setLoading(true)
      try {
        await fetch('/api/resurrect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            answers: store.clarificationAnswers,
            envVars: {},
            migrationOptions,
            additionalRequirements,
          }),
        })

        store.setStatus('resurrecting')
        streamStartedRef.current = true
        startStreaming()
      } catch {
        // Error handled by UI
      } finally {
        setLoading(false)
      }
    },
    [jobId, store, startStreaming]
  )

  const handleClarificationSubmit = useCallback(
    async (answers: Record<string, string>) => {
      setLoading(true)
      try {
        await fetch('/api/resurrect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            answers,
            envVars: {},
          }),
        })

        store.setShowClarificationModal(false)
        store.setStatus('resurrecting')
        startStreaming()
      } catch {
        // Error handled by UI
      } finally {
        setLoading(false)
      }
    },
    [jobId, store, startStreaming]
  )

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-base">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <WorkspaceLayout
        onStartResurrection={handleStartResurrection}
        resurrectionLoading={loading}
      />
      <ClarificationModal
        onSubmit={handleClarificationSubmit}
        loading={loading}
      />
      <MigrationPlanModal
        onSubmit={handleMigrationSubmit}
        loading={loading}
      />
    </>
  )
}
