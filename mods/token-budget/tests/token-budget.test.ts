import { expect, test, type Engine } from 'claude-code/testing'
import type { On, ProcessRunResult } from 'claude-code'

const BIG = 'x'.repeat(4096)
const PLACEHOLDER = '[tb] 4096 B, 1 lines → /p/notes.md\n#notes  L1-1  4.0K  Notes\nread one: node /c/tools/tb.mjs get …\n'

// tb as the mod calls it: every run recorded, answered by `answer`.
function tb(on: On, answer: (argv: readonly string[]) => Partial<ProcessRunResult> = () => ({ stdout: PLACEHOLDER })) {
  const runs: { argv: readonly string[]; stdin?: string }[] = []
  on('session.id', () => ({ value: 's1' }))
  on('process.run', ($, e) => {
    runs.push({ argv: e.argv, stdin: e.init?.stdin })
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...answer(e.argv) } }
  })
  return runs
}

function readText(content: string, extra: object = {}) {
  return { type: 'text' as const, file: { filePath: '/p/notes.md', content, numLines: 1, startLine: 1, totalLines: 1, ...extra } }
}

function read($: Engine, input: { file_path?: string, offset?: number, limit?: number } = {}) {
  return $.tool.call({ tool: 'Read' as const, file_path: '/p/notes.md', ...input })
}

// The Read record a call answered with: the file of a text result, else the whole result.
async function readFile(call: ReturnType<typeof read>) {
  const r = await call
  if (r.deny !== undefined || r.isError) throw new Error(`no result: ${r.deny ?? r.text}`)
  return r.result.type === 'text' ? r.result.file : r.result
}

test('a large markdown Read becomes the tb placeholder, numLines its line count', async ($, on) => {
  on('tool.call', () => ({ result: readText(BIG) }))
  const runs = tb(on)
  expect(await readFile(read($))).toEqual({
    filePath: '/p/notes.md', content: PLACEHOLDER.trimEnd(), numLines: 3, startLine: 1, totalLines: 1,
  })
  expect(runs.length).toBe(1)
  expect(runs[0]?.argv[0]).toBe('node')
  expect(runs[0]?.argv[1]).toMatch(/^\/.+\/tools\/tb\.mjs$/)
  expect(runs[0]?.argv[1]).not.toContain('/mods/')
  expect(runs[0]?.argv.slice(2, 6)).toEqual(['put', '--source', 'Read', '--path'])
  expect(runs[0]?.argv.slice(6)).toEqual(['/p/notes.md', '--session', 's1'])
  expect(runs[0]?.stdin).toBe(BIG)
})

const CODE = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'sh', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp',
  'cs', 'rb', 'php', 'css', 'scss', 'html', 'vue', 'svelte', 'sql', 'json', 'yaml', 'yml', 'toml']

test('Read eligibility: only a whole, untruncated, non-code text file of 4096 B or more is rewritten', async ($, on) => {
  let answer: object = readText(BIG)
  on('tool.call', () => ({ result: answer }) as never)
  const runs = tb(on)
  const passes = async (label: string, input: Parameters<typeof read>[1], result: object) => {
    answer = result
    const before = runs.length
    expect((await read($, input)).result, label).toEqual(result)
    expect(runs.length, label).toBe(before)
  }
  const file = { filePath: '/p/x', originalSize: 9999 }
  await passes('image', {}, { type: 'image', file: { base64: BIG, type: 'image/png', originalSize: 9999 } })
  await passes('notebook', {}, { type: 'notebook', file: { filePath: '/p/x', cells: [BIG] } })
  await passes('pdf', {}, { type: 'pdf', file: { ...file, base64: BIG } })
  await passes('parts', {}, { type: 'parts', file: { ...file, count: 9, outputDir: '/o' } })
  await passes('file_unchanged', {}, { type: 'file_unchanged', file: { filePath: '/p/x' } })
  await passes('offset', { offset: 1 }, readText(BIG))
  await passes('limit', { limit: 400 }, readText(BIG))
  await passes('truncatedByTokenCap', {}, readText(BIG, { truncatedByTokenCap: true }))
  await passes('4095 B', {}, readText('é'.repeat(2047) + 'x'))
  for (const ext of CODE) await passes(ext, { file_path: `/p/a.${ext.toUpperCase()}` }, readText(BIG))
  for (const path of ['/p/a.md', '/p/a.txt', '/p/a.log', '/p/a.csv', '/p/Makefile']) {
    answer = readText(BIG)
    expect((await readFile(read($, { file_path: path })) as { content: string }).content, path).toBe(PLACEHOLDER.trimEnd())
  }
})

const bashOut = (stdout: string, extra: object = {}) => ({ stdout, stderr: 'warn', interrupted: false, ...extra })

function bash($: Engine, command: string, extra: { run_in_background?: boolean, description?: string } = {}) {
  return $.tool.call({ tool: 'Bash' as const, command, ...extra })
}

test('a large Bash stdout becomes the placeholder; core context is kept, no ref or text returned', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG), context: ['from core'], ref: 7, text: BIG }) as never)
  const runs = tb(on)
  const r = await bash($, 'gh issue view 46', { description: 'Read issue 46' })
  expect(r.result).toEqual(bashOut(PLACEHOLDER.trimEnd()))
  expect(r.context).toEqual(['from core'])
  expect([r.ref, r.text]).toEqual([undefined, undefined])
  expect(runs[0]?.argv.slice(2)).toEqual(['put', '--source', 'Bash', '--intent', 'Read issue 46', '--session', 's1'])
  expect(runs[0]?.stdin).toBe(BIG)
})

test('Bash eligibility: errors, interrupts, background, images, persisted output, range reads and tb calls pass', async ($, on) => {
  let answer: object = { result: bashOut(BIG) }
  on('tool.call', () => answer as never)
  const runs = tb(on)
  const passes = async (label: string, command: string, result: object, extra = {}) => {
    answer = result
    const before = runs.length
    expect((await bash($, command, extra)).result, label).toEqual((result as { result: object }).result)
    expect(runs.length, label).toBe(before)
  }
  await passes('error', 'make', { isError: true, result: BIG, text: BIG })
  await passes('interrupted', 'make', { result: bashOut(BIG, { interrupted: true }) })
  await passes('background input', 'make', { result: bashOut(BIG) }, { run_in_background: true })
  await passes('backgroundTaskId', 'make', { result: bashOut(BIG, { backgroundTaskId: 'b1' }) })
  await passes('isImage', 'make', { result: bashOut(BIG, { isImage: true }) })
  await passes('persistedOutputPath', 'make', { result: bashOut(BIG, { persistedOutputPath: '/t/o.txt' }) })
  await passes('4095 B', 'make', { result: bashOut(BIG.slice(1)) })
  // #52: the agent bounded these itself; a placeholder only cost it one more call for the same lines.
  const ranges = ["sed -n '1,200p' docs/a.md", 'sed -n 1,200p a.md', 'sed -n "5,9p" a.md', 'head -n 300 build.log',
    'tail -n 300 build.log', "node /c/tools/tb.mjs get '/p/a.md#intro'", 'cd /p && node /c/tools/tb.mjs find "fork guard"',
    'cd /p; sed -n 36,150p tools/tokscan.py', 'cd /p; git diff HEAD | head -400', "gh api repos/o/r/issues/48 --jq '.body' | head -c 6000",
    'cd /p; wc -l t.sh; sed -n 1,400p t.sh', "sed -n 1,99p t.sh | cut -c1-200", "sed -n '1,200p' a.md | rg x",
    'head -n 300 a.md b.md', 'head -c 9999 a.md']
  for (const c of ranges) await passes(c, c, { result: bashOut(BIG) })
  const whole = ['tail -f build.log', 'tail -n 50 -F build.log', "sed 's/a/b/' a.md", 'cat a.md', 'sed -n 1,200p a.md; cat b.md',
    'git diff HEAD && git status --short', 'cat a.md | rg x', 'echo head; cat a.md', 'cd /p && cat a.md || head -n 5 b.md']
  for (const c of whole) {
    answer = { result: bashOut(BIG) }
    expect((await bash($, c)).result, c).toEqual(bashOut(PLACEHOLDER.trimEnd()))
  }
})

test('tb timeout, non-zero exit or empty stdout: the original passes', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG) }))
  on('session.id', () => ({ value: 's1' }))
  let answer: () => Partial<ProcessRunResult> = () => ({})
  const timeouts: (number | undefined)[] = []
  on('process.run', ($, e) => {
    timeouts.push(e.init?.timeoutMs)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...answer() } }
  })
  const cases: [string, () => Partial<ProcessRunResult>][] = [
    ['timeout', () => { throw new Error('process.run: still running after 5000 ms') }],
    ['non-zero exit', () => ({ exitCode: 1, stdout: PLACEHOLDER })],
    ['empty stdout', () => ({ stdout: '' })],
  ]
  for (const [label, run] of cases) {
    answer = run
    expect((await bash($, 'make')).result, label).toEqual(bashOut(BIG))
  }
  expect(timeouts).toEqual([5000, 5000, 5000])
})

function measure($: Engine, tokens: number) {
  return $.session.measure({ context: { tokens, window: 1_000_000 }, rateLimits: [], changed: ['context'] })
}

test('meter: one warning at 150k, one handoff order at 200k, on the next main tool result, again after a drop', async ($, on) => {
  on('tool.call', () => ({ result: bashOut('ok') }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  tb(on)
  const ctx = async (agentId?: string) => (await $.tool.call({ tool: 'Bash' as const, command: 'ls', ...(agentId ? { agentId } : {}) })).context
  await measure($, 149_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 151_000)
  expect(await ctx('a1')).toBeUndefined()
  const warn = await ctx()
  expect(warn?.length).toBe(1)
  expect(warn?.[0]).toContain('150k')
  expect(await ctx()).toBeUndefined()
  await measure($, 180_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 201_000)
  const handoff = await ctx()
  expect(handoff?.length).toBe(1)
  expect(handoff?.[0]).toContain('memory_handoff_begin')
  await measure($, 220_000)
  expect(await ctx()).toBeUndefined()
  await measure($, 40_000)
  await measure($, 160_000)
  expect((await ctx())?.[0]).toContain('150k')
  await measure($, 40_000)
  await measure($, 205_000)
  await measure($, 40_000)
  expect(await ctx(), 'a note whose threshold fell back before delivery is dropped').toBeUndefined()
  await measure($, 140_000)
  await measure($, 210_000)
  const jump = await ctx()
  expect(jump?.length, 'a jump past both thresholds sends the handoff order alone').toBe(1)
  expect(jump?.[0]).toContain('memory_handoff_begin')
})

function spawn($: Engine, fork: boolean, parentAgentId?: string) {
  return $.agent.spawn({
    tool_use_id: 't1', prompt: 'audit', description: 'audit', subagentType: fork ? 'fork' : 'Explore',
    provider: { plugin: 'engine', tier: 'core' }, parentModel: 'm', background: true, fork,
    ...(parentAgentId === undefined ? {} : { parentAgentId }),
  })
}

test('fork guard: a main-thread fork over 100k tokens is refused; other spawns run', async ($, on) => {
  on('agent.spawn', () => ({ model: 'm', agentId: 'n1' }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await measure($, 80_000)
  expect((await spawn($, true)).deny).toBeUndefined()
  await measure($, 120_000)
  expect((await spawn($, true)).deny).toContain('fresh agent')
  await measure($, 300_000)
  expect((await spawn($, true, 'a1')).deny).toBeUndefined()
  expect((await spawn($, false)).deny).toBeUndefined()
})

test('fail-open: an internal error passes the original, no deny', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG) }))
  on('session.id', () => { throw new Error('forced') })
  const runs: unknown[] = []
  on('process.run', ($, e) => {
    runs.push(e.argv)
    return { value: { exitCode: 0, stdout: PLACEHOLDER, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const r = await bash($, 'make')
  expect([r.deny, r.result]).toEqual([undefined, bashOut(BIG)])
  expect(runs.length).toBe(0)
})

function start($: Engine) {
  return $.session.start({ cwd: '/p', surface: null, isInteractive: false })
}

test('loud failure: a failed tb doctor puts one TOKEN-BUDGET ERROR line on the first main result, then placeholders stay off', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG) }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const runs = tb(on, argv => argv.at(-1) === 'doctor'
    ? { exitCode: 1, stdout: 'node:sqlite with FTS5 missing: no such module: fts5\n' }
    : { stdout: PLACEHOLDER })
  await start($)
  const sub = await $.tool.call({ tool: 'Bash' as const, command: 'make', agentId: 'a1' })
  expect([sub.result, sub.context]).toEqual([bashOut(BIG), undefined])
  const first = await bash($, 'make')
  expect(first.result).toEqual(bashOut(BIG))
  expect(first.context).toEqual(['TOKEN-BUDGET ERROR: node:sqlite with FTS5 missing: no such module: fts5; placeholders off this session'])
  const later = await bash($, 'make')
  expect([later.result, later.context]).toEqual([bashOut(BIG), undefined])
  expect(runs.map(r => r.argv.at(-1))).toEqual(['doctor'])
})

test('loud failure: node missing from PATH is named', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG) }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('process.run', () => ({ deny: 'spawn node ENOENT' }))
  await start($)
  expect((await bash($, 'make')).context?.[0]).toMatch(/^TOKEN-BUDGET ERROR: .*ENOENT.*; placeholders off this session$/)
})

test('a good tb doctor keeps placeholders on, with no error line', async ($, on) => {
  on('tool.call', () => ({ result: bashOut(BIG) }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  tb(on, argv => ({ stdout: argv.at(-1) === 'doctor' ? 'ok\n' : PLACEHOLDER }))
  await start($)
  const r = await bash($, 'make')
  expect([r.result, r.context]).toEqual([bashOut(PLACEHOLDER.trimEnd()), undefined])
})
