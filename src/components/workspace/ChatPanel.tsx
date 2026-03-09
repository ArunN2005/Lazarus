'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, X, ImageIcon } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWebContainer } from '@/hooks/useWebContainer'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

const SUGGESTIONS = [
  'Add dark mode',
  'Fix the layout',
  'Add loading states',
  'Improve styling',
]

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  // Image generation state
  const [imageMode, setImageMode] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const jobId = useWorkspaceStore((s) => s.jobId)
  const status = useWorkspaceStore((s) => s.status)
  const messages = useWorkspaceStore((s) => s.chatMessages)
  const addMessage = useWorkspaceStore((s) => s.addChatMessage)
  const setFileComplete = useWorkspaceStore((s) => s.setFileComplete)
  const generatedFiles = useWorkspaceStore((s) => s.generatedFiles)
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview)
  const { writeFile } = useWebContainer()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (text?: string) => {
    const message = text ?? input.trim()
    if (!message || sending || !jobId) return

    const isResurrecting = status === 'resurrecting'
    if (isResurrecting) return

    setSending(true)
    setInput('')
    setShowSuggestions(false)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)

    try {
      const currentFiles: Record<string, string> = {}
      for (const [path, content] of Array.from(generatedFiles.entries())) {
        currentFiles[path] = content
      }

      const res = await fetch(`/api/jobs/${jobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, generatedFiles: currentFiles }),
      })

      if (res.ok) {
        const data = await res.json()
        addMessage(data.message)

        if (data.updatedFiles) {
          for (const file of data.updatedFiles) {
            if (file.path && file.content) {
              setFileComplete(file.path, file.content)
              await writeFile(file.path, file.content)
            }
          }
        }
      }
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Failed to send message',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setSending(false)
    }
  }

  const handleGenerateImage = useCallback(async () => {
    if (!imagePrompt.trim() || generatingImage || !jobId) return

    setGeneratingImage(true)
    const prompt = imagePrompt.trim()
    setImagePrompt('')
    setImageMode(false)

    // Show user's request in chat
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Generate image: ${prompt}`,
      timestamp: new Date().toISOString(),
    })

    try {
      const res = await fetch(`/api/jobs/${jobId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error ?? 'Image generation failed')
      }

      const { imagePath, filename, base64 } = await res.json() as {
        imagePath: string
        filename: string
        base64: string
      }

      // Write image to WebContainer so it's served by the preview
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      await writeFile(`public/generated-images/${filename}`, bytes)
      await writeFile(`frontend/public/generated-images/${filename}`, bytes)
      refreshPreview()

      // Show result in chat with thumbnail + usage hint
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `__image__${base64}__path__${imagePath}`,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed'
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Image generation failed: ${message}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setGeneratingImage(false)
    }
  }, [imagePrompt, generatingImage, jobId, addMessage, writeFile, refreshPreview])

  const disabled = status === 'resurrecting'

  return (
    <div className="flex flex-col h-full bg-bg-panel">
      <div className="px-3 py-2 border-b border-border-subtle">
        <span className="text-xs uppercase tracking-wide text-text-muted font-medium">
          Chat
        </span>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.map((msg) => {
            // Special rendering for generated images
            if (
              msg.role === 'assistant' &&
              msg.content.startsWith('__image__')
            ) {
              const b64 = msg.content.replace('__image__', '').split('__path__')[0]
              const path = msg.content.split('__path__')[1]
              return (
                <div key={msg.id} className="space-y-2">
                  <div className="rounded-xl overflow-hidden border border-border-subtle max-w-[200px]">
                    <img
                      src={`data:image/png;base64,${b64}`}
                      alt="Generated"
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="bg-bg-elevated rounded-xl rounded-bl-sm px-3 py-2 max-w-[85%]">
                    <p className="text-xs text-text-secondary">
                      Image ready at{' '}
                      <code className="text-accent font-mono">{path}</code>
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Say &quot;use this as the hero background&quot; to insert it
                    </p>
                    <div className="text-xs text-text-muted mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-accent-dim rounded-xl rounded-br-sm text-text-primary'
                    : msg.role === 'system'
                      ? 'text-text-muted text-xs italic'
                      : 'bg-bg-elevated rounded-xl rounded-bl-sm text-text-primary'
                )}
              >
                {msg.content}
                <div className="text-xs text-text-muted mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )
          })}

          {(sending || generatingImage) && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <Loader2 className="w-3 h-3 animate-spin" />
              {generatingImage ? 'Generating image...' : 'Thinking...'}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border-subtle space-y-2">
        {/* Image generation panel */}
        {imageMode && (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-accent/30 bg-accent/5">
            <ImageIcon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <input
              autoFocus
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerateImage()
                if (e.key === 'Escape') { setImageMode(false); setImagePrompt('') }
              }}
              placeholder="Describe the image to generate..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            <button
              onClick={handleGenerateImage}
              disabled={!imagePrompt.trim() || generatingImage}
              className="p-1 text-accent hover:text-white transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setImageMode(false); setImagePrompt('') }}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showSuggestions && messages.length === 0 && !disabled && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-xs px-2 py-1 border border-border rounded-full text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => setImageMode((v) => !v)}
            disabled={disabled}
            title="Generate image with AI"
            className={cn(
              'p-2 rounded-lg border transition-colors disabled:opacity-40',
              imageMode
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'border-border text-text-muted hover:text-text-secondary hover:border-border-strong bg-bg-elevated'
            )}
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              disabled
                ? 'Wait for completion first'
                : 'Ask a question or describe a change...'
            }
            disabled={disabled}
            rows={1}
            className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || disabled}
            className="p-2 bg-accent rounded-lg text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
