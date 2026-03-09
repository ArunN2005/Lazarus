'use client'

import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { EnvSetupBanner } from './EnvSetupBanner'
import { FileTreePanel } from './FileTreePanel'
import { ChatPanel } from './ChatPanel'
import { EditorPanel } from './EditorPanel'
import { PreviewPanel } from './PreviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { BackendStartDialog } from './BackendStartDialog'

interface WorkspaceLayoutProps {
  onStartResurrection: () => void
  resurrectionLoading: boolean
}

export function WorkspaceLayout({
  onStartResurrection,
  resurrectionLoading,
}: WorkspaceLayoutProps) {
  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background:
          'radial-gradient(ellipse 120% 50% at 25% 0%, rgba(99,102,241,0.07) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 80% 100%, rgba(6,182,212,0.04) 0%, transparent 55%), #030712',
      }}
    >
      <TopBar
        onStartResurrection={onStartResurrection}
        resurrectionLoading={resurrectionLoading}
      />

      <EnvSetupBanner />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left: File tree + Chat */}
          <Panel defaultSize={18} minSize={12} maxSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={50} minSize={20}>
                <FileTreePanel />
              </Panel>
              <PanelResizeHandle className="h-px bg-white/[0.05] hover:bg-accent/50 transition-colors" />
              <Panel defaultSize={50} minSize={20}>
                <ChatPanel />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-px bg-white/[0.05] hover:bg-accent/50 transition-colors" />

          {/* Center: Editor + Terminal */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={75} minSize={30}>
                <EditorPanel />
              </Panel>
              <PanelResizeHandle className="h-px bg-white/[0.05] hover:bg-accent/50 transition-colors" />
              <Panel defaultSize={25} minSize={10}>
                <TerminalPanel />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-px bg-white/[0.05] hover:bg-accent/50 transition-colors" />

          {/* Right: Preview */}
          <Panel defaultSize={32} minSize={20} maxSize={50}>
            <PreviewPanel />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
      <BackendStartDialog />
    </div>
  )
}
