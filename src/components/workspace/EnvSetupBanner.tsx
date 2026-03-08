'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, KeyRound, Check, X } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

export function EnvSetupBanner() {
  const detectedEnvVars = useWorkspaceStore((s) => s.detectedEnvVars)
  const envVarValues = useWorkspaceStore((s) => s.envVarValues)
  const setEnvVarValue = useWorkspaceStore((s) => s.setEnvVarValue)
  const jobId = useWorkspaceStore((s) => s.jobId)
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [applied, setApplied] = useState(false)

  // Load previously saved env vars from Secrets Manager on mount
  useEffect(() => {
    if (!jobId || detectedEnvVars.length === 0) return

    fetch(`/api/jobs/${jobId}/env`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.vars) return
        for (const [key, value] of Object.entries(data.vars)) {
          if (typeof value === 'string' && value) {
            setEnvVarValue(key, value)
          }
        }
      })
      .catch(() => {})
  }, [jobId, detectedEnvVars.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed || detectedEnvVars.length === 0) return null

  const handleApply = async () => {
    const wc = useWorkspaceStore.getState().webcontainerInstance
    if (!wc) return

    // Build .env content from user-entered values
    const lines = detectedEnvVars.map((key) => {
      const val = envVarValues[key] ?? ''
      return `${key}=${val}`
    })
    const envContent = lines.join('\n') + '\n'

    // Write .env to root and any subdirectories that have a package.json
    const generatedFiles = useWorkspaceStore.getState().generatedFiles
    const written = new Set<string>()

    for (const [filePath] of Array.from(generatedFiles.entries())) {
      if (filePath.endsWith('package.json')) {
        const dir = filePath === 'package.json' ? '' : filePath.replace('/package.json', '')
        const envPath = dir ? `${dir}/.env` : '.env'
        if (!written.has(envPath)) {
          written.add(envPath)
          try {
            if (dir) await wc.fs.mkdir(dir, { recursive: true })
            await wc.fs.writeFile(envPath, envContent)
          } catch { /* dir already exists */ }
        }
      }
    }

    // Fallback: always write root .env
    if (written.size === 0) {
      await wc.fs.writeFile('.env', envContent)
    }

    // Persist to Secrets Manager so values survive page refresh
    const currentJobId = useWorkspaceStore.getState().jobId
    if (currentJobId) {
      const vars = useWorkspaceStore.getState().envVarValues
      fetch(`/api/jobs/${currentJobId}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      }).catch(() => {})
    }

    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  const filledCount = detectedEnvVars.filter((k) => envVarValues[k]?.trim()).length

  return (
    <div className="border-b border-border-subtle bg-bg-panel">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition-colors text-left"
      >
        <KeyRound className="w-3.5 h-3.5 text-accent-light flex-shrink-0" />
        <span className="text-xs text-text-secondary font-medium flex-1">
          External Services Required
        </span>
        <span className="text-xs text-text-muted mr-2">
          {filledCount}/{detectedEnvVars.length} configured
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          className="p-0.5 text-text-muted hover:text-text-secondary ml-1"
        >
          <X className="w-3 h-3" />
        </button>
      </button>

      {/* Env var inputs */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {detectedEnvVars.map((key) => (
              <div key={key} className="flex items-center gap-2 min-w-0">
                <label className="text-xs text-text-muted font-mono flex-shrink-0 w-40 truncate" title={key}>
                  {key}
                </label>
                <input
                  type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('password') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                  value={envVarValues[key] ?? ''}
                  onChange={(e) => setEnvVarValue(key, e.target.value)}
                  placeholder="not set"
                  className={cn(
                    'flex-1 min-w-0 h-6 px-2 text-xs font-mono rounded border bg-bg-elevated outline-none transition-colors',
                    envVarValues[key]?.trim()
                      ? 'border-success/40 text-text-primary'
                      : 'border-border-subtle text-text-muted placeholder:text-text-muted/50'
                  )}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleApply}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
                applied
                  ? 'bg-success/20 text-success border border-success/30'
                  : 'bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30'
              )}
            >
              {applied ? (
                <><Check className="w-3 h-3" /> Applied</>
              ) : (
                'Apply to Preview'
              )}
            </button>
            <span className="text-xs text-text-muted">
              Writes a <span className="font-mono">.env</span> file into the WebContainer — restart the preview to take effect
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
