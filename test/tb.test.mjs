// tb CLI seam tests: argv + stdin in, stdout + exit code out (issue #46).
// Run: node --test test/tb.test.mjs
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TB = fileURLToPath(new URL('../tools/tb.mjs', import.meta.url)).replace(/\\/g, '/')
const POSIX_MODES = process.platform === 'win32' && 'no POSIX file modes on Windows'
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SCRATCH = realpathSync(mkdtempSync(join(tmpdir(), 'tb-test-')))
after(() => rmSync(SCRATCH, { recursive: true, force: true }))

function tmp() {
  return mkdtempSync(join(SCRATCH, 't-'))
}

// One tb call in a fresh project dir with its own data dir.
function tb(args, { input = '', data, cwd, env = {}, node = [] } = {}) {
  const r = spawnSync(process.execPath, [...node, TB, ...args], {
    input, cwd, encoding: 'utf8',
    env: { ...process.env, TB_DATA_DIR: data, ...env },
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

// Every file under dir, recursively.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])
}

function project(files) {
  const dir = tmp()
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return { dir, data: join(tmp(), 'data') }
}

const GUIDE = [
  '# Guide', 'intro',
  '## Install', 'step', '```sh', '# not a heading', '```',
  '## Usage', 'use',
  '## Install', 'again',
].join('\n') + '\n'

test('outline: heading-path ids, duplicate suffix, fenced # ignored, exact ranges', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const path = join(dir, 'guide.md')
  const first = tb(['outline', path], { data, cwd: dir })
  assert.equal(first.code, 0, first.err)
  const lines = first.out.trimEnd().split('\n')
  assert.equal(lines[0], `[tb] ${GUIDE.length} B, 11 lines → ${path}`)
  assert.match(lines[1], /^#guide {2}L1-11 {2}\S+ {2}Guide$/)
  assert.match(lines[2], /^#guide\/install {2}L3-7 {2}\S+ {2}Install$/)
  assert.match(lines[3], /^#guide\/usage {2}L8-9 {2}\S+ {2}Usage$/)
  assert.match(lines[4], /^#guide\/install-2 {2}L10-11 {2}\S+ {2}Install$/)
  assert.equal(lines.length, 6)
  assert.ok(lines[5].startsWith(`read one: node ${TB} get '${path}#guide/install' or any #id above · whole: Read ${path} with allow_large`), lines[5])
  assert.ok(lines[5].includes('before Edit: Read the exact range with offset/limit'), lines[5])
  assert.equal(tb(['outline', path], { data, cwd: dir }).out, first.out)
})

test('get: by id and by range, exact current lines with numbers, fresh after a change', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const path = join(dir, 'guide.md')
  const get = target => tb(['get', target], { data, cwd: dir })
  assert.equal(get(`${path}#guide/usage`).out, '8\t## Usage\n9\tuse\n')
  assert.equal(get(`${path}:3-4`).out, '3\t## Install\n4\tstep\n')
  assert.equal(get('guide.md#guide/install-2').out, '10\t## Install\n11\tagain\n')
  writeFileSync(path, GUIDE.replace('use\n', 'use\nmore use\n'))
  assert.equal(get(`${path}#guide/usage`).out, '8\t## Usage\n9\tuse\n10\tmore use\n')
  const missing = get(`${path}#nope`)
  assert.notEqual(missing.code, 0)
  assert.equal(missing.out, '')
})

// #52: a ref with no section failed; output past the Bash window came back as one more placeholder.
test('get: no section reads it all; output pages below the Bash window, the last line names the next range', () => {
  const { dir, data } = project({})
  const out = Array.from({ length: 2000 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'
  const ref = /→ (tb:[0-9a-f]{16})/.exec(tb(['put', '--source', 'Bash'], { input: out, data, cwd: dir }).out)[1]
  const get = (target, window) => tb(['get', target], { data, cwd: dir, env: { BASH_MAX_OUTPUT_LENGTH: window } })
  assert.equal(get(`${ref}:1-2`, '10000').out, '1\tline 1\n2\tline 2\n')
  const page = get(ref, '10000')
  assert.equal(page.code, 0, page.err)
  assert.ok(page.out.length < 10000, `${page.out.length}`)
  const lines = page.out.trimEnd().split('\n')
  assert.equal(lines[0], '1\tline 1')
  const last = +lines.at(-2).split('\t')[0]
  assert.equal(lines.at(-1), `more: node ${TB} get '${ref}:${last + 1}-2000'`)
  assert.equal(get(`${ref}:${last + 1}-2000`, '10000').out.split('\n')[0], `${last + 1}\tline ${last + 1}`)
  assert.equal(get(ref, '').out, get(ref, '16384').out, 'no window set: flint default 16384')
  assert.ok(get(ref, '100000').out.endsWith('2000\tline 2000\n'), 'a wide window takes it all')
  // #76: core counts bytes; a page of multibyte text stays under the window in bytes.
  const wide = '— × … multibyte line here\n'.repeat(900)
  const ref2 = /→ (tb:[0-9a-f]{16})/.exec(tb(['put', '--source', 'Bash'], { input: wide, data, cwd: dir }).out)[1]
  const p2 = get(ref2, '10000').out
  assert.ok(Buffer.byteLength(p2) < 10000 && p2.length < 9000, `${Buffer.byteLength(p2)} B, ${p2.length} chars`)
  assert.match(p2.trimEnd().split('\n').at(-1), /^more: /)
})

// A ticket as `gh issue view` prints it: blank lines around every heading.
const TICKET = ['# Guide', '', 'intro', '', '## Install', '', 'step', '', '## Usage', '', 'use', ''].join('\n') + 'filler line\n'.repeat(400)

test('put: a markdown Bash output becomes an outline, stored 0600 outside the repo, read back by get', () => {
  const { dir, data } = project({})
  const ticket = TICKET
  const r = tb(['put', '--source', 'Bash', '--intent', 'show ticket', '--saved', '/h/tool-results/b1.txt'], { input: ticket, data, cwd: dir })
  assert.equal(r.code, 0, r.err)
  const [head, ...rest] = r.out.trimEnd().split('\n')
  const where = /^\[tb\] (\d+) B, (\d+) lines → (tb:[0-9a-f]{16})$/.exec(head)
  assert.ok(where, head)
  assert.deepEqual([+where[1], +where[2]], [ticket.length, 411])
  assert.match(rest[2], /^#guide\/usage {2}L9-411 {2}\S+ {2}Usage$/)
  // #75: the example names the section with the most text of its own; the whole read is one Read that passes the mod.
  assert.equal(rest.at(-1), `read one: node ${TB} get '${where[3]}#guide/usage' or any #id above · whole: Read /h/tool-results/b1.txt`)
  assert.equal(tb(['get', `${where[3]}#guide/install`], { data, cwd: dir }).out, '5\t## Install\n6\t\n7\tstep\n8\t\n')
  assert.equal(walk(data).filter(f => readFileSync(f, 'utf8') === ticket).length, 1)
  assert.deepEqual(walk(dir), [])
})

test('put: a stored output is owner-only (0600)', { skip: POSIX_MODES }, () => {
  const { dir, data } = project({})
  tb(['put', '--source', 'Bash'], { input: LOG, data, cwd: dir })
  const stored = walk(data).filter(f => readFileSync(f, 'utf8') === LOG)
  assert.equal(stored.length, 1)
  assert.equal(statSync(stored[0]).mode & 0o777, 0o600)
})

const LOG = Array.from({ length: 400 }, (_, i) => i === 199 ? 'ERROR disk full on /var' : `step ${i + 1} ok`).join('\n') + '\n'

test('put: other text keeps head, tail and intent hits; same input gives same bytes; no gain prints nothing', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const put = (input, intent) => tb(['put', '--source', 'Bash', ...(intent ? ['--intent', intent] : [])], { input, data, cwd: dir })
  const plain = put(LOG).out.trimEnd().split('\n')
  assert.match(plain[0], /^\[tb\] \d+ B, 400 lines → tb:[0-9a-f]{16}$/)
  assert.deepEqual(plain.slice(1, 3), ['step 1 ok', 'step 2 ok'])
  assert.deepEqual(plain.slice(40, 43), ['step 40 ok', '[… L41-380 omitted]', 'step 381 ok'])
  assert.equal(plain[61], 'step 400 ok')
  assert.ok(plain[62].startsWith(`read one: node ${TB} get 'tb:`) && plain[62].endsWith(":<a>-<b>'"), plain[62])
  assert.equal(plain.length, 63)
  assert.ok(put(LOG, undefined).out === put(LOG).out)
  assert.ok(tb(['put', '--source', 'Bash', '--saved', '/h/b2.txt'], { input: LOG, data, cwd: dir }).out.endsWith(":<a>-<b>' · whole: Read /h/b2.txt\n"))
  const hit = put(LOG, 'check disk space').out
  assert.ok(hit.includes('step 40 ok\n[… L41-160 omitted]\nstep 161 ok\n'), hit)
  assert.ok(hit.includes('\nERROR disk full on /var\n[… L201-380 omitted]\nstep 381 ok\n'), hit)
  put('unrelated output\n'.repeat(300), 'unrelated')
  tb(['outline', join(dir, 'guide.md')], { data, cwd: dir })
  assert.equal(put(LOG, 'check disk space').out, hit)
  const tiny = put(Array.from({ length: 2000 }, (_, i) => `# h${i}\n`).join('\n'))
  assert.deepEqual([tiny.code, tiny.out], [0, ''])
  assert.ok(!walk(data).some(f => readFileSync(f, 'utf8').includes('# h1999')), 'a passed output is not stored')
})

const DIFF = [
  'diff --git a/README.md b/README.md', 'index 1..2 100644', '--- a/README.md', '+++ b/README.md', '@@ -1,3 +1,4 @@',
  ' # dataforseo-cli (`dfs`)', '+new line', '-old', ' ctx',
  'diff --git a/src/call.ts b/src/call.ts', '--- a/src/call.ts', '+++ b/src/call.ts', '@@ -1 +1 @@', '-a', '+b', '+c',
].join('\n') + '\n'

test('put: a diff is outlined by file with +/- counts, never by a # context line; get returns one file (#74)', () => {
  const { dir, data } = project({})
  const text = DIFF + ' filler context\n'.repeat(400)
  const r = tb(['put', '--source', 'Bash'], { input: text, data, cwd: dir })
  const [head, ...rest] = r.out.trimEnd().split('\n')
  const ref = /→ (tb:[0-9a-f]{16})$/.exec(head)[1]
  assert.match(rest[0], /^#readme-md {2}L1-9 {2}\S+ {2}README\.md {2}\+1 -1$/)
  assert.match(rest[1], /^#src-call-ts {2}L10-416 {2}\S+ {2}src\/call\.ts {2}\+2 -1$/)
  assert.equal(rest[2], `read one: node ${TB} get '${ref}#src-call-ts' or any #id above`)
  assert.equal(tb(['get', `${ref}#readme-md`], { data, cwd: dir }).out.split('\n').length, 10)
  // Plain `diff -u` and a status line before the first file.
  const plain = 'M x\n--- x.txt\t2026\n+++ x.txt\t2026\n@@ -1 +1 @@\n-a\n+b\n' + ' c\n'.repeat(400)
  const out = tb(['put', '--source', 'Bash'], { input: plain, data, cwd: dir }).out.split('\n')
  assert.match(out[1], /^#_top {2}L1-1 /)
  assert.match(out[2], /^#x-txt {2}L2-406 {2}\S+ {2}x\.txt {2}\+1 -1$/)
})

test('put: text with no markdown name needs real markdown: # comments, a code head and tight headings get an excerpt (#74)', () => {
  const { dir, data } = project({ 'tight.md': GUIDE + 'x\n'.repeat(400) })
  const put = input => tb(['put', '--source', 'Bash'], { input, data, cwd: dir }).out.split('\n')[1]
  assert.equal(put('#!/bin/sh\n\n# 15: mod suites\nfor m in x; do\n  echo $m\ndone\n\n# 16: tb suite\n' + 'echo line\n'.repeat(300)), '#!/bin/sh')
  assert.equal(put('const x = 1\n'.repeat(100) + TICKET), 'const x = 1')
  assert.equal(put(GUIDE + 'x\n'.repeat(400)), '# Guide', 'headings with no blank line around them: code comments, not markdown')
  assert.match(put(TICKET), /^#guide {2}L1-411 /)
  // The same tight text under a .md name is markdown, as before.
  assert.match(tb(['outline', join(dir, 'tight.md')], { data, cwd: dir }).out.split('\n')[1], /^#guide {2}L1-411 /)
})

test('find: ranks named and already-indexed files, top 5 then more:, pages, stays fresh', () => {
  const { dir, data } = project({
    'a.md': '# Alpha\n## Cache\nthe prompt cache keeps the prefix\n## Fork\na fork inherits context\n',
    'b.md': '# Beta\n## Placeholder\na placeholder replaces a large tool result\n## Notes\ncache notes\n',
    'c.md': Array.from({ length: 6 }, (_, i) => `## Part ${i}\ncache part ${i}\n`).join(''),
  })
  const find = (...args) => tb(['find', ...args], { data, cwd: dir })
  const [a, b, c] = ['a.md', 'b.md', 'c.md'].map(f => join(dir, f))
  tb(['outline', c], { data, cwd: dir })
  const top = find('large placeholder', a, b).out.split('\n')
  assert.match(top[0], new RegExp(`^${esc(b)}#beta/placeholder {2}L2-3 {2}\\S+ {2}Placeholder$`))
  const page = find('cache', a, b).out.trimEnd().split('\n')
  assert.equal(page.length, 6)
  assert.ok(page.some(l => l.startsWith(`${c}#part-`)), 'an indexed file not named is searched')
  assert.equal(page[5], `more: 3 more → node ${TB} find "cache" --offset 5`)
  const rest = find('cache', '--offset', '5').out.trimEnd().split('\n')
  assert.deepEqual([rest.length, rest.at(-1)], [4, 'more: none'])
  assert.equal(new Set([...page, ...rest].filter(l => l.includes('#'))).size, 8)
  writeFileSync(b, '# Beta\nnew\nlines\n## Placeholder\na placeholder replaces a large tool result\n')
  assert.match(find('placeholder').out, new RegExp(`^${esc(b)}#beta/placeholder {2}L4-5 `))
})

test('purge: a stored output goes after 24 h, by the hourly auto-purge or by purge', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const now = Math.floor(Date.now() / 1000)
  const at = (h, ...args) => tb(args, { data, cwd: dir, env: { TB_NOW: String(now + h * 3600) } })
  const stored = text => walk(data).some(f => readFileSync(f, 'utf8') === text)
  tb(['put', '--source', 'Bash'], { input: LOG, data, cwd: dir })
  at(2, 'outline', 'guide.md')
  assert.ok(stored(LOG))
  at(25, 'outline', 'guide.md')
  assert.ok(!stored(LOG))
  const other = LOG.replace('ERROR', 'WARN')
  tb(['put', '--source', 'Bash'], { input: other, data, cwd: dir, env: { TB_NOW: String(now + 25.2 * 3600) } })
  at(25.5, 'outline', 'guide.md')
  assert.ok(stored(other), 'auto-purge runs at most once per hour')
  assert.equal(at(25.5, 'purge').code, 0)
  assert.ok(!stored(other))
})

test('stats: bytes in, bytes out and replacements per session and per project', () => {
  const { dir, data } = project({})
  const put = (input, session) => tb(['put', '--source', 'Bash', '--session', session], { input, data, cwd: dir }).out
  const log2 = LOG.replace('ERROR', 'WARN')
  const p1 = put(LOG, 's1')
  assert.equal(put('short\n', 's1'), '')
  const p2 = put(log2, 's2')
  const n = s => Buffer.byteLength(s)
  const out = tb(['stats'], { data, cwd: dir }).out
  const [i1, o1, i2, o2] = [n(LOG) + 6, n(p1) + 6, n(log2), n(p2)]
  assert.ok(out.includes(`project ${dir}  in ${i1 + i2} B  out ${o1 + o2} B  kept ${i1 + i2 - o1 - o2} B  replaced 2\n`), out)
  assert.ok(out.includes(`  session s1  in ${i1} B  out ${o1} B  kept ${i1 - o1} B  replaced 1\n`), out)
  assert.ok(out.includes(`  session s2  in ${i2} B  out ${o2} B  kept ${i2 - o2} B  replaced 1\n`), out)
})

test('concurrency: parallel put and find calls on a new index all succeed', async () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const run = (args, input) => new Promise(done => {
    const c = spawn(process.execPath, [TB, ...args], { cwd: dir, env: { ...process.env, TB_DATA_DIR: data } })
    let err = ''
    c.stderr.on('data', d => { err += d })
    c.on('close', code => done({ code, err }))
    c.stdin.end(input)
  })
  const calls = Array.from({ length: 12 }, (_, i) => i % 3 === 2
    ? run(['find', 'install', join(dir, 'guide.md')], '')
    : run(['put', '--source', 'Bash', '--session', `s${i}`], LOG.replace('ERROR', `ERROR ${i}`)))
  for (const r of await Promise.all(calls)) assert.equal(r.code, 0, r.err)
})

// Two calls racing to create the index: the WAL switch skips busy_timeout, so one
// round fails ~20% of the time. 30 fresh indexes make a missing retry fail almost surely.
test('concurrency: two parallel put calls on 30 fresh indexes all succeed', async () => {
  const run = (dir, data, i) => new Promise(done => {
    const c = spawn(process.execPath, [TB, 'put', '--source', 'Bash'], { cwd: dir, env: { ...process.env, TB_DATA_DIR: data } })
    let err = ''
    c.stderr.on('data', d => { err += d })
    c.on('close', code => done({ code, err }))
    c.stdin.end(LOG.replace('ERROR', `ERROR ${i}`))
  })
  for (let round = 0; round < 30; round++) {
    const { dir, data } = project({})
    for (const r of await Promise.all([run(dir, data, 0), run(dir, data, 1)])) assert.equal(r.code, 0, r.err)
  }
})

// Import hooks that make node:sqlite fail to load, or load without FTS5.
const FAKE_SQLITE = 'export class DatabaseSync { exec(sql) { if (/fts5/i.test(sql)) throw new Error("no such module: fts5") } }'
function hookFile(resolveBody) {
  const f = join(tmp(), 'hook.mjs')
  writeFileSync(f, `import { registerHooks } from 'node:module'
registerHooks({ resolve(s, c, next) { if (s === 'node:sqlite') { ${resolveBody} } return next(s, c) } })\n`)
  return ['--import', pathToFileURL(f).href]
}
const NO_SQLITE = hookFile("throw new Error('node:sqlite missing')")
const NO_FTS5 = hookFile(`return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(FAKE_SQLITE)}), format: 'module', shortCircuit: true }`)

test('missing node:sqlite or FTS5: non-zero exit, nothing on stdout', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  for (const node of [NO_SQLITE, NO_FTS5]) {
    for (const args of [['outline', 'guide.md'], ['put', '--source', 'Bash'], ['find', 'install']]) {
      const r = tb(args, { input: LOG, data, cwd: dir, node })
      assert.notEqual(r.code, 0, args.join(' '))
      assert.equal(r.out, '', args.join(' '))
      assert.match(r.err, /^tb: node:sqlite with FTS5 missing: (node:sqlite missing|no such module: fts5)\n$/, r.err)
    }
  }
})

test('doctor: ok on a good setup, one line per problem and non-zero exit otherwise', t => {
  const { dir, data } = project({})
  assert.deepEqual([tb(['doctor'], { data, cwd: dir }).out, tb(['doctor'], { data, cwd: dir }).code], ['ok\n', 0])
  const fts = tb(['doctor'], { data, cwd: dir, node: NO_FTS5 })
  assert.notEqual(fts.code, 0)
  assert.match(fts.out, /^node:sqlite with FTS5 missing: .*fts5.*\n$/)
  const locked = join(tmp(), 'ro')
  mkdirSync(locked)
  chmodSync(locked, 0o500)
  try {
    writeFileSync(join(locked, 'probe'), '')
    return t.skip('chmod cannot revoke write here (root or MSYS)')
  } catch {}
  const ro = tb(['doctor'], { data: locked, cwd: dir, node: NO_FTS5 })
  assert.notEqual(ro.code, 0)
  const lines = ro.out.trimEnd().split('\n')
  assert.equal(lines.length, 2, ro.out)
  assert.ok(lines.some(l => l.startsWith(`data dir ${locked} not writable`)), ro.out)
  chmodSync(locked, 0o700)
})

test('put --path: the placeholder is an outline of stdin, also when the file is gone', () => {
  const { dir, data } = project({})
  const path = join(dir, 'gone.md')
  const text = GUIDE + 'filler line\n'.repeat(400)
  const r = tb(['put', '--source', 'Read', '--path', path], { input: text, data, cwd: dir })
  assert.equal(r.code, 0, r.err)
  assert.ok(r.out.startsWith(`[tb] ${text.length} B, 411 lines → ${path}\n#guide  L1-411 `), r.out)
  assert.ok(r.out.includes('before Edit'))
})

test('purge leaves no copy of a stored output anywhere in the data dir, index included', () => {
  const { dir, data } = project({ 'guide.md': GUIDE })
  const now = Math.floor(Date.now() / 1000)
  const secret = LOG.replace('ERROR disk full on /var', 'TOKEN=sk-live-0123456789')
  const where = /→ (tb:[0-9a-f]{16})/.exec(tb(['put', '--source', 'Bash'], { input: secret, data, cwd: dir }).out)?.[1]
  assert.ok(where)
  for (const args of [['outline', where], ['get', `${where}:190-210`], ['find', 'TOKEN', where], ['find', 'install', 'guide.md']]) {
    tb(args, { data, cwd: dir })
  }
  tb(['purge'], { data, cwd: dir, env: { TB_NOW: String(now + 25 * 3600) } })
  const leaks = walk(data).filter(f => readFileSync(f).includes('sk-live-0123456789'))
  assert.deepEqual(leaks, [])
})
