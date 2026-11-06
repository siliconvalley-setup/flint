// token-budget mod: keeps large tool results and fat contexts out of the
// model's input, in the main conversation and every subagent (issue #46,
// docs/adr/0003-token-budget.md).
// - Placeholders: a large text Read or Bash result goes to tb (tools/tb.mjs),
//   and the model gets tb's placeholder: an outline, or head, tail and intent
//   hits, with the exact command that fetches any part. Rewritten once, before
//   core stores it; the original stays on disk or in tb's store.
// - Context meter: main-thread context past 150k tokens adds one warning, past
//   200k one handoff order, to the next main-thread tool result; once per
//   upward crossing, so a compaction or a drop re-arms it. One note per
//   result: a jump past both sends the handoff order alone.
// - Fork guard: refuses a fork from the main thread while its context is over
//   100k tokens (the session.measure figure): the fork would inherit it all.
//   Defense in depth: flint's env turns fork mode off (#47).
// - Loud failure: session.start runs `tb doctor` in the background. On a
//   failure the first main-thread tool result carries one TOKEN-BUDGET ERROR
//   line, and placeholders stay off for the session; the tools keep working.
// - Fail-open: a tb timeout, a non-zero exit or empty stdout passes the
//   original; a hook that throws is skipped by the mods runtime (no .catch).
import type { EngineInterface, On, ToolCallInput } from 'claude-code'

// Below this a result costs less than the Node start and the placeholder lines.
export const TRIGGER_B = 4096
// Past this the original passes: a slow tb never holds a result for long.
const TB_TIMEOUT_MS = 5000

// Main-thread context that earns a warning: room left to finish the step and hand off.
const WARN_TOKENS = 150_000
// Main-thread context that orders a handoff: past it every turn rereads too much.
const HANDOFF_TOKENS = 200_000
const k = (tokens: number) => `${tokens / 1000}k`
const METER: readonly (readonly [number, string])[] = [
  [WARN_TOKENS, `TOKEN-BUDGET: the main context is over ${k(WARN_TOKENS)} tokens, and every turn reads it again. `
    + 'Finish the current step and plan where to stop. Read sections (tb get, Read offset/limit), not whole files.'],
  [HANDOFF_TOKENS, `TOKEN-BUDGET: the main context is over ${k(HANDOFF_TOKENS)} tokens. Start no new tool work. `
    + 'Write an ai-memory handoff with memory_handoff_begin (summary, open_questions, next_steps, files_touched), '
    + 'then tell the user to continue in a new session.'],
]
// A main-thread fork past this copies too much context into every one of its requests.
const FORK_MAX_TOKENS = 100_000
const FORK_DENY = `Not spawned: a fork copies this conversation, over ${k(FORK_MAX_TOKENS)} tokens, into the subagent and pays for it on every request. `
  + 'Spawn a fresh agent (not fork) with a self-contained brief: the goal, the files to read, what you ruled out, and when it is done.'
// Read of these stays whole: the Read → Edit workflow on code keeps its shape.
const CODE_EXTENSIONS: ReadonlySet<string> = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'sh', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'css', 'scss', 'html', 'vue', 'svelte', 'sql',
  'json', 'yaml', 'yml', 'toml'])

// A Bash read the agent bounded: every statement but cd, echo and wc pipes through
// head, tail (not -f) or sed -n. The agent already chose the lines; a placeholder
// only cost it one more call for them (#52: 12 of 16 placeholders). Any tb.mjs
// call: tb's own output never becomes a placeholder, or a large section could not be read.
// shortcut: splits on ; && || and newlines without parsing quotes; parse when a quoted separator misleads it.
const BOUND = /(^|\|)\s*(head|sed -n|tail(?![^|]*\s-[fF]\b))\b/
const QUIET = /^(cd|echo|wc)\b/
const bounded = (command: string) => /\btb\.mjs\b/.test(command)
  || command.split(/;|&&|\|\||\n/).map(s => s.trim()).filter(s => s && !QUIET.test(s)).every(s => BOUND.test(s))

type ReadText = { type: string, file: { content: string, truncatedByTokenCap?: boolean } }
type BashOut = { stdout: string, interrupted: boolean, isImage?: boolean, backgroundTaskId?: string, persistedOutputPath?: string }

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

// An eligible Read or Bash result: its text (TRIGGER_B or more), tb put's
// arguments, and the result with a placeholder in place of the text. Pure: the
// offline replay (test/replay.mjs) runs the same rules.
export function eligible(e: ToolCallInput, result: unknown) {
  const big = (text: string) => utf8.encode(text).length >= TRIGGER_B
  if (e.tool === 'Read') {
    const r = result as ReadText
    if (r.type !== 'text' || e.offset !== undefined || e.limit !== undefined || r.file.truncatedByTokenCap
      || CODE_EXTENSIONS.has(extension(e.file_path)) || !big(r.file.content)) return undefined
    return {
      text: r.file.content,
      args: ['--source', 'Read', '--path', e.file_path],
      replace: (ph: string) => ({ ...r, file: { ...r.file, content: ph, numLines: lineCount(ph) } }),
    }
  }
  if (e.tool === 'Bash') {
    const r = result as BashOut
    if (e.run_in_background || r.interrupted || r.isImage || r.backgroundTaskId !== undefined
      || r.persistedOutputPath !== undefined || bounded(e.command) || !big(r.stdout)) return undefined
    return {
      text: r.stdout,
      args: ['--source', 'Bash', ...(e.description ? ['--intent', e.description] : [])],
      replace: (ph: string) => ({ ...r, stdout: ph }),
    }
  }
  return undefined
}

// The result with its text replaced by tb's placeholder, else undefined.
async function rewrite($: EngineInterface, e: ToolCallInput, result: unknown) {
  const hit = eligible(e, result)
  const ph = hit && await placeholder($, hit.text, hit.args)
  return ph === undefined ? undefined : hit?.replace(ph)
}

export function register(on: On) {
  let tokens = 0
  const crossed = new Set<number>()
  // Meter notes waiting for the next main-thread result, by threshold.
  const due = new Map<number, string>()
  let broken: Promise<string | undefined> = Promise.resolve(undefined)
  let reported = false

  on('session.start', ($, e, next) => {
    broken = doctor($)
    return next(e)
  })

  on('session.measure', ($, e, next) => {
    tokens = e.context.tokens ?? tokens
    for (const [at, note] of METER) {
      if (tokens < at) {
        crossed.delete(at)
        due.delete(at)
      } else if (!crossed.has(at)) {
        crossed.add(at)
        due.clear() // METER ascends: only a lower, now superseded note can wait here
        due.set(at, note)
      }
    }
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
      context.push(...due.values())
      due.clear()
    }
    if (result === undefined) return context.length ? { ...r, context } : r
    // Own { result } without ref or text: core maps the new result itself.
    return { result, ...(context.length ? { context } : {}) } as never
  })
}
