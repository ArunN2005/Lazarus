# LAZARUS — Design Specifications

---

## AESTHETIC DIRECTION

Lazarus should feel like the love child of **Bolt.new** and **Lovable.dev**:
- Dark-first, near-black backgrounds
- One strong accent color (violet/purple — the "resurrection" color)
- Clean, confident typography — not playful, not corporate — *powerful*
- Micro-animations that feel purposeful, not decorative
- Dense information without feeling cluttered
- Premium feel: gradients, glows, subtle noise textures

**The one thing someone will remember:** Watching dead code come alive —
code streaming into the editor while the preview boots up in real time.
Every design decision should serve that moment.

---

## DESIGN TOKENS

### Colors
```css
:root {
  /* Backgrounds */
  --bg-base:        #080808;   /* page background */
  --bg-panel:       #0f0f0f;   /* panel backgrounds */
  --bg-elevated:    #161616;   /* cards, inputs */
  --bg-hover:       #1c1c1c;   /* hover states */

  /* Borders */
  --border-subtle:  #1f1f1f;
  --border-default: #2a2a2a;
  --border-strong:  #333333;

  /* Text */
  --text-primary:   #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-muted:     #606060;
  --text-disabled:  #404040;

  /* Accent (violet) */
  --accent:         #7c3aed;
  --accent-hover:   #6d28d9;
  --accent-light:   #8b5cf6;
  --accent-dim:     rgba(124, 58, 237, 0.15);
  --accent-glow:    rgba(124, 58, 237, 0.4);

  /* Status */
  --success:        #10b981;
  --success-dim:    rgba(16, 185, 129, 0.15);
  --warning:        #f59e0b;
  --warning-dim:    rgba(245, 158, 11, 0.15);
  --error:          #ef4444;
  --error-dim:      rgba(239, 68, 68, 0.15);
  --info:           #3b82f6;

  /* Terminal */
  --terminal-bg:    #0a0a0a;
  --terminal-text:  #d4d4d4;
  --terminal-green: #4ec9b0;
  --terminal-yellow:#d7ba7d;
  --terminal-red:   #f44747;
  --terminal-blue:  #569cd6;
}
```

### Typography
```css
/* Use Geist font from next/font — same as Vercel, Bolt.new, Lovable */
/* Pair with Geist Mono for code */

font-family: 'Geist', system-ui, sans-serif;          /* UI */
font-family: 'Geist Mono', 'Fira Code', monospace;    /* Code, terminal */

/* Scale */
--text-xs:   0.75rem;   /* 12px — file tree labels, badges */
--text-sm:   0.875rem;  /* 14px — body, chat messages */
--text-base: 1rem;      /* 16px — default */
--text-lg:   1.125rem;  /* 18px — panel headers */
--text-xl:   1.25rem;   /* 20px — section titles */
--text-2xl:  1.5rem;    /* 24px — hero subtitle */
--text-4xl:  2.25rem;   /* 36px — hero title */
--text-6xl:  3.75rem;   /* 60px — LAZARUS wordmark */
```

### Animations
```css
/* All durations */
--duration-instant: 80ms;
--duration-fast:    150ms;
--duration-normal:  250ms;
--duration-slow:    400ms;
--duration-slower:  600ms;

/* Easings */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);      /* snappy settle */
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);    /* smooth */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* slight bounce */

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0   0 var(--accent-glow); }
  50%       { box-shadow: 0 0 20px 4px var(--accent-glow); }
}

@keyframes typingCursor {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

@keyframes countUp {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

@keyframes scanLine {
  from { top: 0%; }
  to   { top: 100%; }
}
```

---

## SCROLLBAR STYLING
```css
::-webkit-scrollbar       { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
```

---

## LANDING PAGE

### Layout
Full viewport, centered, dark background with subtle radial gradient emanating
from center-top. Add a very subtle noise texture overlay (opacity 0.03).

```
Background: var(--bg-base)
Noise: url("data:image/svg+xml,...") repeat, opacity 0.03
Radial gradient: from #150a2e at 50% -20% to transparent at 70%
```

### Hero Section
```
[centered, max-width 680px, padding-top 15vh]

LAZARUS                               ← var(--text-6xl), font-bold, 
                                         letter-spacing -0.04em
                                         gradient: #c4b5fd → #7c3aed → #4c1d95
                                         background-clip: text

LEGACY CODE RESURRECTION ENGINE       ← text-xs, tracking-[0.25em], uppercase
                                         color: var(--text-muted), margin-top 8px

Bring any GitHub repository back      ← text-xl, var(--text-secondary)
to life. Instantly.                      margin-top 20px

[Animated underline beneath "Instantly" — violet, 2px, slides in from left]
```

### Repo Input (main CTA)
```
[margin-top: 48px]
[Full width input + button in a single rounded container]

┌─────────────────────────────────────────────────────┐
│ ⚡ https://github.com/owner/legacy-repo          [→] │
└─────────────────────────────────────────────────────┘

Container:
  background: var(--bg-elevated)
  border: 1px solid var(--border-default)
  border-radius: 12px
  padding: 4px 4px 4px 16px
  transition: border-color 200ms
  focus-within: border-color var(--accent), box-shadow 0 0 0 3px var(--accent-dim)

Input:
  flex: 1, background: transparent
  font-family: Geist Mono, font-size: 14px
  color: var(--text-primary)
  placeholder: "https://github.com/username/repo" color var(--text-muted)

Button "Resurrect →":
  background: var(--accent)
  border-radius: 8px, padding: 10px 20px
  font-weight: 600
  hover: background var(--accent-hover), transform translateY(-1px)
  active: transform translateY(0)
  Loading state: show <Spinner /> + "Analyzing..."

OR divider + "Browse your repos" button (if GitHub OAuth connected):
  Shows GithubRepoPicker dropdown
```

### GitHub Repo Picker (after OAuth)
```
[Dropdown below input, max-height 320px, scrollable]

Search box at top: "Search your repositories..."

Each repo item:
  [repo icon] owner/repo-name    [language badge] [last updated]
  Private repos show 🔒 badge

Groups: "Recent" (last 10 updated) then "All repos"

Click → fills URL input, triggers scan automatically
```

### Example Repos
```
[margin-top: 32px]
[Row of clickable chips]

Try these:  [⚡ angular/angular-phonecat]  [⚡ todomvc/react-backbone]  [⚡ expressjs/examples]

Chip style:
  border: 1px solid var(--border-default)
  background: var(--bg-elevated)
  border-radius: 20px, padding: 6px 12px
  text-sm, color var(--text-secondary)
  hover: border-color var(--accent), color var(--text-primary)
  transition: all 150ms
```

### Feature Grid (below hero)
```
[margin-top: 80px, 3-column grid on desktop, 1-column mobile]

Each card:
  background: var(--bg-elevated)
  border: 1px solid var(--border-subtle)
  border-radius: 12px, padding: 24px
  hover: border-color var(--border-strong), transform translateY(-2px)
  transition: all 250ms var(--ease-out)

Feature icons: lucide-react, color var(--accent-light), 24px

Features to show:
  ⚡ Single AI Call — "All files generated in one context for perfect coherence"
  🔄 Live Preview — "WebContainers runs your app instantly in the browser"  
  💬 Chat to Edit — "Describe changes in plain English, see them instantly"
  🔀 GitHub PR — "One click to create a PR back to your repository"
  🛡️ Zero Data Loss — "All original logic preserved. Only modernized."
  ⚡ Sub-minute — "From legacy to live in under 60 seconds"
```

### Page Animations (Framer Motion)
```typescript
// Hero title: fade in + slide up, delay 0ms
// Subtitle: fade in + slide up, delay 100ms
// Input: fade in + slide up, delay 200ms
// Examples: fade in, delay 350ms
// Feature grid: stagger children with 50ms delay each

// On input focus: container border glows (CSS transition, no JS needed)
// On submit: button transforms to loading state with scale(0.98)
```

---

## SCAN RESULTS PAGE

Shows after scan completes, before resurrection starts.

### Layout
```
[2-column layout: left = file tree, right = legacy preview]

Left (400px):
  Header: "📦 {repoName}" + tech stack badges
  File tree (scrollable, 500px max-height)
  ENV vars section (if any required)
  "Start Resurrection" CTA at bottom

Right (flex):
  "Legacy Preview" label + "Running original code" badge
  WebContainer iframe showing original app
  (If Python/non-Node: show "Preview not available — Python repos run after resurrection")
```

### Tech Stack Badges
```
[Horizontal row of badges]

Each badge:
  background: var(--bg-elevated)
  border: 1px solid var(--border-default)
  border-radius: 6px, padding: 3px 8px, text-xs
  icon + label (e.g. "⚛️ React 16", "📦 npm", "🗄️ MongoDB")
```

### File Tree
```
Each file:
  [indent based on depth] [icon] filename    [batch badge]

Status icons (after resurrection starts):
  queued:     ○ var(--text-muted)
  streaming:  animated violet spinner
  complete:   ✓ var(--success)
  error:      ✗ var(--error)

Active file row:
  background: var(--accent-dim)
  border-left: 2px solid var(--accent)

Directory rows:
  chevron ▶/▼ + folder icon + name
  Click to expand/collapse

Batch section headers (during resurrection):
  "FOUNDATION" | "SERVICES" | "COMPONENTS" | "ASSETS"
  text-xs, uppercase, tracking-wide, var(--text-muted)
```

### ENV Vars Section
```
[Only shown if ENV vars required]

Title: "🔑 Environment Variables Required"
Subtitle: "These will be securely stored in AWS Secrets Manager"

Each var:
  Label: VAR_NAME  [required badge]
  Input: type="password", show/hide toggle
  Helper text if available

Info box:
  "📍 If your database blocks external connections, allow this IP:
   {NAT_GATEWAY_IP or 'See Amplify settings'}"
  [Copy button]
```

---

## CLARIFICATION MODAL

### Design
```
[Full-screen overlay, backdrop-blur-md, backdrop: rgba(0,0,0,0.7)]
[Center card: max-width 520px]

Card:
  background: var(--bg-elevated)
  border: 1px solid var(--border-strong)
  border-radius: 16px, padding: 32px
  box-shadow: 0 25px 60px rgba(0,0,0,0.5)
  animation: slideUp 300ms var(--ease-out)

Header:
  "🤔 A few quick questions" — text-xl font-semibold
  "Lazarus wants to understand your codebase better before modernizing" 
    — text-sm var(--text-secondary), margin-top 8px

Questions: (2-4 items)
  Each question as a label + radio group or select
  Question text: font-medium, var(--text-primary)
  
  Example question types:
    "Modernize the UI or preserve the original look?"
    → Radio: [Modernize fully] [Preserve original style] [Minimal changes only]
    
    "Output in TypeScript or JavaScript?"
    → Radio: [TypeScript] [JavaScript] [Keep original]

Footer:
  "Continue Resurrection →" button (full width, violet)
  Disabled until all questions answered
```

---

## WORKSPACE LAYOUT

### Overall Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ TopBar                                               48px fixed  │
├──────────────┬─────────────────────────┬───────────────────────┤
│              │                         │                        │
│  FILE TREE   │   MONACO EDITOR         │   PREVIEW PANEL       │
│  260px       │   (flex)                │   380px               │
│              │                         │                        │
├──────────────┤                         │                        │
│              │─────────────────────────│                        │
│  CHAT PANEL  │   TERMINAL              │                        │
│  (flex)      │   200px                 │                        │
│              │                         │                        │
└──────────────┴─────────────────────────┴───────────────────────┘
│ StatusBar                                            24px fixed  │
└─────────────────────────────────────────────────────────────────┘

All borders: 1px solid var(--border-subtle)
All panels independently scrollable
Panels are resizable (use react-resizable-panels library)
```

### TopBar (48px)
```
[bg: var(--bg-panel), border-bottom: 1px solid var(--border-subtle)]

Left:
  ⚡ LAZARUS  (violet glyph + white wordmark, font-semibold)
  → separator
  {owner}/{repo}  (link to GitHub, var(--text-secondary))
  → [{tech} badge]

Center:
  Phase indicator (7 dots):
  scan • clarify • resurrect • install • preview • iterate • ship
  
  Completed: ● var(--accent) w-2 h-2
  Active: ● var(--accent-light) w-2.5 h-2.5, animate-pulse + glow
  Pending: ○ var(--text-muted) w-2 h-2

Right:
  $0.43 ← animated cost counter (Geist Mono, countUp animation on update)
  → separator
  00:43 ← elapsed time
  → [Create PR] button (only when status=complete, violet outline)
  → [User avatar] (Clerk)
```

### File Tree Panel (260px, left)
```
[bg: var(--bg-panel), border-right: 1px solid var(--border-subtle)]

Header: "FILES" (text-xs, uppercase, tracking-wide, var(--text-muted))
        file count badge on right

File tree (scrollable):
  Each file row: 28px height
  Hover: bg var(--bg-hover)
  Active: bg var(--accent-dim), border-left 2px var(--accent)
  
  File icon by extension (lucide or devicons)
  Filename: text-sm, var(--text-primary)
  Status icon: far right
    streaming → <Spinner size=10 color=var(--accent-light) />
    complete  → ✓ var(--success) text-xs
    error     → ✗ var(--error) text-xs

Stats footer (bottom of tree, always visible):
  "47 files  ✓ 23  ⟳ 3  ○ 21"
  text-xs, var(--text-muted), padding 8px 12px
  border-top: 1px solid var(--border-subtle)

BELOW FILE TREE (same left panel, flex):

Chat Panel:
  Header: "CHAT" (same style as FILES header)
  Messages list (scrollable):
    User messages: right-aligned, bg var(--accent-dim), border-radius 12px 12px 2px 12px
    AI messages: left-aligned, bg var(--bg-elevated), border-radius 12px 12px 12px 2px
    Timestamps: text-xs, var(--text-muted)
    
  Status messages (system):
    Small text with icon:
    "🔍 Analyzing repo..." | "⚡ Generating 47 files..." | "✓ Preview ready"
    color: var(--text-muted), italic
    
  Input area (bottom, fixed):
    Textarea: 1 row default, expands to 4
    bg: var(--bg-elevated), border: 1px solid var(--border-default)
    placeholder: "Describe a change..."
    Send button: violet, right side
    Disabled with tooltip during resurrection ("Wait for completion first")
    [Suggestion chips above when empty and focused]:
      "Add dark mode" | "Fix the layout" | "Add loading states"
```

### Monaco Editor Panel (center, flex)
```
[bg: #1e1e1e (Monaco's own dark theme)]

Header bar (32px):
  Left: breadcrumb path  src / components / App.tsx
  Right: [Original] [Generated] tabs (only after file_complete)
         [Diff] toggle
         Language badge

Monaco config:
  theme: 'vs-dark'
  fontSize: 13
  fontFamily: 'Geist Mono'
  lineHeight: 1.6
  minimap: { enabled: false }  ← disable to save space
  scrollBeyondLastLine: false
  padding: { top: 16 }

During streaming:
  readOnly: true
  Show blinking cursor decoration at end of content
  Auto-scroll to follow generation (executeEdits + revealLine)
  
After file_complete:
  Switch to DiffEditor (original left, generated right)
  Green decorations on changed lines in generated pane
  readOnly: false on generated pane (allow manual edits)
  
During architect phase (plan text):
  language: 'markdown'
  Show plan text streaming in as prose

Empty state (no file selected):
  Centered: "⚡ Select a file to view" var(--text-muted)
  + keyboard shortcut hints
```

### Preview Panel (380px, right)
```
[bg: var(--bg-panel), border-left: 1px solid var(--border-subtle)]

Header bar (32px):
  "PREVIEW" label
  [Desktop | Tablet | Mobile] viewport toggle buttons
  [↗ Open in tab] [↺ Refresh] buttons
  "LIVE" badge: ● green animate-pulse (only when preview URL active)

State 1 — Scanning/No preview yet:
  Animated skeleton: gray shimmer blocks representing a generic app layout
  Center text: status message ("Analyzing...", "Generating...", etc.)
  NEVER blank white

State 2 — Legacy preview (before resurrection):
  iframe showing original app
  Banner: "Legacy version — running original code"
  Subtle sepia/grayscale filter on iframe (20% desaturated)
  
State 3 — Resurrection in progress:
  Skeleton morphs to "npm install" progress animation
  Terminal-style log lines appearing
  
State 4 — Live preview (after WebContainer ready):
  Full iframe, no filter
  "LIVE" badge pulses green
  Viewport switcher works (changes iframe container width)
  On chat edit: badge briefly pulses violet ("Updating...")

Viewport modes:
  Desktop: 100% width
  Tablet: 768px centered, subtle drop shadow
  Mobile: 375px centered, rounded corners (like phone frame)
```

### Terminal Panel (200px, bottom center)
```
[bg: var(--terminal-bg), border-top: 1px solid var(--border-subtle)]

Header: "TERMINAL" label + [Clear] button
Font: Geist Mono, 12px

Auto-scroll to bottom (pause if user scrolls up)
"↓ New output" pill when paused + new logs arriving

Line colors:
  default:            var(--terminal-text)
  contains 'warn':    var(--terminal-yellow)
  contains 'error':   var(--terminal-red)
  contains '✓' or 'success': var(--terminal-green)
  contains 'http://' or 'https://': var(--terminal-blue) + underline + clickable

Timestamp prefix: dim gray, text-xs
Max lines rendered: 500 (performance)
```

### Status Bar (24px, bottom fixed)
```
[bg: var(--accent) when active, var(--bg-panel) when idle]
[border-top: 1px solid var(--border-subtle)]
[font: Geist Mono, text-xs]

Contents (left to right):
  [phase icon] Detailed status message
  → separator
  Files: 23/47 complete
  → separator  
  Bedrock: streaming 847 tok/s  (during generation)
  → separator
  $0.43 total cost
  → separator (right-aligned)
  Claude Sonnet 4.6

Status bar background colors:
  idle:         var(--bg-panel)
  scanning:     var(--info) at 10% opacity
  resurrecting: var(--accent) at 10% opacity — slight pulse animation
  complete:     var(--success) at 10% opacity
  error:        var(--error) at 10% opacity
```

---

## COMPONENT SPECS

### Spinner
```typescript
// Small animated spinner used throughout
// Size variants: sm (12px), md (16px), lg (24px)
// Color: currentColor (inherits from parent)
// CSS animation, not SVG (lighter)
```

### Badge
```typescript
// Variants: default, success, warning, error, accent
// Size: sm (text-xs, px-1.5 py-0.5) | md (text-sm, px-2 py-1)
// border-radius: 4px
// font-weight: 500
```

### Skeleton
```typescript
// For loading states
// Background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)
// background-size: 200% 100%
// animation: shimmer 1.5s ease-in-out infinite
// border-radius: matches the element it's replacing
```

### Button
```typescript
// Variants:
//   primary:  bg-accent, text-white
//   outline:  border-accent, text-accent, bg-transparent  
//   ghost:    bg-transparent, text-secondary, hover:bg-elevated
//   danger:   bg-error
//
// Sizes: sm (h-8 px-3 text-sm) | md (h-10 px-4) | lg (h-12 px-6 text-base)
// Always: transition-all duration-150, focus:ring-2 ring-accent ring-offset-1
// Loading: show Spinner, disable, prevent double-submit
```

---

## PAGE TRANSITIONS

```typescript
// Between landing → scan results → workspace:
// Use Framer Motion AnimatePresence with layout animations
//
// Landing → Scan Results:
//   Landing fades out (opacity 0, scale 0.98, 200ms)
//   Scan results slides up (translateY 20px → 0, opacity 0 → 1, 300ms)
//
// Scan Results → Workspace:
//   Full page cross-fade (300ms)
//   File tree animates in from left (-20px → 0)
//   Preview panel animates in from right (+20px → 0)
//   Editor fades in last (delay 150ms)
```

---

## RESPONSIVE BEHAVIOR

### Desktop (> 1280px): Full 3-panel layout as described
### Tablet (768-1280px):
  - Hide file tree by default, show as slide-over
  - Preview panel collapses to toggle-able bottom sheet
  - Chat moves to a floating button → bottom sheet

### Mobile (< 768px):
  - Single column, tab-based navigation
  - Tabs: Files | Editor | Preview | Chat
  - Terminal hidden by default, accessible via tab

---

## MICRO-INTERACTIONS

- **File streaming starts**: File row in tree gets violet border glow, slides into view
- **File complete**: Green checkmark pops in with scale(1.3) → scale(1), 200ms
- **Cost counter update**: Number counts up with countUp animation, briefly flashes green
- **Phase dot activation**: Dot scales up + starts pulsing, previous dot fades to static
- **Chat send**: Message slides in from right, send button briefly scales down
- **Preview ready**: LIVE badge fades in, preview iframe fades in over skeleton
- **Error**: Red shake animation on affected element (3 quick horizontal shakes)
- **PR created**: Confetti burst (canvas-confetti, 1 second, then done)

---

## SHADCN/UI COMPONENTS TO INSTALL

Run these after project setup:
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add badge
npx shadcn@latest add dialog
npx shadcn@latest add tooltip
npx shadcn@latest add dropdown-menu
npx shadcn@latest add scroll-area
npx shadcn@latest add separator
npx shadcn@latest add skeleton
npx shadcn@latest add tabs
npx shadcn@latest add sheet
npx shadcn@latest add radio-group
npx shadcn@latest add label
```

Configure `components.json` to use dark theme, CSS variables ON.
