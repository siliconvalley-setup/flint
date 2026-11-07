// handoff mod: tells the agent when to hand off and the owner what waits
// (issue #70, docs/adr/0004-handoff-catalog.md). The /handoff skill writes,
// lists and resumes the handoffs; this mod only reads them.
// - Context meter: main-thread context past 250k tokens adds one warning, past
//   300k one order to run /handoff, to the next main-thread tool result; once
//   per upward crossing, so a compaction or a drop re-arms it. One note per
//   result: a jump past both sends the handoff order alone.
// - Session start: one line with the count of open handoffs of the working
//   directory, only when there is one or more. No handoff text loaded.
// - Fail-open: a store that is missing or cannot be read gives no line; a hook
//   that throws is skipped by the mods runtime.
import type { EngineInterface, On } from 'claude-code'

// Main-thread context that earns a warning: room left to finish the step and hand off.
const WARN_TOKENS = 250_000
// Main-thread context that orders a handoff: past it every turn rereads too much.
const HANDOFF_TOKENS = 300_000
const k = (tokens: number) => `${tokens / 1000}k`
const METER: readonly (readonly [number, string])[] = [
  [WARN_TOKENS, `HANDOFF: the main context is over ${k(WARN_TOKENS)} tokens, and every turn reads it again. `
    + 'Finish the current step and plan where to stop. Read file sections, not whole files.'],
  [HANDOFF_TOKENS, `HANDOFF: the main context is over ${k(HANDOFF_TOKENS)} tokens. Start no new tool work. `
    + 'Run the /handoff skill to write or update the handoff of this work line, '
    + 'then tell the user to open a new session and run /handoff resume.'],
]
// The frontmatter of an open handoff: `status: open` before the closing `---`.
const OPEN = /^---\n(?:(?!---\n)[^\n]*\n)*?status:[ \t]*open[ \t]*\n/

// The store of one working directory: <config dir>/handoffs/<cwd, each non-alphanumeric
// character as `-`>, the name Claude Code gives the directory under projects/.
async function storeDir($: EngineInterface, cwd: string) {
  const config = await $.env.get('CLAUDE_CONFIG_DIR') ?? `${await $.env.get('HOME')}/.claude`
  return `${config}/handoffs/${cwd.replace(/[^A-Za-z0-9]/g, '-')}`
}

async function openCount($: EngineInterface, dir: string) {
  const files = (await $.fs.list(dir)).filter(f => f.kind === 'file' && f.name.endsWith('.md'))
  // An unreadable file counts as not open: the others still count.
  const texts = await Promise.all(files.map(f => $.fs.read(`${dir}/${f.name}`).catch(() => '')))
  return texts.filter(t => OPEN.test(t)).length
}

export function register(on: On) {
  let tokens = 0
  const crossed = new Set<number>()
  // Meter notes waiting for the next main-thread result, by threshold.
  const due = new Map<number, string>()

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

  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined || e.agentId !== undefined || due.size === 0) return r
    const context = [...(r.context ?? []), ...due.values()]
    due.clear()
    return { ...r, context }
  })

  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.source === 'compact') return r
    const n = await openCount($, await storeDir($, e.cwd))
    if (n === 0) return r
    const line = `${n} open handoff${n === 1 ? '' : 's'} for this directory: run /handoff list`
    return { ...r, additionalContext: [...(r.additionalContext ?? []), line] }
  })
}
