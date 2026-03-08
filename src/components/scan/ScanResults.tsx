'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Key,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { FileTreeNode } from '@/types'

function TechBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-bg-elevated border border-border rounded-md text-text-secondary">
      {label}
    </span>
  )
}

function FileTreeItem({
  node,
  depth = 0,
}: {
  node: FileTreeNode
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 py-1 px-2 hover:bg-bg-hover transition-colors text-sm"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-text-muted" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted" />
          )}
          <Folder className="w-4 h-4 text-accent-light" />
          <span className="text-text-primary">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1 py-1 px-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      <File className="w-4 h-4 text-text-muted" />
      <span>{node.name}</span>
    </div>
  )
}

interface ScanResultsProps {
  onStartResurrection: (envVars: Record<string, string>) => void
  loading: boolean
}

export function ScanResults({ onStartResurrection, loading }: ScanResultsProps) {
  const { techStack, fileTree } = useWorkspaceStore()
  const envVarNames = useWorkspaceStore((s) => s.jobId ? [] : []) // ENV vars from scan
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const techLabels: string[] = []
  if (techStack) {
    if (techStack.frontend) techLabels.push(techStack.frontend)
    if (techStack.backend) techLabels.push(techStack.backend)
    if (techStack.language !== 'unknown') techLabels.push(techStack.language)
    if (techStack.packageManager !== 'unknown')
      techLabels.push(techStack.packageManager)
    if (techStack.database) techLabels.push(techStack.database)
    if (techStack.cssFramework) techLabels.push(techStack.cssFramework)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-4 h-full"
    >
      {/* Left panel: file tree + info */}
      <div className="w-[400px] flex flex-col bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-text-primary">
              {useWorkspaceStore.getState().jobId ? 'Repository' : 'Scan Results'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {techLabels.map((label) => (
              <TechBadge key={label} label={label} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          {fileTree.map((node) => (
            <FileTreeItem key={node.path} node={node} />
          ))}
        </div>

        {envVarNames.length > 0 && (
          <div className="p-4 border-t border-border-subtle">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium text-text-primary">
                Environment Variables Required
              </span>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Securely stored in AWS Secrets Manager
            </p>
            {envVarNames.map((name) => (
              <div key={name} className="mb-2">
                <label className="text-xs font-mono text-text-secondary mb-1 block">
                  {name}
                </label>
                <div className="flex gap-1">
                  <Input
                    type={showPasswords[name] ? 'text' : 'password'}
                    value={envValues[name] ?? ''}
                    onChange={(e) =>
                      setEnvValues((prev) => ({
                        ...prev,
                        [name]: e.target.value,
                      }))
                    }
                    className="bg-bg-base border-border text-sm font-mono"
                  />
                  <button
                    onClick={() =>
                      setShowPasswords((prev) => ({
                        ...prev,
                        [name]: !prev[name],
                      }))
                    }
                    className="p-2 text-text-muted hover:text-text-secondary"
                  >
                    {showPasswords[name] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-border-subtle">
          <button
            onClick={() => onStartResurrection(envValues)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg py-3 text-sm transition-all duration-150 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Resurrection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right panel: preview placeholder */}
      <div className="flex-1 bg-bg-panel border border-border-subtle rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
          <span className="text-xs uppercase tracking-wide text-text-muted font-medium">
            Legacy Preview
          </span>
          <Badge variant="secondary" className="text-xs">
            Running original code
          </Badge>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          Preview loading...
        </div>
      </div>
    </motion.div>
  )
}
