# LAZARUS — Architecture Reference

---

## WHY ONE BEDROCK CALL SOLVES COHERENCE

The entire reason generated code is coherent in Lazarus is that ALL files
are generated in a single Bedrock call. When Bedrock writes `authService.ts`
and then `UserDashboard.tsx` in the same response, it already knows exactly
what it put in `authService.ts` — it's in its own output context.

No manifest needed. No cross-file validation. No import resolver.
Same brain. Same call. Same context window. Perfect coherence.

This is exactly how Bolt.new works. Do not deviate from this approach.

---

## AWS SERVICES — WHY EACH ONE

| Service | Used For | Why Not Something Else |
|---------|----------|----------------------|
| **Amazon Bedrock** (Sonnet 4.6) | ALL code generation — one streaming call | Core product. 1M context window. Best code quality. |
| **Amazon Bedrock** (Haiku 4.5) | Clarifying questions, chat file identification | Fast + cheap for small classification tasks |
| **Amazon DynamoDB** | Job state, file metadata, chat history | Single-table, serverless, free tier generous |
| **Amazon S3** | Repo files + generated files storage | Lambda/Amplify can't hold 50MB in memory |
| **Amazon Secrets Manager** | User ENV vars for resurrected apps | Never store secrets in DB or S3 |
| **AWS Amplify** | Host the Next.js app | Zero config for Next.js, auto HTTPS, CDN |
| **Inngest** | Background jobs (inspector, resurrector) | Step-by-step pipelines with retries, free tier |
| **WebContainers** | Run Node.js in browser | Instant preview — no servers, no Docker |
| **Clerk** | GitHub OAuth + user auth | 10 lines of code, free tier, GitHub login built-in |

---

## BEDROCK CONFIGURATION

### Model IDs (cross-region inference profiles for 1M context)
```
Sonnet: us.anthropic.claude-sonnet-4-6-20250915-v1:0
Haiku:  us.anthropic.claude-haiku-4-5-20251001-v1:0
```

### Enable 1M context window
```json
{
  "anthropic_beta": ["context-1m-2025-08-07"]
}
```

### Token limits
- Context window: 200k default, 1M with beta flag
- Max output tokens: 128,000
- Typical 20-file repo: ~28k input + ~30k output = ~58k total (well within limits)
- Typical 50-file repo: ~85k total (still comfortable)

### Pricing
- Sonnet input: $3/M tokens, output: $15/M tokens
- Haiku input: $0.25/M, output: $1.25/M
- Typical resurrection cost: $0.40–$0.80 per job
- Use `anthropic-beta: prompt-caching-2024-07-31` for repeated system prompt caching

---

## MIGRATION SYSTEM PROMPT

Store this in `src/lib/migration-prompt.ts` as a constant.
This is the system prompt sent to Bedrock for every resurrection.

```
You are Lazarus — a code modernization engine. Your job is to take a legacy
web application and modernize it completely while preserving all functionality.

## Core Rules (NEVER violate these)
1. NEVER remove any API route, endpoint, or URL path
2. NEVER modify database table names or column names  
3. NEVER remove features that exist in the original
4. NEVER use TypeScript 'any' type
5. NEVER add features not present in the original
6. ALWAYS preserve all comments, JSDoc, TODO, and FIXME annotations
7. ALWAYS preserve the application's core purpose and user flows

## Modernization Rules
- Update all deprecated packages to current equivalents:
  node-sass → sass
  request → axios  
  moment → dayjs
  faker → @faker-js/faker
  react-scripts → vite (or next.js if appropriate)
  body-parser → express.json()
  
- Update React:
  ReactDOM.render() → createRoot()
  componentDidMount/Update → useEffect
  class components → functional components with hooks
  PropTypes → TypeScript interfaces
  
- Update Node.js patterns:
  callbacks → async/await (ALWAYS promisify first, then await)
  var → const/let
  require() → import/export (ESM)
  
- Update Angular:
  NgModules → standalone components
  Old lifecycle hooks → new equivalents
  
- Update Vue 2 → Vue 3:
  Options API → Composition API
  Vue.set/delete → reactive()
  
- Security improvements (always add):
  Express: add helmet, cors, express-rate-limit
  FastAPI/Flask: add CORS middleware
  
- Performance improvements:
  Add React.memo/useMemo/useCallback where appropriate
  Add lazy loading for routes
  Add proper error boundaries

## Output Format
Output EVERY file in this exact XML format. No exceptions.
Include ALL files from the original repo, even unchanged ones.

<file path="package.json">
[complete file contents]
</file>

<file path="src/App.tsx">
[complete file contents]
</file>

Start with package.json, then tsconfig.json, then work outward to
utility files, then services, then components, then pages.
This order ensures each file is written with full context of its dependencies.

## Tech Stack Targeting
[INJECT DETECTED TECH STACK HERE AT RUNTIME]

## User Preferences
[INJECT USER'S CLARIFICATION ANSWERS HERE AT RUNTIME]
```

---

## INNGEST PIPELINE

### inspector function
```typescript
export const inspector = inngest.createFunction(
  { id: 'inspector', name: 'Inspect Repository' },
  { event: 'lazarus/scan.requested' },
  async ({ event, step }) => {
    const { jobId, repoUrl, userId } = event.data

    const files = await step.run('clone-repo', async () => {
      // Clone to /tmp, read all source files
      // Delete: node_modules, .git, dist, build, *.min.js, *.map
      // Return Map<filePath, content>
    })

    const techStack = await step.run('detect-stack', async () => {
      // Pure deterministic detection (see CLAUDE.md)
      // Zero Bedrock calls
    })

    const validation = await step.run('validate-repo', async () => {
      // Check hard rejection rules
      // If rejected: return { rejected: true, reason: '...' }
    })

    if (validation.rejected) {
      await step.run('mark-rejected', async () => {
        // Update DynamoDB job status to 'rejected'
        // Store rejection reason
      })
      return { rejected: true, reason: validation.reason }
    }

    const envVars = await step.run('scan-env-vars', async () => {
      // Regex patterns to find process.env.*, os.environ.get(), etc.
      // Return list of required ENV var names
    })

    const questions = await step.run('generate-questions', async () => {
      // Only if: no README, generic repo name, or ambiguous stack
      // Haiku call: generate 2-4 clarifying questions
      // Returns [] if repo purpose is obvious
    })

    await step.run('store-files', async () => {
      // Upload all files to S3: repos/{jobId}/{filePath}
      // Update DynamoDB: status='scanned', techStack, envVars, questions
    })

    return { jobId, techStack, fileCount: files.size, envVars, questions }
  }
)
```

### resurrector function
```typescript
export const resurrector = inngest.createFunction(
  { id: 'resurrector', name: 'Resurrect Repository',
    retries: 2, timeout: '15m' },
  { event: 'lazarus/resurrection.requested' },
  async ({ event, step }) => {
    const { jobId, answers } = event.data

    const { files, techStack } = await step.run('load-files', async () => {
      // Load all files from S3
      // Build combined prompt with all file contents
    })

    await step.run('generate', async () => {
      // THE CORE CALL
      // One Bedrock InvokeModelWithResponseStream call
      // anthropic_beta: ['context-1m-2025-08-07']
      // 
      // As tokens arrive: parse <file path="..."> boundaries
      // Write completed files to S3 AND push to SSE stream
      // Update DynamoDB file status as each completes
    })

    await step.run('finalize', async () => {
      // Update job status to 'complete'
      // Calculate final cost
      // Send 'complete' SSE event
    })
  }
)
```

---

## SSE STREAMING ARCHITECTURE

The browser never holds a raw Bedrock connection open.
Bedrock streams to Lambda (server-side), Lambda writes to DynamoDB,
SSE route reads and pushes events to browser.

```
Bedrock stream → Inngest function (Lambda)
                      ↓ writes tokens to DynamoDB stream records
                      ↓ writes completed files to S3

Browser GET /api/stream/[jobId] (SSE, long-lived connection)
  Polls DynamoDB for new events since lastSeen
  Pushes them as SSE events
  Keeps connection alive with comment pings every 15s
```

### SSE Event Types
```typescript
type SSEEvent =
  | { type: 'file_start';    file: string }
  | { type: 'token';         file: string; token: string }
  | { type: 'file_complete'; file: string; content: string }
  | { type: 'install_start' }
  | { type: 'install_log';   line: string }
  | { type: 'preview_ready'; url: string }
  | { type: 'cost_update';   totalUSD: number }
  | { type: 'error';         message: string; recoverable: boolean }
  | { type: 'complete' }
```

---

## GITHUB INTEGRATION

### Getting user's GitHub token via Clerk
```typescript
// In API routes, get the user's GitHub OAuth token:
const { userId } = auth()
const user = await clerkClient.users.getUser(userId)
const githubToken = user.externalAccounts
  .find(a => a.provider === 'github')
  ?.accessToken
```

### Repo picker (landing page)
```typescript
// After GitHub OAuth, user can pick from their repos:
// GET https://api.github.com/user/repos?sort=updated&per_page=50
// Authorization: Bearer {githubToken}
// Show in a searchable dropdown on the landing page
```

### PR creation
```typescript
// 1. Get default branch: GET /repos/{owner}/{repo}
//    Use response.default_branch — NEVER hardcode 'main' or 'master'
// 2. Get latest commit SHA on default branch
// 3. Create new branch: lazarus-resurrection-{jobId.slice(0,8)}
// 4. Create tree with all generated files
// 5. Create commit pointing to that tree
// 6. Create PR: base=default_branch, head=new branch
```

---

## COST TRACKING

Track after every Bedrock call and update DynamoDB + UI counter.

```typescript
// Pricing constants
const PRICING = {
  sonnet: { input: 3.00, output: 15.00, cached: 0.30 },   // per M tokens
  haiku:  { input: 0.25, output: 1.25,  cached: 0.03 },
}

const cost = (
  (inputTokens * PRICING[model].input) +
  (outputTokens * PRICING[model].output) +
  (cachedTokens * PRICING[model].cached)
) / 1_000_000

// Update DynamoDB + emit cost_update SSE event → animated counter in TopBar
```
