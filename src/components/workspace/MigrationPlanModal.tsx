'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Loader2,
  Mic,
  MicOff,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'

interface MigrationOption {
  id: string
  label: string
  description: string
  mandatory: boolean
}

const MIGRATION_OPTIONS: MigrationOption[] = [
  // Mandatory — always on
  {
    id: 'preserve-routes',
    label: 'Preserve all routes & API endpoints',
    description: 'Keep every URL path and data model intact',
    mandatory: true,
  },
  {
    id: 'webcontainer-compat',
    label: 'WebContainer compatibility',
    description: 'Replace native binaries (bcrypt → bcryptjs, etc.)',
    mandatory: true,
  },
  {
    id: 'remove-deprecated',
    label: 'Remove deprecated & EOL packages',
    description: 'Upgrade all dependencies to supported versions',
    mandatory: true,
  },
  {
    id: 'preserve-features',
    label: 'Preserve all existing features',
    description: 'Every feature in the original repo must exist in output',
    mandatory: true,
  },
  // Optional — user can toggle
  {
    id: 'tailwind-ui',
    label: 'Tailwind CSS + shadcn/ui components',
    description: 'Replace raw CSS / Bootstrap with Tailwind utility classes',
    mandatory: false,
  },
  {
    id: 'typescript',
    label: 'TypeScript strict mode',
    description: 'Convert JavaScript to TypeScript with strict type-checking',
    mandatory: false,
  },
  {
    id: 'react-hooks',
    label: 'Modern React (Hooks, no class components)',
    description: 'Rewrite class components as functional components with hooks',
    mandatory: false,
  },
  {
    id: 'security-middleware',
    label: 'Security middleware',
    description: 'Add helmet, CORS, and rate-limiting to backend',
    mandatory: false,
  },
  {
    id: 'performance',
    label: 'Performance optimisations',
    description: 'Lazy loading, code splitting, memoisation',
    mandatory: false,
  },
  {
    id: 'eslint',
    label: 'ESLint + Prettier',
    description: 'Add linting and formatting configuration',
    mandatory: false,
  },
]

function ScoreGauge({ score }: { score: number }) {
  const label =
    score >= 70
      ? 'Major overhaul needed'
      : score >= 40
        ? 'Moderate modernisation'
        : 'Minor updates'

  const color =
    score >= 70
      ? { bar: 'bg-red-500', text: 'text-red-400', ring: 'text-red-500' }
      : score >= 40
        ? { bar: 'bg-yellow-500', text: 'text-yellow-400', ring: 'text-yellow-500' }
        : { bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'text-emerald-500' }

  return (
    <div className="mb-6 p-4 rounded-xl border border-border-strong bg-bg-subtle">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${color.text}`} />
          <span className="text-sm font-semibold text-text-primary">
            Legacy Health Score
          </span>
        </div>
        <span className={`text-xl font-bold tabular-nums ${color.text}`}>
          {score}
          <span className="text-xs font-normal text-text-tertiary">/100</span>
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-bg-base overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${color.bar}`}
        />
      </div>

      <p className={`text-xs mt-2 ${color.text} font-medium`}>{label}</p>
    </div>
  )
}

interface MigrationPlanModalProps {
  onSubmit: (options: string[], additionalRequirements: string) => void
  loading?: boolean
}

export function MigrationPlanModal({
  onSubmit,
  loading = false,
}: MigrationPlanModalProps) {
  const show = useWorkspaceStore((s) => s.showMigrationPlanModal)
  const legacyScore = useWorkspaceStore((s) => s.legacyScore)
  const weaknesses = useWorkspaceStore((s) => s.weaknesses)

  // Default: all options selected (mandatory always on, optional on by default)
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set(MIGRATION_OPTIONS.map((o) => o.id))
  )
  const [additionalReqs, setAdditionalReqs] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const toggleOption = useCallback((id: string, mandatory: boolean) => {
    if (mandatory) return
    setSelectedOptions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('file', blob, 'recording.webm')
          fd.append('model', 'saarika:v2')
          const res = await fetch('/api/stt', { method: 'POST', body: fd })
          if (res.ok) {
            const { transcript } = await res.json() as { transcript: string }
            if (transcript) {
              setAdditionalReqs((prev) =>
                prev ? `${prev} ${transcript}` : transcript
              )
            }
          }
        } finally {
          setTranscribing(false)
        }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      // Mic permission denied or not available
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit(Array.from(selectedOptions), additionalReqs)
  }, [onSubmit, selectedOptions, additionalReqs])

  if (!show) return null

  const mandatoryOptions = MIGRATION_OPTIONS.filter((o) => o.mandatory)
  const optionalOptions = MIGRATION_OPTIONS.filter((o) => !o.mandatory)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-bg-elevated border border-border-strong rounded-2xl p-8 max-w-[600px] w-full mx-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-text-primary">
              Modernisation Plan
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Review what Lazarus will change. Locked items are required for the
              app to run in WebContainers.
            </p>
          </div>

          {/* Score gauge — only shown once data is available */}
          {legacyScore > 0 && <ScoreGauge score={legacyScore} />}

          {/* Weaknesses detected */}
          {weaknesses.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Issues detected
              </p>
              <div className="space-y-1.5">
                {weaknesses.map((w) => (
                  <div
                    key={w}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-text-secondary">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mandatory */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Required
            </p>
            <div className="space-y-2">
              {mandatoryOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-bg-subtle border border-border-subtle opacity-70"
                >
                  <div className="mt-0.5 flex-shrink-0 text-accent">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {opt.label}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Optional */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Optional — toggle on/off
            </p>
            <div className="space-y-2">
              {optionalOptions.map((opt) => {
                const checked = selectedOptions.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id, opt.mandatory)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-150 ${
                      checked
                        ? 'bg-accent/10 border-accent/40'
                        : 'bg-bg-subtle border-border-subtle hover:border-border-strong'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                        checked
                          ? 'bg-accent border-accent'
                          : 'border-border-strong bg-transparent'
                      } flex items-center justify-center`}
                    >
                      {checked && (
                        <svg
                          viewBox="0 0 10 8"
                          className="w-2.5 h-2.5 text-white fill-none stroke-current stroke-2"
                        >
                          <polyline points="1,4 3.5,6.5 9,1" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {opt.label}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Additional requirements */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Additional requirements
            </p>
            <div className="relative">
              <textarea
                value={additionalReqs}
                onChange={(e) => setAdditionalReqs(e.target.value)}
                placeholder="e.g. Use a dark purple colour scheme, add a dashboard page, integrate Stripe payments..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border-strong bg-bg-subtle text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2.5 pr-11 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                title={recording ? 'Stop recording' : 'Speak your requirements'}
                className={`absolute right-2.5 bottom-2.5 p-1.5 rounded-md transition-colors ${
                  recording
                    ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                    : 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated'
                } disabled:opacity-50`}
              >
                {transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : recording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>
            {recording && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                Recording... tap the mic to stop
              </p>
            )}
            {transcribing && (
              <p className="text-xs text-text-tertiary mt-1.5">
                Transcribing...
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg py-3 text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Resurrection...
              </>
            ) : (
              <>
                Approve & Start Resurrection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
