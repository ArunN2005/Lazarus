# LAZARUS — Main Build Instructions

> READ THIS FILE FIRST, then ARCHITECTURE.md, then DESIGN.md.
> After reading all three, write a brief summary of the full system and
> ask any clarifying questions BEFORE writing a single line of code.

---

## WHAT IS LAZARUS

Lazarus is a legacy GitHub repository resurrection engine. A user pastes
any old/broken GitHub repo URL (2015 React app, Flask monolith, Angular 1.x)
and Lazarus:

1. Authenticates via GitHub OAuth (Clerk)
2. Scans the repo → shows file tree + runs legacy app in WebContainers
3. Asks 2-4 clarifying questions if the repo's intent is unclear
4. On "Start Resurrection": sends the ENTIRE codebase in ONE Bedrock call
   and streams all modernized files back simultaneously (exactly how Bolt.new works)
5. Each file token streams live into Monaco editor
6. WebContainers runs the modernized code live in browser as files arrive
7. User chats to request changes, then creates a PR back to their GitHub repo

---

## TECH STACK — NO SUBSTITUTIONS

### Frontend
- **Next.js 14** (App Router, TypeScript strict mode)
- **Tailwind CSS** + **shadcn/ui**
- **@monaco-editor/react** — code editor with streaming support
- **@webcontainer/api** — runs Node.js in browser (Bolt.new's core technology)
- **Zustand** — all global state
- **Clerk** — GitHub OAuth, user sessions
- **Vercel AI SDK** (`ai` package) — handles Bedrock streaming to browser
- **Framer Motion** — all page and component animations
- **lucide-react** — icons
- **clsx** + **tailwind-merge** — classnames
- **Geist** font via `next/font/google`

### Backend (Next.js API routes, deployed on AWS Amplify)
- **Next.js API routes** — all server logic
- **AWS SDK v3** — Bedrock, S3, DynamoDB, Secrets Manager
- **Amazon Bedrock** — `claude-sonnet-4-6` for generation, `claude-haiku-4-5` for classification
- **Inngest** — background job orchestration (Inspector → Resurrector pipeline)
- **simple-git** — repo cloning in API routes
- **Zod** — input validation on every route
- **@octokit/rest** — GitHub API (PR creation, repo browsing)

### Infrastructure
- **AWS Amplify** — hosts the Next.js app
- **Amazon S3** — repo files, generated files
- **Amazon DynamoDB** — job state (single table)
- **Amazon Secrets Manager** — user's ENV vars for resurrected apps

---

## COMPLETE PROJECT STRUCTURE

```
lazarus/
├── .env.local
├── CLAUDE.md
├── ARCHITECTURE.md
├── DESIGN.md
├── next.config.ts              ← MUST add COOP/COEP headers for WebContainers
├── tailwind.config.ts
├── components.json             ← shadcn/ui
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← ClerkProvider, Geist font, global metadata
│   │   ├── globals.css
│   │   ├── page.tsx            ← Landing page
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   └── workspace/
│   │       └── [jobId]/
│   │           └── page.tsx    ← 3-panel workspace
│   └── app/api/
│       ├── inngest/
│       │   └── route.ts        ← Inngest webhook
│       ├── scan/
│       │   └── route.ts        ← POST: scan repo
│       ├── resurrect/
│       │   └── route.ts        ← POST: start resurrection
│       ├── stream/
│       │   └── [jobId]/
│       │       └── route.ts    ← GET: SSE token stream
│       ├── jobs/
│       │   └── [jobId]/
│       │       ├── route.ts    ← GET: job status
│       │       ├── chat/
│       │       │   └── route.ts ← POST: conversational edits
│       │       └── pr/
│       │           └── route.ts ← POST: create GitHub PR
│       └── webhooks/
│           └── clerk/
│               └── route.ts
│   ├── components/
│   │   ├── landing/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── RepoInput.tsx
│   │   │   ├── GithubRepoPicker.tsx
│   │   │   └── ExampleRepos.tsx
│   │   ├── workspace/
│   │   │   ├── WorkspaceLayout.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── FileTreePanel.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── EditorPanel.tsx
│   │   │   ├── PreviewPanel.tsx
│   │   │   ├── TerminalPanel.tsx
│   │   │   └── ClarificationModal.tsx
│   │   ├── scan/
│   │   │   └── ScanResults.tsx
│   │   └── ui/                 ← shadcn components
│   ├── stores/
│   │   └── workspace-store.ts
│   ├── hooks/
│   │   ├── useResurrection.ts
│   │   ├── useWebContainer.ts
│   │   └── useStreamingEditor.ts
│   ├── lib/
│   │   ├── bedrock.ts
│   │   ├── dynamodb.ts
│   │   ├── s3.ts
│   │   ├── github.ts
│   │   ├── secrets.ts
│   │   └── inngest-client.ts
│   ├── inngest/
│   │   ├── functions/
│   │   │   ├── inspector.ts
│   │   │   ├── resurrector.ts
│   │   │   └── clarifier.ts
│   │   └── index.ts
│   └── types/
│       └── index.ts
```

---

## THE RESURRECTION FLOW

### Phase 0 — Scan

```
User pastes GitHub URL (or picks from GitHub OAuth repo list)
    ↓
POST /api/scan
    ↓
Inngest inspector function:
  clone repo → detect tech stack → find ENV vars → check if web app
  Run original code in WebContainers (legacy preview)
    ↓
ScanResults: file tree, detected stack, ENV var prompts, legacy preview
"Start Resurrection" button appears
```

### Phase 1 — Clarify (only if needed)

```
If repo purpose is unclear (no README, generic name, ambiguous stack):
  ClarificationModal: 2-4 Haiku-generated questions
  e.g. "Preserve original look or full modernization?"
       "TypeScript or JavaScript output?"
  User answers → saved to job
```

### Phase 2 — Resurrect (THE CRITICAL PHASE)

```
POST /api/resurrect
    ↓
Inngest resurrector function:

  ONE SINGLE Bedrock call (Sonnet 4.6, 1M context):
    Input:  ALL original repo files + migration system prompt + user answers
    Output: ALL modernized files streamed sequentially
    
    This is why code is coherent — same brain, same call, same context.
    File A and File B are generated with full awareness of each other.
    ↓
  Tokens stream via SSE to browser (GET /api/stream/[jobId])
    ↓
  Frontend routes tokens to Monaco (executeEdits, not setValue)
    ↓
  Each completed file → webcontainer.fs.writeFile() immediately
    ↓
  WebContainer HMR updates preview as each file arrives
    ↓
  After all files: npm install → npm run dev → preview URL ready
```

### Phase 3 — Iterate + Ship

```
Chat: POST /api/jobs/[jobId]/chat
  Haiku identifies files to change
  Sonnet regenerates only those files (streaming)
  Files injected into WebContainer → instant preview update

PR: POST /api/jobs/[jobId]/pr
  All generated files → new branch → GitHub PR
```

---

## WEBCONTAINERS — CRITICAL SETUP

Add to `next.config.ts` (required for SharedArrayBuffer):

```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }]
  },
}
```

### useWebContainer.ts

```typescript
// Boot ONCE when workspace page mounts
// Store instance in Zustand — never re-boot
// 
// On file_complete SSE event:
//   await wc.fs.writeFile(filePath, content)
//   (WebContainer HMR picks this up automatically)
//
// After all files complete:
//   const install = await wc.spawn('npm', ['install'])
//   install.output.pipeTo(new WritableStream({
//     write(chunk) { store.addTerminalLog(chunk) }
//   }))
//   await install.exit
//   await wc.spawn('npm', ['run', 'dev'])
//   wc.on('server-ready', (port, url) => {
//     store.setPreviewUrl(url)
//   })
//
// On chat edit (single file):
//   await wc.fs.writeFile(filePath, newContent)
//   HMR handles the rest — no npm install needed
```

---

## MONACO STREAMING — CRITICAL

```typescript
// useStreamingEditor.ts
// NEVER use editor.setValue() during streaming — causes full re-render + scroll jump
// ALWAYS use editor.executeEdits():

const appendToken = (editor: monaco.editor.IStandaloneCodeEditor, token: string) => {
  const model = editor.getModel()
  if (!model) return
  const lastLine = model.getLineCount()
  const lastCol = model.getLineLength(lastLine) + 1
  editor.executeEdits('stream', [{
    range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
    text: token,
    forceMoveMarkers: true,
  }])
  editor.revealLine(model.getLineCount(), monaco.editor.ScrollType.Smooth)
}

// When file_start SSE arrives:
//   Clear Monaco content (setValue is fine here — file is starting fresh)
//   Set language based on file extension
//   Auto-switch FileTree to highlight this file

// When file_complete SSE arrives:
//   Switch Monaco to diff view: original (left) vs generated (right)
//   Mark AI-changed lines with green gutter decoration
```

---

## BEDROCK CALL — THE CORE

```typescript
// lib/bedrock.ts
// Model: process.env.BEDROCK_MODEL_SONNET
// Enable 1M context window:

const response = await bedrockClient.send(new InvokeModelWithResponseStreamCommand({
  modelId: process.env.BEDROCK_MODEL_SONNET,
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    anthropic_beta: ['context-1m-2025-08-07'],  // enables 1M context
    max_tokens: 128000,
    system: MIGRATION_SYSTEM_PROMPT,             // from ARCHITECTURE.md
    messages: [{
      role: 'user',
      content: buildResurrectionPrompt(files, answers)  // ALL files in one prompt
    }]
  }),
  contentType: 'application/json',
  accept: 'application/json',
}))

// Parse streaming chunks:
for await (const chunk of response.body) {
  const parsed = JSON.parse(new TextDecoder().decode(chunk.chunk?.bytes))
  const token = parsed?.delta?.text
  if (token) await onToken(token)
}
```

---

## OUTPUT FORMAT FROM BEDROCK

Instruct Bedrock to output files in this exact XML format (easy to parse):

```
<file path="package.json">
{
  "name": "my-app",
  ...
}
</file>

<file path="src/App.tsx">
import React from 'react'
...
</file>
```

Parse the stream by watching for `<file path="...">` opening tags
and `</file>` closing tags. Everything between is the file content.
Buffer each file's tokens → on `</file>` → emit file_complete event.

---

## ZUSTAND STORE

```typescript
interface WorkspaceStore {
  jobId: string | null
  status: 'idle' | 'scanning' | 'scanned' | 'clarifying' |
          'resurrecting' | 'complete' | 'failed'
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
  // Actions
  setJobId: (id: string) => void
  setStatus: (s: WorkspaceStore['status']) => void
  appendToken: (file: string, token: string) => void
  setFileComplete: (file: string, content: string) => void
  setActiveFile: (file: string) => void
  addTerminalLog: (line: string) => void
  setPreviewUrl: (url: string) => void
  addChatMessage: (msg: ChatMessage) => void
}
```

---

## DYNAMODB SCHEMA (single table)

Table: `process.env.DYNAMODB_TABLE_NAME`

```
Job record:
  PK: JOB#{jobId}
  SK: meta
  Fields: userId, repoUrl, repoOwner, repoName, status, techStack,
          s3KeyPrefix, totalCostUSD, createdAt, completedAt

File record:
  PK: JOB#{jobId}
  SK: FILE#{filePath}
  Fields: originalContent (presigned URL), generatedContent (presigned URL), status

Chat message:
  PK: JOB#{jobId}
  SK: CHAT#{timestamp}
  Fields: role, content
```

---

## TECH STACK DETECTION (Inspector — zero AI)

```typescript
// Purely deterministic pattern matching. No Bedrock calls.

// Package manager: check lockfiles first (never package.json)
if (files.has('bun.lockb'))          return 'bun'
if (files.has('pnpm-lock.yaml'))     return 'pnpm'
if (files.has('yarn.lock'))          return 'yarn'
if (files.has('package-lock.json'))  return 'npm'

// Frontend framework: file existence + content signatures
if (files.has('next.config.js') || files.has('next.config.ts')) return 'nextjs'
if (files.has('nuxt.config.ts'))    return 'nuxt'
if (files.has('svelte.config.js'))  return 'sveltekit'
if (files.has('angular.json'))      return 'angular'
// Search content for: createRoot( → React 18, ReactDOM.render( → React 16/17
// Search content for: createApp( + .vue files → Vue 3

// Backend
if (anyFileContains('FastAPI()'))   return 'fastapi'
if (anyFileContains('Flask('))      return 'flask'
if (files.has('manage.py'))         return 'django'
if (anyFileContains('app.listen(')) return 'express'
if (files.has('config/routes.rb'))  return 'rails'
```

---

## HARD REJECT RULES

Reject immediately with a clear user-facing message if:
- Unity project (`Assets/` dir + `.unity` files)
- Unreal Engine (`.uproject` file)
- iOS app (`*.xcodeproj` + Swift files, no server)
- Android (`AndroidManifest.xml` + `build.gradle`, no server)
- Electron app (`BrowserWindow` in package.json main)
- Browser extension (`manifest.json` with `manifest_version`)
- React Native (`react-native` in deps or `app.json` with `expo`)
- WordPress (`style.css` with `Theme Name:` or PHP with `Plugin Name:`)
- Repo > 500MB
- Fewer than 3 source files
- Private repo without GitHub token

---

## ENV VARS — COMPLETE LIST

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Amazon Bedrock (cross-region inference profile ARNs for 1M context)
BEDROCK_MODEL_SONNET=us.anthropic.claude-sonnet-4-6-20250915-v1:0
BEDROCK_MODEL_HAIKU=us.anthropic.claude-haiku-4-5-20251001-v1:0

# Amazon DynamoDB
DYNAMODB_TABLE_NAME=lazarus-jobs

# Amazon S3
S3_BUCKET_REPOS=lazarus-repos
S3_BUCKET_GENERATED=lazarus-generated

# Amazon Secrets Manager (user ENV vars for resurrected apps)
SECRETS_MANAGER_PREFIX=lazarus

# GitHub (for PR creation — create a GitHub OAuth App)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## ENV VALIDATION — DO THIS FIRST

Create `src/lib/env.ts` as the very first file. Every other file imports from here.
Never use `process.env.X` directly anywhere else in the codebase.

```typescript
import { z } from 'zod'

const envSchema = z.object({
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  // AWS
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // Bedrock
  BEDROCK_MODEL_SONNET: z.string().min(1),
  BEDROCK_MODEL_HAIKU: z.string().min(1),

  // DynamoDB
  DYNAMODB_TABLE_NAME: z.string().min(1),

  // S3
  S3_BUCKET_REPOS: z.string().min(1),
  S3_BUCKET_GENERATED: z.string().min(1),

  // Secrets Manager
  SECRETS_MANAGER_PREFIX: z.string().min(1),

  // GitHub
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  // Inngest
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Missing or invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — check .env.local')
}

export const env = parsed.data
```

This means if you start the app with a missing env var, it crashes immediately
with a clear error message telling you exactly which var is missing.
Much better than a cryptic AWS error 10 minutes into a resurrection job.

---

## CODE QUALITY — NON-NEGOTIABLE

- No `any` types. Ever.
- Zod validation on every API route input as first operation
- Error boundaries wrapping every major UI section
- Never blank panels — always skeleton/spinner loading states
- `executeEdits` not `setValue` in Monaco during streaming
- WebContainer boots once, stored in Zustand
- AWS SDK v3 only (never v2)
- Secrets Manager for user ENV vars (never S3 or DynamoDB)
- `default_branch` from GitHub API response (never hardcode 'main' or 'master')

---

## BUILD ORDER

Do these in order. Run `npx tsc --noEmit` after each group.

```
Group 1 — Types + Lib (no dependencies between files):
  src/types/index.ts
  src/lib/dynamodb.ts
  src/lib/s3.ts
  src/lib/bedrock.ts
  src/lib/github.ts
  src/lib/secrets.ts
  src/lib/inngest-client.ts

Group 2 — Inngest functions:
  src/inngest/functions/inspector.ts
  src/inngest/functions/clarifier.ts
  src/inngest/functions/resurrector.ts
  src/inngest/index.ts

Group 3 — API routes:
  All routes in src/app/api/

Group 4 — State + Hooks:
  src/stores/workspace-store.ts
  src/hooks/useWebContainer.ts
  src/hooks/useStreamingEditor.ts
  src/hooks/useResurrection.ts

Group 5 — UI (see DESIGN.md for all visual specs):
  All components
  All pages

Group 6 — Config:
  next.config.ts (COOP/COEP headers — critical for WebContainers)
  tailwind.config.ts
```

When building Group 1 (lib files) and Group 3 (API routes),
use subagents to work on independent files in parallel.
Do NOT use subagents for Group 5 (UI components) — they share
state and design decisions that need sequential context.


## OVERENGINEERING RULE
Only build what is specified. No extra abstractions, no unrequested 
error handling, no JSDoc on unchanged code, no helpers for one-time 
operations, no features beyond the spec. If something isn't in 
CLAUDE.md, ARCHITECTURE.md, or DESIGN.md — don't build it.


## INVESTIGATION RULE
Before modifying any existing file, read it first. Never speculate 
about what code says — open it. When debugging, read every file 
in the call chain before suggesting a fix.

## GENERAL-PURPOSE IMPLEMENTATION RULE
Implement real logic, not solutions that only work for known inputs.

Do not hardcode values that should be derived at runtime
Do not special-case specific inputs to pass specific scenarios
Implement the actual algorithm, not a shortcut that mimics it
If a task seems unreasonable or a requirement seems contradictory, say so rather than working around it silently
Solutions must be robust for all valid inputs, not just the examples shown in this file


