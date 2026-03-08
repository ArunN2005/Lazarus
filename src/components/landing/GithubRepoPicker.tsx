'use client'

import { useState, useEffect } from 'react'
import { Search, Lock, GitBranch } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Repo {
  fullName: string
  name: string
  owner: string
  private: boolean
  language: string | null
  updatedAt: string
}

interface GithubRepoPickerProps {
  onSelect: (url: string) => void
}

export function GithubRepoPicker({ onSelect }: GithubRepoPickerProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/repos')
      .then((r) => r.json())
      .then((data) => {
        setRepos(data.repos ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const recent = filtered.slice(0, 10)

  return (
    <div className="w-full max-w-[680px] mx-auto mt-3 bg-bg-elevated border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <Search className="w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your repositories..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
      </div>

      <ScrollArea className="max-h-[320px]">
        {loading ? (
          <div className="p-4 text-sm text-text-muted text-center">
            Loading repositories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-text-muted text-center">
            No repositories found
          </div>
        ) : (
          <div className="py-1">
            {recent.map((repo) => (
              <button
                key={repo.fullName}
                onClick={() =>
                  onSelect(`https://github.com/${repo.fullName}`)
                }
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-hover transition-colors text-left"
              >
                <GitBranch className="w-4 h-4 text-text-muted flex-shrink-0" />
                <span className="flex-1 text-sm text-text-primary truncate">
                  {repo.fullName}
                </span>
                {repo.private && (
                  <Lock className="w-3 h-3 text-text-muted" />
                )}
                {repo.language && (
                  <span className="text-xs px-1.5 py-0.5 bg-bg-panel border border-border-subtle rounded text-text-secondary">
                    {repo.language}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
