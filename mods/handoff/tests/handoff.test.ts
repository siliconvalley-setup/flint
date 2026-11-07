import { expect, test, type Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

function measure($: Engine, tokens: number) {
  return $.session.measure({ context: { tokens, window: 1_000_000 }, rateLimits: [], changed: ['context'] })
}

test('meter: a denied main tool call keeps the note for the next result', async ($, on) => {
  let deny = true
  on('tool.call', () => (deny ? { deny: 'no' } : { result: { stdout: 'ok', stderr: '', interrupted: false } }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await measure($, 251_000)
  expect((await $.tool.call({ tool: 'Bash' as const, command: 'ls' })).context).toBeUndefined()
  deny = false
  expect((await $.tool.call({ tool: 'Bash' as const, command: 'ls' })).context?.[0]).toContain('250k')
})

test('meter: one warning at 250k, one handoff order at 300k, on the next main tool result, again after a drop', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const ctx = async (agentId?: string) => (await $.tool.call({ tool: 'Bash' as const, command: 'ls', ...(agentId ? { agentId } : {}) })).context
  await measure($, 249_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 251_000)
  expect(await ctx('a1'), 'a subagent result gets no note').toBeUndefined()
  const warn = await ctx()
  expect(warn?.length).toBe(1)
  expect(warn?.[0]).toContain('250k')
  expect(await ctx()).toBeUndefined()
  await measure($, 280_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 301_000)
  const order = await ctx()
  expect(order?.length).toBe(1)
  expect(order?.[0]).toContain('300k')
  expect(order?.[0]).toContain('/handoff')
  expect(order?.[0]).not.toContain('memory_')
  await measure($, 320_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 40_000)
  await measure($, 260_000)
  expect((await ctx())?.[0]).toContain('250k')
  await measure($, 40_000)
  await measure($, 305_000)
  await measure($, 40_000)
  expect(await ctx(), 'a note whose threshold fell back before delivery is dropped').toBeUndefined()
  await measure($, 240_000)
  await measure($, 310_000)
  const jump = await ctx()
  expect(jump?.length, 'a jump past both thresholds sends the handoff order alone').toBe(1)
  expect(jump?.[0]).toContain('/handoff')
})

const doc = (status: string) => `---\nsubject: Some work\nstatus: ${status}\nsessions: [s1]\n---\n# Some work\n\nstatus: open\n`

// A handoff store: files by name in one dir, every listed path recorded.
function store(on: On, dir: Record<string, string | null> | 'missing', env: Record<string, string> = { HOME: '/home/u' }) {
  const listed: string[] = []
  on('classic.SessionStart', () => ({}))
  on('env.get', ($, e) => ({ value: env[e.name] }))
  on('fs.list', ($, e) => {
    listed.push(e.path)
    if (dir === 'missing') throw new Error(`fs.list: ENOENT ${e.path}`)
    return { value: Object.keys(dir).map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })) }
  })
  on('fs.read', ($, e) => {
    const text = dir === 'missing' ? undefined : dir[e.path.split('/').pop() ?? '']
    if (text == null) throw new Error(`fs.read: ENOENT ${e.path}`)
    return { value: text }
  })
  return listed
}

const start = ($: Engine, source: 'startup' | 'resume' | 'clear' | 'compact' = 'startup') =>
  $.classic.SessionStart({ source, cwd: '/Users/me/my.repo' })

test('session start: one line naming the open handoffs of the working dir', async ($, on) => {
  const listed = store(on, { '2026-11-01-a.md': doc('open'), '2026-11-02-b.md': doc('open'), '2026-11-03-c.md': doc('done'), 'notes.txt': doc('open'), '2026-11-04-d.md': null })
  const r = await start($)
  expect(r.additionalContext).toEqual(['2 open handoffs for this directory: run /handoff list'])
  expect(listed).toEqual(['/home/u/.claude/handoffs/-Users-me-my-repo'])
})

test('session start: one open handoff reads singular; CLAUDE_CONFIG_DIR wins over HOME', async ($, on) => {
  const listed = store(on, { '2026-11-01-a.md': doc('open') }, { HOME: '/home/u', CLAUDE_CONFIG_DIR: '/cfg' })
  expect((await start($, 'resume')).additionalContext).toEqual(['1 open handoff for this directory: run /handoff list'])
  expect(listed).toEqual(['/cfg/handoffs/-Users-me-my-repo'])
})

test('session start: no line with no open handoff, or on a compaction', async ($, on) => {
  store(on, { '2026-11-03-c.md': doc('done') })
  expect((await start($)).additionalContext ?? []).toEqual([])
  expect((await start($, 'compact')).additionalContext ?? []).toEqual([])
})

test('session start: a missing store fails open, no line', async ($, on) => {
  store(on, 'missing')
  expect((await start($)).additionalContext ?? []).toEqual([])
})
