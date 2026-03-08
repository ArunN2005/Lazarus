'use client'

import { motion } from 'framer-motion'

export function HeroSection() {
  return (
    <div className="flex flex-col items-center text-center max-w-[680px] mx-auto pt-[15vh] px-4">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-6xl font-bold tracking-[-0.04em] bg-gradient-to-b from-[#c4b5fd] via-[#7c3aed] to-[#4c1d95] bg-clip-text text-transparent"
      >
        LAZARUS
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        className="text-xs tracking-[0.25em] uppercase text-text-muted mt-2"
      >
        LEGACY CODE RESURRECTION ENGINE
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="text-xl text-text-secondary mt-5"
      >
        Bring any GitHub repository back to life.{' '}
        <span className="relative inline-block">
          Instantly.
          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent animate-[slideInFromLeft_0.6s_ease-out_0.5s_forwards] origin-left scale-x-0" />
        </span>
      </motion.p>
    </div>
  )
}
