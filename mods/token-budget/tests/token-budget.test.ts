import { expect, test, type Engine } from 'claude-code/testing'
import type { On, ProcessRunResult } from 'claude-code'

const BIG = 'x'.repeat(16384)
const PLACEHOLDER = '[tb] 16384 B, 1 lines → /p/notes.md\n#notes  L1-1  16K  Notes\nread one: node /c/tools/tb.mjs get …\n'

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

function read($: Engine, input: { file_path?: string, offset?: number, limit?: number, allow_large?: boolean } = {}) {
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

test('Read eligibility: only a whole, untruncated, non-code text file of 16384 B or more is rewritten', async ($, on) => {
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
  await passes('allow_large', { allow_large: true }, readText(BIG))
  await passes('truncatedByTokenCap', {}, readText(BIG, { truncatedByTokenCap: true }))
  await passes('16383 B', {}, readText('é'.repeat(8191) + 'x'))
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

// What core keeps of a Bash output past its window, and the file it saved the whole output to.
const SAVED = '/h/.claude/projects/-p/s1/tool-results/b1.txt'
const saved = (extra: object = {}) => bashOut(BIG.slice(0, 9999), { persistedOutputPath: SAVED, persistedOutputSize: BIG.length, ...extra })

// The saved file as $.fs.read gives it: every read recorded, answered by `answer`.
function files(on: On, answer: (path: string) => string = () => BIG) {
  const reads: string[] = []
  on('fs.read', ($, e) => {
    reads.push(e.path)
    return { value: answer(e.path) }
  })
  return reads
}

test('a Bash output core saved to a file becomes the placeholder of the whole file; core context kept, no ref or text', async ($, on) => {
  on('tool.call', () => ({ result: saved(), context: ['from core'], ref: 7, text: 'preview' }) as never)
  const runs = tb(on)
  const reads = files(on)
  const r = await bash($, 'gh issue view 46', { description: 'Read issue 46' })
  // No persisted fields: core shows the placeholder inline, not its 2 KB preview of the file.
  expect(r.result).toEqual(bashOut(PLACEHOLDER.trimEnd()))
  expect(r.context).toEqual(['from core'])
  expect([r.ref, r.text]).toEqual([undefined, undefined])
  expect(reads).toEqual([SAVED])
  expect(runs[0]?.argv.slice(2)).toEqual(['put', '--source', 'Bash', '--saved', SAVED, '--intent', 'Read issue 46', '--session', 's1'])
  expect(runs[0]?.stdin).toBe(BIG)
})

test('Bash eligibility: only an output core saved to a file; errors, interrupts, background and images pass', async ($, on) => {
  let answer: object = { result: saved() }
  on('tool.call', () => answer as never)
  const runs = tb(on)
  files(on)
  const passes = async (label: string, command: string, result: object, extra = {}) => {
    answer = result
    const before = runs.length
    expect((await bash($, command, extra)).result, label).toEqual((result as { result: object }).result)
    expect(runs.length, label).toBe(before)
  }
  // #57: the model already sees an output inside the window whole; a placeholder only cost it one more call.
  for (const c of ['cat a.md', 'git diff HEAD', "sed -n '1,200p' docs/a.md"]) await passes(c, c, { result: bashOut(BIG) })
  await passes('error', 'make', { isError: true, result: BIG, text: BIG })
  await passes('interrupted', 'make', { result: saved({ interrupted: true }) })
  await passes('background input', 'make', { result: saved() }, { run_in_background: true })
  await passes('backgroundTaskId', 'make', { result: saved({ backgroundTaskId: 'b1' }) })
  await passes('isImage', 'make', { result: saved({ isImage: true }) })
  // #74: a tb call is the way back from a placeholder; its output, piped or not, never gets one.
  for (const c of ["node /c/tools/tb.mjs get 'tb:1#a'", "node /c/tools/tb.mjs get 'tb:1' | cat -n | sed -n 1,400p"]) {
    await passes(c, c, { result: saved() })
  }
  // Past the window the model sees core's preview, not the lines it asked for (#62).
  for (const c of ['make', 'git diff HEAD', 'rg -n foo src', "cat a.md | rg foo", "sed -n '1p;5p' a.md"]) {
    answer = { result: saved() }
    expect((await bash($, c)).result, c).toEqual(bashOut(PLACEHOLDER.trimEnd()))
  }
})

test('saved Bash output of a file read: inline whole up to 30000 B, else core preview; never a placeholder', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  const runs = tb(on)
  let text = 'y'.repeat(30000)
  files(on, () => text)
  // #81: kept out, a file read came back in about 2 more calls; core keeps a hook's stdout up to 30000 inline.
  for (const c of ['cat src/a.ts src/b.ts', "cat docs/a.md | head -80; echo ----; cat biome.json; sed -n 600,1063p /t/tool-results/b2.txt",
    "sed -n '1,200p' docs/a.md", 'ls test/helpers && cat test/helpers/*', 'head -n 300 build.log', 'tail -n 50 a.log | nl -ba']) {
    expect((await bash($, c)).result, c).toEqual(bashOut(text))
  }
  expect(runs.length).toBe(0)
  // Past it the agent read core's saved file once; a placeholder sent it back to the sources.
  text = 'y'.repeat(30001)
  expect((await bash($, 'cat a.md')).result, '30001 B').toEqual(saved())
  // Bytes, not chars: 15001 two-byte chars are 30002 B.
  text = 'é'.repeat(15001)
  expect((await bash($, 'cat a.md')).result, 'multibyte').toEqual(saved())
  expect(runs.length).toBe(0)
  for (const c of ['tail -f a.log', 'tail -n 5 -f a.log', 'cat a.md | sort']) {
    text = 'y'.repeat(20000)
    expect((await bash($, c)).result, c).toEqual(bashOut(PLACEHOLDER.trimEnd()))
  }
  expect(runs.length).toBe(3)
})

test('saved Bash output: a failed file read keeps core preview', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  const runs = tb(on)
  on('fs.read', () => { throw new Error('fs.read: ENOENT') })
  expect((await bash($, 'make')).result).toEqual(saved())
  expect(runs.length).toBe(0)
})

test('saved Bash output: a placeholder of Bash window size or more keeps core preview', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  let size = 16383
  tb(on, () => ({ stdout: 'y'.repeat(size) + '\n' }))
  files(on)
  expect((await bash($, 'make')).result, '16383 chars').toEqual(bashOut('y'.repeat(16383)))
  size = 16384
  expect((await bash($, 'make')).result, '16384 chars').toEqual(saved())
})

test('Read of a Claude Code tool-results file passes whole, whatever command made it', async ($, on) => {
  on('tool.call', () => ({ result: readText(BIG) }))
  const runs = tb(on)
  // #62: the agent reads the file to see the output; a placeholder sent it back to the source in 4 more calls.
  expect(await readFile(read($, { file_path: '/h/.claude/projects/-p/s1/tool-results/b4m6bbqbd.txt' }))).toEqual(readText(BIG).file)
  expect(runs.length).toBe(0)
})

test('tb timeout, non-zero exit or empty stdout: the original passes', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  on('session.id', () => ({ value: 's1' }))
  files(on)
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
    expect((await bash($, 'make')).result, label).toEqual(saved())
  }
  expect(timeouts).toEqual([5000, 5000, 5000])
})

function measure($: Engine, tokens: number) {
  return $.session.measure({ context: { tokens, window: 1_000_000 }, rateLimits: [], changed: ['context'] })
}

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
  on('tool.call', () => ({ result: saved() }))
  on('session.id', () => { throw new Error('forced') })
  files(on)
  const runs: unknown[] = []
  on('process.run', ($, e) => {
    runs.push(e.argv)
    return { value: { exitCode: 0, stdout: PLACEHOLDER, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const r = await bash($, 'make')
  expect([r.deny, r.result]).toEqual([undefined, saved()])
  expect(runs.length).toBe(0)
})

function start($: Engine) {
  return $.session.start({ cwd: '/p', surface: null, isInteractive: false })
}

test('loud failure: a failed tb doctor puts one TOKEN-BUDGET ERROR line on the first main result, then placeholders stay off', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const runs = tb(on, argv => argv.at(-1) === 'doctor'
    ? { exitCode: 1, stdout: 'node:sqlite with FTS5 missing: no such module: fts5\n' }
    : { stdout: PLACEHOLDER })
  files(on)
  await start($)
  const sub = await $.tool.call({ tool: 'Bash' as const, command: 'make', agentId: 'a1' })
  expect([sub.result, sub.context]).toEqual([saved(), undefined])
  const first = await bash($, 'make')
  expect(first.result).toEqual(saved())
  expect(first.context).toEqual(['TOKEN-BUDGET ERROR: node:sqlite with FTS5 missing: no such module: fts5; placeholders off this session'])
  const later = await bash($, 'make')
  expect([later.result, later.context]).toEqual([saved(), undefined])
  expect(runs.map(r => r.argv.at(-1))).toEqual(['doctor'])
})

test('loud failure: node missing from PATH is named', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('process.run', () => ({ deny: 'spawn node ENOENT' }))
  await start($)
  expect((await bash($, 'make')).context?.[0]).toMatch(/^TOKEN-BUDGET ERROR: .*ENOENT.*; placeholders off this session$/)
})

test('a good tb doctor keeps placeholders on, with no error line', async ($, on) => {
  on('tool.call', () => ({ result: saved() }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  tb(on, argv => ({ stdout: argv.at(-1) === 'doctor' ? 'ok\n' : PLACEHOLDER }))
  files(on)
  await start($)
  const r = await bash($, 'make')
  expect([r.result, r.context]).toEqual([bashOut(PLACEHOLDER.trimEnd()), undefined])
})
