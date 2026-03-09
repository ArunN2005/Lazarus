'use client'

import { useEffect, useCallback, useRef } from 'react'
import { WebContainer } from '@webcontainer/api'
import { useWorkspaceStore } from '@/stores/workspace-store'

const COMPATIBLE_DB_PACKAGES = new Set([
  'mongoose', 'mongodb',
  '@supabase/supabase-js',
  '@upstash/redis', '@upstash/ratelimit',
  'firebase', '@firebase/app', 'firebase-admin',
  '@libsql/client',
  'sql.js',  // SQLite compiled to WASM — works in WebContainers
])

const INCOMPATIBLE_DB_PACKAGES = new Set([
  'pg', 'pg-pool', 'pg-native',
  'mysql', 'mysql2',
  'sqlite3', 'better-sqlite3',
  'redis', 'ioredis',
])

const BACKEND_FRAMEWORKS = new Set([
  'express', 'fastify', 'koa', 'hapi', '@hapi/hapi', 'restify',
])

export interface BackendInfo {
  root: string
  framework: string
  dbPackages: string[]
  compatible: boolean
}

export function analyzeBackend(files: Map<string, string>): BackendInfo | null {
  const backendDirs = ['backend', 'server', 'api']

  for (const dir of backendDirs) {
    const content = files.get(`${dir}/package.json`)
    if (!content) continue

    let pkg: Record<string, unknown>
    try { pkg = JSON.parse(content) } catch { continue }

    const deps = {
      ...((pkg.dependencies ?? {}) as Record<string, string>),
      ...((pkg.devDependencies ?? {}) as Record<string, string>),
    }
    const depNames = Object.keys(deps)

    const framework = depNames.find((d) => BACKEND_FRAMEWORKS.has(d))
    if (!framework) continue

    const incompatible = depNames.filter((d) => INCOMPATIBLE_DB_PACKAGES.has(d))
    const compatible = depNames.filter((d) => COMPATIBLE_DB_PACKAGES.has(d))

    return {
      root: dir,
      framework,
      dbPackages: [...incompatible, ...compatible],
      compatible: incompatible.length === 0,
    }
  }

  return null
}

function findFrontendRoot(files: Map<string, string>): string {
  const FRONTEND_SIGNALS = [
    'vite', 'react-scripts', '@vitejs/plugin-react',
    'next', 'nuxt', 'svelte', '@sveltejs/kit',
  ]

  for (const [path, content] of Array.from(files.entries())) {
    if (!path.endsWith('package.json')) continue
    try {
      const pkg = JSON.parse(content)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasFrontend = FRONTEND_SIGNALS.some((s) => deps[s])
      if (hasFrontend) {
        return path === 'package.json' ? '.' : path.replace('/package.json', '')
      }
    } catch { /* skip */ }
  }

  return findAppRoot(files)
}

// ---------------------------------------------------------------------------
// Lazarus visual devtools — injected into the WebContainer after generation
// ---------------------------------------------------------------------------
const DEVTOOLS_SCRIPT = `(function(){
'use strict';
var editMode=false,dragEl=null,dragStartX=0,dragStartY=0,dragBaseX=0,dragBaseY=0;
var TEXT={P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,SPAN:1,BUTTON:1,A:1,LI:1,TD:1,TH:1,LABEL:1,STRONG:1,EM:1};
var BLOCK={DIV:1,SECTION:1,ARTICLE:1,HEADER:1,FOOTER:1,MAIN:1,NAV:1,ASIDE:1,FIGURE:1,FORM:1,UL:1,OL:1,BUTTON:1,A:1};
var hl=document.createElement('div');hl.id='__lz_hl';
hl.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #6366f1;border-radius:3px;opacity:0;transition:opacity .12s;box-shadow:0 0 0 3px rgba(99,102,241,.12)';
var tip=document.createElement('div');
tip.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:#4f46e5;color:#fff;font-size:10px;font-family:system-ui;padding:3px 8px;border-radius:4px;opacity:0;transition:opacity .12s;white-space:nowrap;box-shadow:0 2px 8px rgba(79,70,229,.4)';
var overSty=document.createElement('style');overSty.id='__lz_os';
var overrides={};
function getSel(el){var parts=[];var t=el;while(t&&t.tagName&&t!==document.body){if(t.id){parts.unshift('#'+t.id);break;}var s=t.tagName.toLowerCase();if(t.parentElement){var idx=Array.prototype.indexOf.call(t.parentElement.children,t);if(idx>0)s+=':nth-child('+(idx+1)+')';}parts.unshift(s);t=t.parentElement;}return parts.join(' > ');}
function applyOverrides(){var css='';for(var sel in overrides)css+=sel+'{transform:'+overrides[sel]+' !important;}\n';overSty.textContent=css;}
function posHl(el){var r=el.getBoundingClientRect();hl.style.top=r.top+'px';hl.style.left=r.left+'px';hl.style.width=r.width+'px';hl.style.height=r.height+'px';hl.style.opacity='1';}
function getTrans(el){var t=window.getComputedStyle(el).transform;if(!t||t==='none')return[0,0];var m=t.match(/matrix\\([\\d., -]+\\)/);if(m){var v=m[0].match(/[\\d.-]+/g);if(v&&v.length>=6)return[parseFloat(v[4]),parseFloat(v[5])];}return[0,0];}
function setEdit(on){editMode=on;if(!on){hl.style.opacity='0';tip.style.opacity='0';dragEl=null;}}
window.addEventListener('message',function(e){if(e.data&&e.data.type==='lazarus:set-edit')setEdit(!!e.data.enabled);});
document.addEventListener('mouseover',function(e){if(!editMode)return;var el=e.target;posHl(el);var isT=TEXT[el.tagName]&&el.childElementCount===0&&el.textContent.trim().length>0;tip.textContent=isT?'\\u270F  Click to edit text':'\\u283F  Drag to reposition';var r=el.getBoundingClientRect();tip.style.top=Math.max(0,r.top-24)+'px';tip.style.left=r.left+'px';tip.style.opacity='1';},true);
document.addEventListener('mouseout',function(e){if(!editMode)return;hl.style.opacity='0';tip.style.opacity='0';},true);
document.addEventListener('click',function(e){if(!editMode||dragEl)return;var el=e.target;if(!TEXT[el.tagName]||el.childElementCount>0)return;var orig=el.textContent;e.preventDefault();e.stopPropagation();el.contentEditable='true';el.style.outline='2px solid #6366f1';el.style.outlineOffset='2px';el.style.borderRadius='2px';el.focus();var done=function(){el.contentEditable='false';el.style.outline='';el.style.outlineOffset='';el.style.borderRadius='';var nw=el.textContent;if(nw!==orig)window.parent.postMessage({type:'lazarus:text-edit',oldText:orig,newText:nw,tagName:el.tagName},'*');el.removeEventListener('blur',done);el.removeEventListener('keydown',keys);};var keys=function(k){if(k.key==='Escape'){el.textContent=orig;done();}if(k.key==='Enter'&&el.tagName!=='DIV'&&el.tagName!=='P'){k.preventDefault();done();}};el.addEventListener('blur',done);el.addEventListener('keydown',keys);},true);
document.addEventListener('mousedown',function(e){if(!editMode||e.button!==0)return;if(document.activeElement&&document.activeElement.isContentEditable)return;var el=e.target;if(!el||el===document.body)return;var t=el;while(t&&t!==document.body){if(BLOCK[t.tagName])break;t=t.parentElement;}if(!t||t===document.body)return;var tr=getTrans(t);dragBaseX=tr[0];dragBaseY=tr[1];dragStartX=e.clientX;dragStartY=e.clientY;dragEl=t;e.preventDefault();},true);
document.addEventListener('mousemove',function(e){if(!editMode||!dragEl)return;var dx=e.clientX-dragStartX,dy=e.clientY-dragStartY;dragEl.style.transform='translate('+(dragBaseX+dx)+'px,'+(dragBaseY+dy)+'px)';posHl(dragEl);},true);
document.addEventListener('mouseup',function(){
  if(editMode&&dragEl){var tr=getTrans(dragEl);if(Math.abs(tr[0]-dragBaseX)>2||Math.abs(tr[1]-dragBaseY)>2){var sel=getSel(dragEl);var xform='translate('+tr[0]+'px,'+tr[1]+'px)';overrides[sel]=xform;applyOverrides();window.parent.postMessage({type:'lazarus:drag-end',selector:sel,transform:xform},'*');}}
  dragEl=null;
},true);
function mount(){if(document.getElementById('__lz_hl'))return;document.body.appendChild(hl);document.body.appendChild(tip);document.head.appendChild(overSty);}
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
})();`

let bootPromise: Promise<WebContainer> | null = null
let bootedInstance: WebContainer | null = null
let installRunning = false
let lastFrontendRoot = '.'

// Promise that resolves when boot is fully complete
let bootReadyResolve: () => void
const bootReady = new Promise<void>((resolve) => {
  bootReadyResolve = resolve
})

/** Strip ANSI escape codes and npm spinner noise so terminal output is readable */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '')
}

function isNoise(line: string): boolean {
  // npm progress spinner characters and empty lines
  return /^[\s/\-\\|]*$/.test(line)
}

function cleanChunk(chunk: string): string {
  return stripAnsi(chunk)
    .split('\n')
    .filter((l) => !isNoise(l))
    .join('\n')
    .trim()
}

/**
 * Find the best package.json to run (the one with a dev/start script).
 * For repos with frontend/ and backend/, picks the frontend.
 * Returns the directory relative to workdir (e.g. 'frontend' or '.').
 */
function findAppRoot(files: Map<string, string>): string {
  const packageJsonPaths: string[] = []

  for (const [path] of Array.from(files.entries())) {
    if (path.endsWith('package.json')) {
      packageJsonPaths.push(path)
    }
  }

  if (packageJsonPaths.length === 0) return '.'

  // If there's a root package.json, check it first
  if (packageJsonPaths.includes('package.json')) {
    const content = files.get('package.json') ?? ''
    try {
      const pkg = JSON.parse(content)
      if (pkg.scripts?.dev || pkg.scripts?.start) {
        return '.'
      }
    } catch { /* not valid JSON */ }
  }

  // Look for a package.json with a dev or start script
  for (const pkgPath of packageJsonPaths) {
    const content = files.get(pkgPath) ?? ''
    try {
      const pkg = JSON.parse(content)
      if (pkg.scripts?.dev || pkg.scripts?.start) {
        const dir = pkgPath.replace('/package.json', '')
        return dir || '.'
      }
    } catch { /* not valid JSON */ }
  }

  // Fallback: use the first package.json's directory
  const dir = packageJsonPaths[0].replace('/package.json', '')
  return dir || '.'
}

export function useWebContainer() {
  const store = useWorkspaceStore()
  const wcRef = useRef<WebContainer | null>(store.webcontainerInstance)

  // Keep ref in sync with store
  useEffect(() => {
    wcRef.current = store.webcontainerInstance
  }, [store.webcontainerInstance])

  useEffect(() => {
    if (store.webcontainerInstance) return

    if (bootedInstance) {
      wcRef.current = bootedInstance
      store.setWebcontainerInstance(bootedInstance)
      return
    }

    if (!bootPromise) {
      store.addTerminalLog('Booting cloud instance...')
      bootPromise = WebContainer.boot()
    }

    bootPromise
      .then((wc) => {
        if (bootedInstance) return
        bootedInstance = wc

        wcRef.current = wc
        store.setWebcontainerInstance(wc)
        store.addTerminalLog('Instance ready.')

        bootReadyResolve()

        wc.on('server-ready', (_port, url) => {
          store.setPreviewUrl(url)
          store.addTerminalLog(`Preview ready at ${url}`)
        })
      })
      .catch((err) => {
        store.addTerminalLog(`WebContainer boot failed: ${err.message}`)
        bootReadyResolve()
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const writeFile = useCallback(
    async (filePath: string, content: string | Uint8Array) => {
      await bootReady

      const wc = wcRef.current
      if (!wc) return

      // Use relative paths — WebContainer resolves them to the workdir
      const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath

      const parts = relativePath.split('/')
      if (parts.length > 1) {
        const dir = parts.slice(0, -1).join('/')
        await wc.fs.mkdir(dir, { recursive: true })
      }

      await wc.fs.writeFile(relativePath, content)
    },
    []
  )

  const runInstall = useCallback(async (files: Map<string, string>) => {
    if (installRunning) {
      store.addTerminalLog('npm install already running — skipping')
      return
    }

    await bootReady

    const wc = wcRef.current
    if (!wc) {
      store.addTerminalLog('WebContainer not ready — cannot run install')
      return
    }

    installRunning = true

    try {
      // Find the directory containing the runnable package.json
      const appRoot = findAppRoot(files)
      store.addTerminalLog(`> App root: ${appRoot}`)

      store.addTerminalLog('> npm install')

      const install = await wc.spawn('npm', ['install'], {
        cwd: appRoot,
      })
      install.output.pipeTo(
        new WritableStream({
          write(chunk) {
            const clean = cleanChunk(chunk)
            if (clean) {
              store.addTerminalLog(clean)
            }
          },
        })
      )
      const exitCode = await install.exit

      if (exitCode !== 0) {
        store.addTerminalLog(`npm install failed with exit code ${exitCode}`)
        return
      }

      // Override tsconfig.json with a clean minimal config —
      // legacy repos often have references/paths that Vite can't resolve in WebContainers
      const cleanTsconfig = JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
        },
        include: ["src"],
      }, null, 2)
      await wc.fs.writeFile(`${appRoot}/tsconfig.json`, cleanTsconfig)

      store.addTerminalLog('> npm run dev')

      const dev = await wc.spawn('npm', ['run', 'dev'], {
        cwd: appRoot,
      })
      dev.output.pipeTo(
        new WritableStream({
          write(chunk) {
            const clean = cleanChunk(chunk)
            if (clean) {
              store.addTerminalLog(clean)
            }
          },
        })
      )
    } finally {
      installRunning = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runBackendThenFrontend = useCallback(
    async (files: Map<string, string>, backendRoot: string) => {
      if (installRunning) return

      await bootReady

      const wc = wcRef.current
      if (!wc) return

      installRunning = true

      try {
        // 1. Install backend deps
        store.addTerminalLog(`> Installing backend (${backendRoot})...`)
        const backendInstall = await wc.spawn('npm', ['install'], { cwd: backendRoot })
        backendInstall.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const clean = stripAnsi(chunk)
              if (clean.trim()) store.addTerminalLog(clean)
            },
          })
        )
        const backendInstallCode = await backendInstall.exit
        if (backendInstallCode !== 0) {
          store.addTerminalLog(`Backend npm install failed (exit ${backendInstallCode})`)
          return
        }

        // 2. Start backend (non-blocking)
        const backendPkgContent = files.get(`${backendRoot}/package.json`) ?? '{}'
        let backendScript = 'start'
        try {
          const backendPkg = JSON.parse(backendPkgContent)
          if (backendPkg.scripts?.dev) backendScript = 'dev'
          else if (backendPkg.scripts?.start) backendScript = 'start'
        } catch { /* use default */ }

        store.addTerminalLog(`> Starting backend (npm run ${backendScript})...`)
        const backendDev = await wc.spawn('npm', ['run', backendScript], { cwd: backendRoot })
        backendDev.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const clean = stripAnsi(chunk)
              if (clean.trim()) store.addTerminalLog(clean)
            },
          })
        )

        // Give backend a moment to start before launching frontend
        await new Promise<void>((resolve) => setTimeout(resolve, 2500))

        // 3. Install + start frontend
        const frontendRoot = findFrontendRoot(files)
        store.addTerminalLog(`> Installing frontend (${frontendRoot})...`)

        const frontendInstall = await wc.spawn('npm', ['install'], { cwd: frontendRoot })
        frontendInstall.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const clean = stripAnsi(chunk)
              if (clean.trim()) store.addTerminalLog(clean)
            },
          })
        )
        const frontendInstallCode = await frontendInstall.exit
        if (frontendInstallCode !== 0) {
          store.addTerminalLog(`Frontend npm install failed (exit ${frontendInstallCode})`)
          return
        }

        // Write clean tsconfig for frontend
        const cleanTsconfig = JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
          },
          include: ['src'],
        }, null, 2)
        await wc.fs.writeFile(`${frontendRoot}/tsconfig.json`, cleanTsconfig)

        store.addTerminalLog('> Starting frontend...')
        const frontendDev = await wc.spawn('npm', ['run', 'dev'], { cwd: frontendRoot })
        frontendDev.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const clean = stripAnsi(chunk)
              if (clean.trim()) store.addTerminalLog(clean)
            },
          })
        )
      } finally {
        installRunning = false
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const injectDevtools = useCallback(async (completedFiles: Map<string, string>) => {
    await bootReady
    const wc = wcRef.current
    if (!wc) return

    try {
      const frontendRoot = findFrontendRoot(completedFiles)
      lastFrontendRoot = frontendRoot
      const publicDir = frontendRoot === '.' ? 'public' : `${frontendRoot}/public`
      const indexCandidates = frontendRoot === '.'
        ? ['index.html']
        : [`${frontendRoot}/index.html`, 'index.html']

      await wc.fs.mkdir(publicDir, { recursive: true })
      await wc.fs.writeFile(`${publicDir}/__lazarus_devtools.js`, DEVTOOLS_SCRIPT)
      // Empty overrides file — filled by drag events
      await wc.fs.writeFile(`${publicDir}/__lazarus_overrides.css`, '')

      for (const indexPath of indexCandidates) {
        let html: string | null = null
        try {
          html = await wc.fs.readFile(indexPath, 'utf-8') as string
        } catch {
          html = completedFiles.get(indexPath) ?? null
        }
        if (!html) continue
        if (html.includes('__lazarus_devtools.js')) break

        const patched = html.replace(
          '</body>',
          '  <link rel="stylesheet" href="/__lazarus_overrides.css">\n  <script src="/__lazarus_devtools.js"></script>\n</body>'
        )
        await wc.fs.writeFile(indexPath, patched)
        break
      }
    } catch {
      // Non-fatal — visual editing just won't be available
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const writeOverrideCSS = useCallback(async (css: string) => {
    const wc = wcRef.current
    if (!wc) return
    const publicDir = lastFrontendRoot === '.' ? 'public' : `${lastFrontendRoot}/public`
    try {
      await wc.fs.writeFile(`${publicDir}/__lazarus_overrides.css`, css)
    } catch { /* non-fatal */ }
  }, [])

  return {
    writeFile,
    runInstall,
    runBackendThenFrontend,
    injectDevtools,
    writeOverrideCSS,
  }
}
