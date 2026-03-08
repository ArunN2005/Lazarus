'use client'

import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

const EXAMPLES = [
  { label: 'angular/angular-phonecat', url: 'https://github.com/nickvdyck/angular-phonecat' },
  { label: 'tastejs/todomvc', url: 'https://github.com/nickvdyck/todomvc' },
  { label: 'expressjs/examples', url: 'https://github.com/expressjs/examples' },
]

interface ExampleReposProps {
  onSelect: (url: string) => void
}

export function ExampleRepos({ onSelect }: ExampleReposProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="flex items-center gap-2 flex-wrap justify-center mt-8"
    >
      <span className="text-sm text-text-muted">Try these:</span>
      {EXAMPLES.map((example) => (
        <button
          key={example.label}
          onClick={() => onSelect(example.url)}
          className="flex items-center gap-1.5 border border-border bg-bg-elevated rounded-full px-3 py-1.5 text-sm text-text-secondary hover:border-accent hover:text-text-primary transition-all duration-150"
        >
          <Zap className="w-3 h-3" />
          {example.label}
        </button>
      ))}
    </motion.div>
  )
}
