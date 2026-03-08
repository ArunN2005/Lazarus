'use client'

import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, RefreshCw, MessageSquare, GitPullRequest, Shield, Timer } from 'lucide-react'
import { HeroSection } from '@/components/landing/HeroSection'
import { RepoInput } from '@/components/landing/RepoInput'
import { ExampleRepos } from '@/components/landing/ExampleRepos'

const FEATURES = [
  {
    icon: Zap,
    title: 'Single AI Call',
    description: 'All files generated in one context for perfect coherence',
  },
  {
    icon: RefreshCw,
    title: 'Live Preview',
    description: 'WebContainers runs your app instantly in the browser',
  },
  {
    icon: MessageSquare,
    title: 'Chat to Edit',
    description: 'Describe changes in plain English, see them instantly',
  },
  {
    icon: GitPullRequest,
    title: 'GitHub PR',
    description: 'One click to create a PR back to your repository',
  },
  {
    icon: Shield,
    title: 'Zero Data Loss',
    description: 'All original logic preserved. Only modernized.',
  },
  {
    icon: Timer,
    title: 'Sub-minute',
    description: 'From legacy to live in under 60 seconds',
  },
]

export default function LandingPage() {
  const fillRef = useRef<((url: string) => void) | null>(null)

  const handleExampleSelect = useCallback((url: string) => {
    fillRef.current?.(url)
  }, [])

  return (
    <div className="min-h-screen bg-bg-base relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -20%, #150a2e 0%, transparent 70%)',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <div className="relative z-10">
        <HeroSection />
        <RepoInput
          onFillRef={(fill) => {
            fillRef.current = fill
          }}
        />
        <ExampleRepos onSelect={handleExampleSelect} />

        {/* Feature grid */}
        <div className="max-w-[900px] mx-auto mt-20 px-4 pb-20 grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.4 + i * 0.05,
              }}
              className="bg-bg-elevated border border-border-subtle rounded-xl p-6 hover:border-border-strong hover:-translate-y-0.5 transition-all duration-normal"
            >
              <feature.icon className="w-6 h-6 text-accent-light mb-3" />
              <h3 className="text-base font-semibold text-text-primary mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
