'use client'

import { useRef, useEffect, useState } from 'react'
import { Trash2, ArrowDown } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '')
}

function colorize(line: string): string {
  if (line.includes('error') || line.includes('ERR'))
    return 'text-terminal-red'
  if (line.includes('warn') || line.includes('WARN'))
    return 'text-terminal-yellow'
  if (line.includes('✓') || line.includes('success') || line.includes('ready'))
    return 'text-terminal-green'
  if (line.includes('http://') || line.includes('https://'))
    return 'text-terminal-blue underline'
  return 'text-terminal-text'
}

export function TerminalPanel() {
  const logs = useWorkspaceStore((s) => s.terminalLogs)
  const addTerminalLog = useWorkspaceStore((s) => s.addTerminalLog)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [cmdRunning, setCmdRunning] = useState(false)
  const [cwd, setCwd] = useState('/')

  /** Resolve a cd target against the current directory */
  const resolvePath = (current: string, target: string): string => {
    if (!target || target === '~') return '/'
    const base = target.startsWith('/') ? [] : current.split('/').filter(Boolean)
    for (const part of target.split('/')) {
      if (part === '' || part === '.') continue
      if (part === '..') base.pop()
      else base.push(part)
    }
    return '/' + base.join('/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = inputValue.trim()
    if (!cmd || cmdRunning) return

    const wc = useWorkspaceStore.getState().webcontainerInstance
    if (!wc) {
      addTerminalLog('WebContainer not ready')
      return
    }

    setInputValue('')
    addTerminalLog(`${cwd} $ ${cmd}`)

    const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [cmd]
    const command = parts[0]
    const args = parts.slice(1).map((a) => a.replace(/^['"]|['"]$/g, ''))

    // Handle cd locally — spawn has no persistent state between calls
    if (command === 'cd') {
      setCwd(resolvePath(cwd, args[0] ?? ''))
      inputRef.current?.focus()
      return
    }

    setCmdRunning(true)
    try {
      const proc = await wc.spawn(command, args, { cwd })
      proc.output.pipeTo(
        new WritableStream({
          write(chunk) {
            const clean = stripAnsi(chunk)
            if (clean.trim()) addTerminalLog(clean)
          },
        })
      )
      await proc.exit
    } catch (err) {
      addTerminalLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCmdRunning(false)
      inputRef.current?.focus()
    }
  }

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
    setShowScrollBtn(!isAtBottom && logs.length > 0)
  }

  return (
    <div className="flex flex-col h-full bg-terminal-bg">
      <div className="h-7 border-t border-border-subtle flex items-center px-3 gap-2">
        <span className="text-xs uppercase tracking-wide text-text-muted font-medium">
          Terminal
        </span>
        <div className="flex-1" />
        <button
          onClick={() =>
            useWorkspaceStore.setState({ terminalLogs: [] })
          }
          className="p-0.5 text-text-muted hover:text-text-secondary"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto px-3 py-2 font-mono text-xs relative"
      >
        {logs.length === 0 ? (
          <span className="text-text-muted">
            Build output will appear during deployment...
          </span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={cn('leading-5', colorize(line))}>
              {line}
            </div>
          ))
        )}

        {showScrollBtn && (
          <button
            onClick={() => {
              setAutoScroll(true)
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth',
              })
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-bg-elevated border border-border rounded-full text-xs text-text-secondary hover:text-text-primary"
          >
            <ArrowDown className="w-3 h-3" />
            New output
          </button>
        )}
      </div>

      {/* Interactive input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-1.5 border-t border-border-subtle"
      >
        <span className="text-terminal-green text-xs font-mono flex-shrink-0 select-none">
          {cmdRunning ? '…' : `${cwd} $`}
        </span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={cmdRunning}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent text-xs font-mono text-terminal-text outline-none placeholder:text-text-muted disabled:opacity-50"
          placeholder="run a command..."
        />
      </form>
    </div>
  )
}
