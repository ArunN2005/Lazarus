'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export function HeroSection() {
  return (
    <div className="flex flex-col items-center text-center max-w-[680px] mx-auto pt-[15vh] px-4">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7 flex items-center gap-2 backdrop-blur-md bg-white/[0.05] border border-white/[0.1] rounded-full px-4 py-1.5 text-xs text-text-secondary"
      >
        <Sparkles className="w-3 h-3 text-accent-light" />
        AI-powered legacy code modernization
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="text-[76px] font-bold tracking-[-0.05em] leading-none"
        style={{
          background: 'linear-gradient(160deg, #ffffff 0%, #c7d2fe 35%, #818cf8 65%, #4f46e5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        LAZARUS
      </motion.h1>

      {/* Eyebrow */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
        className="text-[10px] tracking-[0.35em] uppercase text-text-muted mt-3 font-medium"
      >
        Legacy Code Resurrection Engine
      </motion.p>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
        className="text-lg text-text-secondary mt-6 leading-relaxed max-w-[480px]"
      >
        Bring any GitHub repository back to life.{' '}
        <span className="text-text-primary font-medium">Instantly.</span>
      </motion.p>
    </div>
  )
}
