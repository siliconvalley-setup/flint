// token-budget mod: keeps large tool results and fat contexts out of the
// model's input, in the main conversation and every subagent (issue #46,
// docs/adr/0003-token-budget.md).
// - Placeholders: a large text Read, or a Bash output core saved to a file past
//   its window, goes to tb (tools/tb.mjs), and the model gets tb's placeholder:
//   an outline, or head, tail and intent hits, with the exact command that
//   fetches any part. For Bash it takes the place of core's 2 KB preview.
//   Rewritten once, before core stores it; the original stays on disk.
// - Fork guard: refuses a fork from the main thread while its context is over
//   100k tokens (the session.measure figure): the fork would inherit it all.
//   Defense in depth: flint's env turns fork mode off (#47).
// - Loud failure: session.start runs `tb doctor` in the background. On a
//   failure the first main-thread tool result carries one TOKEN-BUDGET ERROR
//   line, and placeholders stay off for the session; the tools keep working.
// - Fail-open: a tb timeout, a non-zero exit or empty stdout passes the
//   original; a hook that throws is skipped by the mods runtime (no .catch).
import type { EngineInterface, On, ToolCallInput } from 'claude-code'

// Below this agents fetched the rest again: a placeholder cost a call and saved nothing (#57).
export const TRIGGER_B = 16384
// Claude Code's Bash window (env.sh BASH_MAX_OUTPUT_LENGTH): past it core saves the output to a file.
const BASH_WINDOW = 10000
// Past this the original passes: a slow tb never holds a result for long.
const TB_TIMEOUT_MS = 5000

const k = (tokens: number) => `${tokens / 1000}k`
// A main-thread fork past this copies too much context into every one of its requests.
const FORK_MAX_TOKENS = 100_000
const FORK_DENY = `Not spawned: a fork copies this conversation, over ${k(FORK_MAX_TOKENS)} tokens, into the subagent and pays for it on every request. `
  + 'Spawn a fresh agent (not fork) with a self-contained brief: the goal, the files to read, what you ruled out, and when it is done.'
// Read of these stays whole: the Read → Edit workflow on code keeps its shape.
const CODE_EXTENSIONS: ReadonlySet<string> = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'sh', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'css', 'scss', 'html', 'vue', 'svelte', 'sql',
  'json', 'yaml', 'yml', 'toml'])
// Output Claude Code saved past the Bash window: the agent reads it to see the output (#62).
const TOOL_RESULTS = /[\\/]tool-results[\\/][^\\/]+$/
// A tb call is the way back from a placeholder: its output never gets one (#74).
const TB_CALL = /\btb\.mjs\b/

type ReadText = { type: string, file: { content: string, truncatedByTokenCap?: boolean } }
type BashOut = { stdout: string, interrupted: boolean, isImage?: boolean, backgroundTaskId?: string,
  persistedOutputPath?: string, persistedOutputSize?: number }

const utf8 = new TextEncoder()
const extension = (path: string) => /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase() ?? ''
const lineCount = (s: string) => s.split('\n').length

// tools/tb.mjs in the flint clone: the mod's directory is mods/token-budget.
const tbScript = (root: string) => `${root.split(/[\\/]/).slice(0, -2).join('/')}/tools/tb.mjs`

// tb's placeholder for text, or undefined when tb failed or found no gain.
async function placeholder($: EngineInterface, text: string, args: readonly string[]) {
  const r = await $.process.run(['node', tbScript($.plugin.root), 'put', ...args, '--session', await $.session.id()],
    { stdin: text, timeoutMs: TB_TIMEOUT_MS }).catch(() => undefined)
  return r?.exitCode === 0 && r.stdout !== '' ? r.stdout.replace(/\n$/, '') : undefined
}

// Why tb cannot serve this session, or undefined when `tb doctor` says ok.
async function doctor($: EngineInterface) {
  try {
    const r = await $.process.run(['node', tbScript($.plugin.root), 'doctor'], { timeoutMs: TB_TIMEOUT_MS })
    return r.exitCode === 0 ? undefined : (r.stdout.trim() || r.stderr.trim() || `exit ${r.exitCode}`).replace(/\n/g, '; ')
  } catch (err) {
    return `node did not run tb doctor: ${err instanceof Error ? err.message : String(err)}`
  }
}

// An eligible Read or Bash result: its text (a Read of TRIGGER_B or more) or the
// file core saved a Bash output to, tb put's arguments, and the result with a
// placeholder in place of the text. No I/O: the offline replay (test/replay.mjs)
// runs the same rules.
export function eligible(e: ToolCallInput, result: unknown) {
  const big = (text: string) => utf8.encode(text).length >= TRIGGER_B
  if (e.tool === 'Read') {
    const r = result as ReadText
    if (r.type !== 'text' || e.offset !== undefined || e.limit !== undefined || e.allow_large || r.file.truncatedByTokenCap
      || CODE_EXTENSIONS.has(extension(e.file_path)) || TOOL_RESULTS.test(e.file_path) || !big(r.file.content)) return undefined
    return {
      text: r.file.content,
      args: ['--source', 'Read', '--path', e.file_path],
      replace: (ph: string) => ({ ...r, file: { ...r.file, content: ph, numLines: lineCount(ph) } }),
    }
  }
  if (e.tool === 'Bash') {
    // Inside the window the model sees the output whole: a placeholder only cost it a call (#57).
    const { persistedOutputPath: file, persistedOutputSize, ...r } = result as BashOut
    if (file === undefined || e.run_in_background || r.interrupted || r.isImage || r.backgroundTaskId !== undefined
      || TB_CALL.test(e.command)) return undefined
    return {
      file,
      // No --path: a stored output stays out of the shared index, so the 24 h purge removes every copy.
      // --saved: the placeholder names the one-call whole read; a Read of that file passes (#62).
      args: ['--source', 'Bash', '--saved', file, ...(e.description ? ['--intent', e.description] : [])],
      // No persisted fields: core shows the placeholder inline in place of its preview.
      replace: (ph: string) => ph.length < BASH_WINDOW ? { ...r, stdout: ph } : undefined,
    }
  }
  return undefined
}

// The result with its text replaced by tb's placeholder, else undefined.
async function rewrite($: EngineInterface, e: ToolCallInput, result: unknown) {
  const hit = eligible(e, result)
  if (!hit) return undefined
  const text = hit.file === undefined ? hit.text : await $.fs.read(hit.file).catch(() => undefined)
  const ph = text === undefined ? undefined : await placeholder($, text, hit.args)
  return ph === undefined ? undefined : hit.replace(ph)
}

export function register(on: On) {
  let tokens = 0
  let broken: Promise<string | undefined> = Promise.resolve(undefined)
  let reported = false

  on('session.start', ($, e, next) => {
    broken = doctor($)
    return next(e)
  })

  on('session.measure', ($, e, next) => {
    tokens = e.context.tokens ?? tokens
    return next(e)
  })

  on('agent.spawn', ($, e, next) =>
    e.fork && e.parentAgentId === undefined && tokens > FORK_MAX_TOKENS ? { deny: FORK_DENY } : next(e))

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined) return r
    const failure = await broken
    const result = r.isError || failure !== undefined ? undefined : await rewrite($, e, r.result)
    const context = [...(r.context ?? [])]
    if (e.agentId === undefined) {
      if (failure !== undefined && !reported) context.push(`TOKEN-BUDGET ERROR: ${failure}; placeholders off this session`)
      reported ||= failure !== undefined
    }
    if (result === undefined) return context.length ? { ...r, context } : r
    // Own { result } without ref or text: core maps the new result itself.
    return { result, ...(context.length ? { context } : {}) } as never
  })
}
