import { create } from 'zustand'
import type { WebContainer } from '@webcontainer/api'
import type {
  TechStack,
  ChatMessage,
  JobStatus,
  FileTreeNode,
  MigrationPlan,
} from '@/types'

interface WorkspaceStore {
  jobId: string | null
  status: JobStatus
  techStack: TechStack | null
  originalFiles: Map<string, string>
  generatedFiles: Map<string, string>
  fileStatuses: Map<string, 'pending' | 'streaming' | 'complete' | 'error'>
  activeFile: string | null
  currentStreamingFile: string | null
  webcontainerInstance: WebContainer | null
  previewUrl: string | null
  terminalLogs: string[]
  chatMessages: ChatMessage[]
  clarificationQuestions: string[]
  clarificationAnswers: Record<string, string>
  showClarificationModal: boolean
  totalCostUSD: number
  fileTree: FileTreeNode[]
  migrationPlan: MigrationPlan | null
  elapsedSeconds: number
  detectedEnvVars: string[]
  envVarValues: Record<string, string>
  showBackendDialog: boolean
  backendRoot: string | null
  backendFramework: string | null
  showMigrationPlanModal: boolean
  legacyScore: number
  weaknesses: string[]
  previewRefreshKey: number

  // Actions
  setJobId: (id: string) => void
  setStatus: (s: JobStatus) => void
  setTechStack: (ts: TechStack) => void
  setOriginalFiles: (files: Map<string, string>) => void
  setOriginalFile: (file: string, content: string) => void
  appendToken: (file: string, token: string) => void
  setFileComplete: (file: string, content: string) => void
  setFileStreaming: (file: string) => void
  setActiveFile: (file: string) => void
  setWebcontainerInstance: (wc: WebContainer) => void
  addTerminalLog: (line: string) => void
  setPreviewUrl: (url: string) => void
  addChatMessage: (msg: ChatMessage) => void
  setClarificationQuestions: (questions: string[]) => void
  setClarificationAnswer: (question: string, answer: string) => void
  setShowClarificationModal: (show: boolean) => void
  setTotalCostUSD: (cost: number) => void
  setFileTree: (tree: FileTreeNode[]) => void
  setMigrationPlan: (plan: MigrationPlan) => void
  incrementElapsed: () => void
  setDetectedEnvVars: (vars: string[]) => void
  setEnvVarValue: (key: string, value: string) => void
  setShowBackendDialog: (show: boolean) => void
  setBackendInfo: (root: string, framework: string) => void
  setShowMigrationPlanModal: (show: boolean) => void
  setRepoAnalysis: (score: number, weaknesses: string[]) => void
  refreshPreview: () => void
  reset: () => void
}

const initialState = {
  jobId: null,
  status: 'idle' as JobStatus,
  techStack: null,
  originalFiles: new Map<string, string>(),
  generatedFiles: new Map<string, string>(),
  fileStatuses: new Map<string, 'pending' | 'streaming' | 'complete' | 'error'>(),
  activeFile: null,
  currentStreamingFile: null,
  webcontainerInstance: null,
  previewUrl: null,
  terminalLogs: [] as string[],
  chatMessages: [] as ChatMessage[],
  clarificationQuestions: [] as string[],
  clarificationAnswers: {} as Record<string, string>,
  showClarificationModal: false,
  totalCostUSD: 0,
  fileTree: [] as FileTreeNode[],
  migrationPlan: null,
  elapsedSeconds: 0,
  detectedEnvVars: [] as string[],
  envVarValues: {} as Record<string, string>,
  showBackendDialog: false,
  backendRoot: null,
  backendFramework: null,
  showMigrationPlanModal: false,
  legacyScore: 0,
  weaknesses: [] as string[],
  previewRefreshKey: 0,
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  ...initialState,

  setJobId: (id) => set({ jobId: id }),
  setStatus: (status) => set({ status }),
  setTechStack: (techStack) => set({ techStack }),
  setOriginalFiles: (files) => set({ originalFiles: files }),

  setOriginalFile: (file, content) =>
    set((state) => {
      const updated = new Map(state.originalFiles)
      updated.set(file, content)
      return { originalFiles: updated }
    }),

  appendToken: (file, token) =>
    set((state) => {
      const updated = new Map(state.generatedFiles)
      updated.set(file, (updated.get(file) ?? '') + token)
      return { generatedFiles: updated, currentStreamingFile: file }
    }),

  setFileComplete: (file, content) =>
    set((state) => {
      const updatedFiles = new Map(state.generatedFiles)
      updatedFiles.set(file, content)
      const updatedStatuses = new Map(state.fileStatuses)
      updatedStatuses.set(file, 'complete')
      return {
        generatedFiles: updatedFiles,
        fileStatuses: updatedStatuses,
        currentStreamingFile:
          state.currentStreamingFile === file
            ? null
            : state.currentStreamingFile,
      }
    }),

  setFileStreaming: (file) =>
    set((state) => {
      const updatedStatuses = new Map(state.fileStatuses)
      updatedStatuses.set(file, 'streaming')
      return {
        fileStatuses: updatedStatuses,
        currentStreamingFile: file,
        activeFile: file,
      }
    }),

  setActiveFile: (file) => set({ activeFile: file }),
  setWebcontainerInstance: (wc) => set({ webcontainerInstance: wc }),

  addTerminalLog: (line) =>
    set((state) => ({
      terminalLogs: [...state.terminalLogs.slice(-499), line],
    })),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg],
    })),

  setClarificationQuestions: (questions) =>
    set({ clarificationQuestions: questions }),

  setClarificationAnswer: (question, answer) =>
    set((state) => ({
      clarificationAnswers: {
        ...state.clarificationAnswers,
        [question]: answer,
      },
    })),

  setShowClarificationModal: (show) => set({ showClarificationModal: show }),
  setTotalCostUSD: (cost) => set({ totalCostUSD: cost }),
  setFileTree: (tree) => set({ fileTree: tree }),
  setMigrationPlan: (plan) => set({ migrationPlan: plan }),
  incrementElapsed: () =>
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),

  setDetectedEnvVars: (vars) => set({ detectedEnvVars: vars }),

  setEnvVarValue: (key, value) =>
    set((state) => ({
      envVarValues: { ...state.envVarValues, [key]: value },
    })),

  setShowBackendDialog: (show) => set({ showBackendDialog: show }),

  setBackendInfo: (root, framework) =>
    set({ backendRoot: root, backendFramework: framework }),

  setShowMigrationPlanModal: (show) => set({ showMigrationPlanModal: show }),

  setRepoAnalysis: (score, weaknesses) => set({ legacyScore: score, weaknesses }),

  refreshPreview: () => set((state) => ({ previewRefreshKey: state.previewRefreshKey + 1 })),

  reset: () => set(initialState),
}))
