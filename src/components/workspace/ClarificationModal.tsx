'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useWorkspaceStore } from '@/stores/workspace-store'

const DEFAULT_OPTIONS: Record<string, string[]> = {
  default: ['Option A', 'Option B', 'Keep original'],
}

function getOptionsForQuestion(question: string): string[] {
  const q = question.toLowerCase()
  if (q.includes('typescript') || q.includes('javascript'))
    return ['TypeScript', 'JavaScript', 'Keep original']
  if (q.includes('modernize') || q.includes('preserve') || q.includes('look'))
    return ['Modernize fully', 'Preserve original style', 'Minimal changes only']
  if (q.includes('framework'))
    return ['React + Vite', 'Next.js', 'Keep current framework']
  if (q.includes('css') || q.includes('styling'))
    return ['Tailwind CSS', 'Keep current styling', 'CSS Modules']
  return DEFAULT_OPTIONS.default
}

interface ClarificationModalProps {
  onSubmit: (answers: Record<string, string>) => void
  loading?: boolean
}

export function ClarificationModal({
  onSubmit,
  loading = false,
}: ClarificationModalProps) {
  const questions = useWorkspaceStore((s) => s.clarificationQuestions)
  const show = useWorkspaceStore((s) => s.showClarificationModal)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const allAnswered = questions.every((q) => answers[q])

  if (!show) return null

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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-bg-elevated border border-border-strong rounded-2xl p-8 max-w-[520px] w-full mx-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
        >
          <h2 className="text-xl font-semibold text-text-primary">
            A few quick questions
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            Lazarus wants to understand your codebase better before modernizing
          </p>

          <div className="mt-6 space-y-6">
            {questions.map((question) => {
              const options = getOptionsForQuestion(question)
              return (
                <div key={question}>
                  <p className="font-medium text-text-primary mb-3">
                    {question}
                  </p>
                  <RadioGroup
                    value={answers[question] ?? ''}
                    onValueChange={(value) =>
                      setAnswers((prev) => ({ ...prev, [question]: value }))
                    }
                  >
                    {options.map((option) => (
                      <div
                        key={option}
                        className="flex items-center gap-2 py-1"
                      >
                        <RadioGroupItem value={option} id={`${question}-${option}`} />
                        <Label
                          htmlFor={`${question}-${option}`}
                          className="text-sm text-text-secondary cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => onSubmit(answers)}
            disabled={!allAnswered || loading}
            className="w-full mt-8 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg py-3 text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Continue Resurrection
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
