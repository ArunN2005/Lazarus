export interface TechStack {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'
  frontend: string | null
  backend: string | null
  language: 'typescript' | 'javascript' | 'python' | 'ruby' | 'unknown'
  database: string | null
  cssFramework: string | null
  testFramework: string | null
}

export type JobStatus =
  | 'idle'
  | 'scanning'
  | 'scanned'
  | 'clarifying'
  | 'resurrecting'
  | 'complete'
  | 'failed'
  | 'rejected'

export interface Job {
  jobId: string
  userId: string
  repoUrl: string
  repoOwner: string
  repoName: string
  status: JobStatus
  techStack: TechStack | null
  s3KeyPrefix: string
  totalCostUSD: number
  rejectionReason: string | null
  envVars: string[]
  clarificationQuestions: string[]
  clarificationAnswers: Record<string, string>
  createdAt: string
  completedAt: string | null
  legacyScore: number       // 0–100: how outdated the repo is (higher = more work)
  weaknesses: string[]      // human-readable list of detected issues
}

export interface FileRecord {
  jobId: string
  filePath: string
  originalContent: string | null
  generatedContent: string | null
  status: 'pending' | 'streaming' | 'complete' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export type SSEEvent =
  | { type: 'file_start'; file: string }
  | { type: 'token'; file: string; token: string }
  | { type: 'file_complete'; file: string; content: string }
  | { type: 'asset_complete'; file: string; base64: string }
  | { type: 'install_start' }
  | { type: 'install_log'; line: string }
  | { type: 'preview_ready'; url: string }
  | { type: 'cost_update'; totalUSD: number }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'complete' }
  | { type: 'chat_complete'; needsInstall: boolean }

export interface ScanResult {
  jobId: string
  techStack: TechStack
  fileCount: number
  envVars: string[]
  questions: string[]
  fileTree: FileTreeNode[]
  rejected: boolean
  rejectionReason: string | null
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface MigrationPlan {
  categories: MigrationCategory[]
  filesToGenerate: MigrationFile[]
  totalFiles: number
  newFiles: number
  modifiedFiles: number
}

export interface MigrationCategory {
  name: string
  effort: 'low' | 'medium' | 'high'
  currentStack: string
  targetStack: string
  description: string
}

export interface MigrationFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  category: string
  description: string
}

export const PRICING = {
  sonnet: { input: 3.0, output: 15.0, cached: 0.3 },
  haiku: { input: 0.25, output: 1.25, cached: 0.03 },
} as const

export type BedrockModel = keyof typeof PRICING
