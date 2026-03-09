'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

const STACKS = [
  { from: 'jQuery', to: 'React 18' },
  { from: 'Angular 1.x', to: 'React 18' },
  { from: 'Plain HTML/CSS', to: 'Next.js 14' },
  { from: 'PHP 5/7', to: 'Node.js + TS' },
  { from: 'Flask 1.x', to: 'FastAPI' },
  { from: 'Vue 2', to: 'Vue 3' },
  { from: 'Django 2.x', to: 'Django 4 + DRF' },
  { from: 'React 15/16', to: 'React 18' },
  { from: 'Express 4', to: 'Express 5 + TS' },
  { from: 'Backbone.js', to: 'React 18' },
  { from: 'Grunt/Gulp', to: 'Vite 5' },
  { from: 'CoffeeScript', to: 'TypeScript' },
]

export function SupportedStacks() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="flex flex-col items-center gap-3 mt-7"
    >
      <span className="text-[10px] tracking-[0.2em] uppercase text-text-muted font-medium">
        Supports modernizing
      </span>
      <div className="flex items-center gap-2 flex-wrap justify-center max-w-[560px]">
        {STACKS.map((stack) => (
          <div
            key={stack.from}
            className="flex items-center gap-1.5 backdrop-blur-md bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5 text-[11px]"
          >
            <span className="text-text-muted">{stack.from}</span>
            <ArrowRight className="w-2.5 h-2.5 text-accent/60 flex-shrink-0" />
            <span className="text-accent-light font-medium">{stack.to}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
