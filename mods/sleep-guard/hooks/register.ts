// sleep-guard mod: three wait and stop rules on Bash calls, in the main
// conversation and every subagent (docs/adr/sleep-guard.md).
// - Sleep: denies a foreground call whose first segment is `sleep N`,
//   N ≥ 25 s. Same rule as Claude Code's own block in Bash validateInput, which
//   the server flag `tengu_amber_sentinel` keeps off: its regex, its 25 s
//   floor. A sleep-led command is never auto-backgrounded on timeout, so it
//   blocks the loop for its whole run.
// - Transcript: denies a command that names `tasks/<id>.output` while agent
//   <id> is live: its completion notice is the wait. Background calls too.
// - Self-match: denies `pkill -f`, or `pgrep -f` in an until/while loop, whose
//   pattern matches the command: the Bash tool's shell holds the whole command
//   in its command line. Background calls too.
// - Fail-open: a hook that throws is skipped by the mods runtime (no .catch).
import type { AgentStatus, On } from 'claude-code'

const FLOOR_S = 25
const LEADING_SLEEP = /^sleep\s+(\d+(?:\.\d*)?)\s*$/
const SEPARATOR = /&&|\|\||[;|&\n]/
const SLEEP_DENY = 'Not run: a foreground sleep blocks you and is never moved to the background. '
  + 'To wait for a command you started, run it with run_in_background: true; its completion notice wakes you. '
  + 'To wait for a condition, run a foreground until-loop, e.g. `until <check>; do sleep 2; done`. '
  + 'Do not chain shorter sleeps to work around this block.'
const TRANSCRIPT = /\/tasks\/([A-Za-z0-9]+)\.output\b/g
// An ended agent and an idle teammate owe no completion notice: a read of theirs runs.
const LIVE: ReadonlySet<AgentStatus> = new Set<AgentStatus>(['pending', 'running', 'waiting'])
// pkill/pgrep, its flags, then the first word after them: the pattern.
const PROCESS_MATCH = /\b(pkill|pgrep)((?:\s+-\S+)+)\s+('[^']*'|"[^"]*"|[^\s;&|)]+)/g
const FULL_FLAG = /^-[A-Za-z]*f[A-Za-z]*$/
const LOOP = /\b(until|while)\b/

const transcriptDeny = (id: string) => `Not run: tasks/${id}.output is the transcript of agent ${id}, not a log. `
  + 'Its completion notice wakes you: end your turn or do other work. Never poll it; after it ends, read it with the Read tool.'
const selfMatchDeny = (pattern: string) => `Not run: '${pattern}' matches this call's own shell, whose command line holds the whole command: `
  + 'pkill kills that shell (exit 144), and an until-loop on pgrep never ends. '
  + "Make the pattern miss its own text: '[n]ode x' for 'node x'. A task you started: stop it with TaskStop."

// The pattern of a `pkill -f`, or of a `pgrep -f` in a loop, that matches the command itself.
function selfMatch(command: string): string | undefined {
  for (const [, tool, flags = '', word = ''] of command.matchAll(PROCESS_MATCH)) {
    const full = flags.trim().split(/\s+/).some(f => f === '--full' || FULL_FLAG.test(f))
    if (!full || (tool === 'pgrep' && !LOOP.test(command))) continue
    const pattern = word.replace(/^(['"])([\s\S]*)\1$/, '$2')
    try {
      if (new RegExp(pattern).test(command)) return pattern
    } catch {
      // not a valid regex here: no deny
    }
  }
  return undefined
}

export function register(on: On) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ids = new Set(Array.from(e.command.matchAll(TRANSCRIPT), m => m[1]))
    const live = ids.size === 0 ? undefined : (await $.agent.list()).find(a => ids.has(a.id) && LIVE.has(a.status))
    if (live !== undefined) return { deny: transcriptDeny(live.id) }
    const pattern = selfMatch(e.command)
    if (pattern !== undefined) return { deny: selfMatchDeny(pattern) }
    if (e.run_in_background === true) return next(e)
    const s = LEADING_SLEEP.exec(e.command.split(SEPARATOR, 1)[0]?.trim() ?? '')?.[1]
    return s !== undefined && parseFloat(s) >= FLOOR_S ? { deny: SLEEP_DENY } : next(e)
  })
}
