'use client'

import { motion } from 'framer-motion'
import { Zap, RefreshCw, MessageSquare, GitPullRequest, Shield, Timer } from 'lucide-react'
import { HeroSection } from '@/components/landing/HeroSection'
import { RepoInput } from '@/components/landing/RepoInput'
import { SupportedStacks } from '@/components/landing/SupportedStacks'

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
  return (
    <div className="min-h-screen bg-bg-base relative overflow-hidden">
      {/* Gradient orbs — background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {/* Primary violet orb — top center */}
        <div
          className="absolute top-[-25vh] left-1/2 -translate-x-1/2 w-[110vw] h-[80vh] animate-orb-float"
          style={{
            background:
              'radial-gradient(ellipse, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.1) 35%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />
        {/* Cyan orb — bottom left */}
        <div
          className="absolute bottom-[-15vh] left-[-15vw] w-[70vw] h-[60vh]"
          style={{
            background:
              'radial-gradient(ellipse, rgba(6,182,212,0.1) 0%, transparent 60%)',
            filter: 'blur(70px)',
            animationDelay: '3s',
          }}
        />
        {/* Blue orb — top right */}
        <div
          className="absolute top-[25%] right-[-10vw] w-[50vw] h-[50vh]"
          style={{
            background:
              'radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animationDelay: '1.5s',
          }}
        />
      </div>

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          zIndex: 1,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <div className="relative" style={{ zIndex: 2 }}>
        <HeroSection />
        <RepoInput />
        <SupportedStacks />

        {/* Feature grid */}
        <div className="max-w-[900px] mx-auto mt-20 px-4 pb-24 grid grid-cols-1 md:grid-cols-3 gap-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.4 + i * 0.06,
              }}
              className="group relative backdrop-blur-md bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 cursor-default"
            >
              {/* Hover inner glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 50% 110%, rgba(129,140,248,0.12), transparent 65%)',
                }}
              />
              {/* Top edge glow on hover */}
              <div
                className="absolute top-0 left-1/4 right-1/4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(165,180,252,0.6), transparent)',
                }}
              />

              <feature.icon className="w-5 h-5 text-accent-light mb-4 relative z-10" />
              <h3 className="text-sm font-semibold text-text-primary mb-1.5 relative z-10">
                {feature.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed relative z-10">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom fade */}
        <div
          className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(3,7,18,0.8), transparent)',
          }}
        />
      </div>
    </div>
  )
}
