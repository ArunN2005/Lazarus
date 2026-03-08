'use client'

import { Server, Zap, X } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWebContainer } from '@/hooks/useWebContainer'

const DB_LABELS: Record<string, string> = {
  mongoose: 'MongoDB (Atlas)',
  mongodb: 'MongoDB (Atlas)',
  '@supabase/supabase-js': 'Supabase (PostgreSQL)',
  '@upstash/redis': 'Upstash Redis',
  '@upstash/ratelimit': 'Upstash',
  firebase: 'Firebase',
  '@firebase/app': 'Firebase',
  'firebase-admin': 'Firebase Admin',
  '@libsql/client': 'Turso (SQLite)',
}

export function BackendStartDialog() {
  const showBackendDialog = useWorkspaceStore((s) => s.showBackendDialog)
  const backendRoot = useWorkspaceStore((s) => s.backendRoot)
  const backendFramework = useWorkspaceStore((s) => s.backendFramework)
  const generatedFiles = useWorkspaceStore((s) => s.generatedFiles)
  const setShowBackendDialog = useWorkspaceStore((s) => s.setShowBackendDialog)

  const { runInstall, runBackendThenFrontend } = useWebContainer()

  if (!showBackendDialog || !backendRoot || !backendFramework) return null

  // Detect db packages for display
  const pkgContent = generatedFiles.get(`${backendRoot}/package.json`) ?? '{}'
  let dbLabels: string[] = []
  try {
    const pkg = JSON.parse(pkgContent)
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    dbLabels = Object.keys(deps)
      .filter((d) => DB_LABELS[d])
      .map((d) => DB_LABELS[d])
      .filter((v, i, a) => a.indexOf(v) === i)
  } catch { /* skip */ }

  const handleStartBoth = () => {
    setShowBackendDialog(false)
    runBackendThenFrontend(generatedFiles, backendRoot)
  }

  const handleFrontendOnly = () => {
    setShowBackendDialog(false)
    runInstall(generatedFiles)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-bg-panel border border-border-subtle rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Server className="w-4 h-4 text-accent-light" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Backend Detected</p>
            <p className="text-xs text-text-muted mt-0.5">
              Compatible with WebContainer
            </p>
          </div>
          <button
            onClick={handleFrontendOnly}
            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated border border-border-subtle">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-accent-light capitalize">
                  {backendFramework}
                </span>
                <span className="text-text-muted text-xs">in</span>
                <span className="text-xs font-mono text-text-secondary">
                  /{backendRoot}
                </span>
              </div>
              {dbLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dbLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success/10 text-success border border-success/20"
                    >
                      <span className="w-1 h-1 rounded-full bg-success inline-block" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            The backend uses cloud-compatible services and can run inside WebContainer.
            Starting it first lets the frontend make live API calls during preview.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleStartBoth}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Start Backend + Frontend
          </button>
          <button
            onClick={handleFrontendOnly}
            className="px-4 h-9 rounded-lg border border-border-subtle text-text-secondary text-sm hover:bg-bg-hover transition-colors"
          >
            Frontend Only
          </button>
        </div>
      </div>
    </div>
  )
}
