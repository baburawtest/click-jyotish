export const site = {
  name: 'Antigravity AI',
  tagline: 'Autonomous AI Development Platform',
  version: '2.0',
  docsUrl: 'https://antigravity.google/docs',
  githubUrl: 'https://github.com/baburawtest/click-jyotish',
};

export const workflowStages = [
  {
    id: 'plan',
    step: '01',
    title: 'PLAN',
    subtitle: 'Deep Research & Architecture Blueprint',
    description: 'Antigravity analyzes complex codebases, maps dependencies, identifies risks, and drafts detailed implementation plans before touching a single line of code.',
    badge: 'Research & Alignment',
    metrics: ['Zero-Guessing Contracts', 'Implementation Plans', 'Subagent Delegation'],
    codeSnippet: `// implementation_plan.md
# Feature: Multi-Agent Video Renderer
## User Review Required
> [!IMPORTANT]
> Non-destructive schema migration required.
## Open Questions
- Target frame rate: 60 FPS (Default)
## Proposed Changes
- [NEW] src/components/AntigravityRender.tsx
- [MODIFY] src/utils/orchestrator.ts`
  },
  {
    id: 'execute',
    step: '02',
    title: 'EXECUTE',
    subtitle: 'Parallel Multi-File Code Synthesis',
    description: 'Deploys concurrent subagents to write clean, type-safe code across multiple files with exact string replacements and strict control flow scoping.',
    badge: 'Parallel Synthesis',
    metrics: ['Multi-Agent Concurrency', 'Atomic Code Edits', 'Strict Scoping'],
    codeSnippet: `// Invoking parallel worker subagents...
invoke_subagent({
  Subagents: [
    { Role: 'CSS Visual Engineer', Prompt: 'Build mesh gradient blobs' },
    { Role: 'TypeScript Architect', Prompt: 'Implement Remotion composition' }
  ]
});`
  },
  {
    id: 'build',
    step: '03',
    title: 'BUILD',
    subtitle: 'Zero-Latency Compilation & Dev Server',
    description: 'Spawns dev servers in non-blocking background tasks, compiles Astro/Vite production bundles, and hot-reloads changes with instant feedback.',
    badge: 'Instant Bundling',
    metrics: ['Astro & Vite Support', 'Background Daemons', 'Hot Module Reload'],
    codeSnippet: `$ cmd /c npm run dev
> astro dev --host
▶ Astro v5.18 ready in 372 ms
┃ Local    http://localhost:4321/
┃ Network  http://192.168.1.10:4321/
✔ watching for file changes...`
  },
  {
    id: 'debug',
    step: '04',
    title: 'DEBUG',
    subtitle: 'Log Inspection & Root-Cause Isolation',
    description: 'Reads full un-truncated diagnostic tracebacks before forming hypotheses. Fixes root causes upstream instead of applying superficial symptom patches.',
    badge: 'Empirical Diagnosis',
    metrics: ['Traceback Analysis', 'Upstream Data Fixes', 'Zero Masking'],
    codeSnippet: `// Diagnostic Investigation
[ERROR] Unhandled Exception: ModuleNotFound 'remotion'
[DIAGNOSIS] Missing peer dependency in package.json
[FIX] Resolved upstream dependency in package.json
✔ Hot reload verified zero errors`
  },
  {
    id: 'test',
    step: '05',
    title: 'TEST',
    subtitle: 'Automated Suite & Visual Walkthroughs',
    description: 'Executes unit tests, validates build outputs, captures browser UI screenshots, and generates interactive walkthrough markdown artifacts.',
    badge: 'Continuous Safety',
    metrics: ['Automated Unit Tests', 'Browser Verification', 'Visual Walkthroughs'],
    codeSnippet: `$ npm run test
✓ src/components/Workflow.test.ts (14 tests passed)
✓ src/layouts/BaseLayout.test.ts (6 tests passed)
Test Suites: 2 passed, 2 total
Snapshots:   8 passed, 8 total
Time:        1.24s`
  }
];

export const features = [
  {
    title: 'Multi-Agent Subagent Grid',
    desc: 'Spawn specialized subagents (research, code generation, refactoring) that work in background conversations concurrently.',
    icon: 'grid'
  },
  {
    title: 'Living Artifact Engine',
    desc: 'Generates structured implementation plans, walkthroughs with embedded media, and interactive documentation artifacts.',
    icon: 'artifact'
  },
  {
    title: 'Self-Healing Log Debugger',
    desc: 'Inspects raw stdout/stderr logs silently and isolates root causes before making surgical code changes.',
    icon: 'debug'
  },
  {
    title: 'Browser Automation & Testing',
    desc: 'Runs headless browser sessions to interact with UI components, capture screenshots, and verify visual flows.',
    icon: 'browser'
  },
  {
    title: 'Model Context Protocol (MCP)',
    desc: 'Seamlessly extends capabilities via custom MCP server integrations, sidecars, and domain tools.',
    icon: 'mcp'
  },
  {
    title: 'Strict Control Flow Guardrails',
    desc: 'Enforces type signatures, preserves existing API contracts, and prevents silent exception swallowing.',
    icon: 'guard'
  }
];
