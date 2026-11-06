#!/usr/bin/env node
// tb (token budget): section index and placeholders for large tool results
// (issue #46, docs/adr/0003-token-budget.md). The token-budget mod and agents
// call it through Bash; it is the only implementation of sectioning, so both
// see the same section ids. Plain text on stdout; exit 0 on success.
//
//   put --source <label> [--path <abs>] [--intent <text>] [--session <id>]  (content on stdin)
//   outline <path> · get <path>[#<id> | :<a>-<b>] · find "<query>" [paths…] [--offset N]
//   doctor · stats · purge
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

// Forward slashes: the printed command stays one shell word on Windows too.
const TB = fileURLToPath(import.meta.url).replace(/\\/g, '/')
// A non-markdown text is cut in windows this long: a screenful an agent can take whole.
const WINDOW = 40
// Head and tail a non-markdown placeholder keeps: how the output starts, how a log ends.
const HEAD = 40
const TAIL = 20
// Windows a placeholder adds for the intent: often the answer, few enough to stay small.
const HITS = 3
// A placeholder costs at most this share of the original, or the original is cheaper.
const GAIN = 0.5
// find hits per page: a few hundred bytes, the next page one call away.
const PAGE = 5
// Stored outputs live this long: tool output may hold secrets.
const RETAIN_MS = 24 * 3600_000
// The auto-purge scans at most this often, so most calls skip it.
const PURGE_EVERY_MS = 3600_000
// Waits on a parallel agent's write lock this long, inside the mod's 5 s budget.
const BUSY_MS = 3000

// Per-user, outside every repo. TB_DATA_DIR is a test seam, never a user setting.
const DATA = process.env.TB_DATA_DIR || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'flint-tb')
const OUT = join(DATA, 'out')
const STORED = /^tb:([0-9a-f]{16})$/
// TB_NOW (epoch seconds) is a test seam, never a user setting.
const now = () => process.env.TB_NOW ? Number(process.env.TB_NOW) * 1000 : Date.now()

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*\r?$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/

const bytes = s => Buffer.byteLength(s)
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16)
const size = n => n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}K`
const quote = s => `'${s.replace(/'/g, `'\\''`)}'`
const arg = s => /^[\w@%+=:,./-]+$/.test(s) ? s : quote(s)
const slug = t => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'

function splitLines(text) {
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

// ATX headings outside fenced code, as { line, level, title }.
function headings(lines) {
  const out = []
  let fence = null
  lines.forEach((line, i) => {
    const f = FENCE.exec(line)
    if (fence !== null) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null
      return
    }
    if (f) return void (fence = f[1])
    const h = HEADING.exec(line)
    if (h?.[2]) out.push({ line: i + 1, level: h[1].length, title: h[2] })
  })
  return out
}

// Sections of a text: markdown by heading path (a section holds its subsections),
// else WINDOW-line windows. `own` ends the section's own text, before its first subsection.
function sectionize(lines) {
  const heads = headings(lines)
  if (heads.length === 0) {
    const out = []
    for (let a = 1; a <= lines.length; a += WINDOW) {
      const b = Math.min(a + WINDOW - 1, lines.length)
      const first = lines.slice(a - 1, b).find(l => l.trim()) ?? ''
      out.push({ id: `w${(a - 1) / WINDOW + 1}`, a, b, own: b, title: first.trim().slice(0, 60) })
    }
    return out
  }
  const out = []
  const top = heads[0].line - 1
  if (lines.slice(0, top).some(l => l.trim())) out.push({ id: '_top', a: 1, b: top, own: top, title: '(before first heading)' })
  const stack = []
  const seen = new Map()
  heads.forEach((h, k) => {
    while (stack.length && stack.at(-1).level >= h.level) stack.pop()
    stack.push({ level: h.level, slug: slug(h.title) })
    let id = stack.map(s => s.slug).join('/')
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    if (n > 1) stack.at(-1).slug += `-${n}`, id += `-${n}`
    const next = heads.slice(k + 1).find(x => x.level <= h.level)
    out.push({ id, a: h.line, b: next ? next.line - 1 : lines.length, own: (heads[k + 1]?.line ?? lines.length + 1) - 1, title: h.title })
  })
  return out
}

const span = (lines, s) => lines.slice(s.a - 1, s.b).join('\n') + '\n'
const header = (text, lines, where) => `[tb] ${bytes(text)} B, ${lines.length} lines → ${where}`

// A stored output is not searchable: the index would keep it past purge.
function hint(where, getArg) {
  const get = `read one: node ${arg(TB)} get ${quote(where + getArg)}`
  return STORED.test(where) ? get
    : `${get} · search: node ${arg(TB)} find "<q>" ${arg(where)} · before Edit: Read the exact range with offset/limit`
}

// Windows outside head and tail that best match the intent (BM25 over this text
// alone, in memory), so the placeholder never depends on the shared index.
function hits(lines, windows, intent) {
  const words = intent?.match(/[\p{L}\p{N}_]+/gu)
  if (!words) return []
  const mem = new DatabaseSync(':memory:')
  mem.exec('CREATE VIRTUAL TABLE w USING fts5(body)')
  const add = mem.prepare('INSERT INTO w(rowid, body) VALUES (?, ?)')
  windows.forEach((w, i) => w.b > HEAD && w.a <= lines.length - TAIL && add.run(i, span(lines, w)))
  const match = mem.prepare(`SELECT rowid FROM w WHERE w MATCH ? ORDER BY rank, rowid LIMIT ${HITS}`)
  return match.all(words.map(t => `"${t}"`).join(' OR ')).map(r => windows[r.rowid])
}

function excerpt(text, where, intent) {
  const lines = splitLines(text)
  const show = new Set()
  const mark = (a, b) => { for (let i = a; i <= b; i++) show.add(i) }
  mark(1, Math.min(HEAD, lines.length))
  mark(Math.max(1, lines.length - TAIL + 1), lines.length)
  for (const w of hits(lines, sectionize(lines), intent)) mark(w.a, w.b)
  const out = [header(text, lines, where)]
  let prev = 0
  for (let i = 1; i <= lines.length; i++) {
    if (!show.has(i)) continue
    if (i > prev + 1) out.push(`[… L${prev + 1}-${i - 1} omitted]`)
    out.push(lines[i - 1])
    prev = i
  }
  return [...out, hint(where, ':<a>-<b>')].join('\n') + '\n'
}

function outline(text, where) {
  const lines = splitLines(text)
  const list = sectionize(lines)
  return [header(text, lines, where),
    ...list.map(s => `#${s.id}  L${s.a}-${s.b}  ${size(bytes(span(lines, s)))}  ${s.title}`),
    hint(where, '#<id>')].join('\n') + '\n'
}

class Fail extends Error {}

const resolveWhere = w => STORED.test(w) ? w : resolve(w)

function load(where) {
  const m = STORED.exec(where)
  return readFileSync(m ? join(OUT, `${m[1]}.txt`) : where, 'utf8')
}

// Keeps a replaced tool output; it may hold secrets, so owner-only.
function store(text) {
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
  writeFileSync(join(OUT, `${sha(text)}.txt`), text, { mode: 0o600 })
}

// The nearest directory above cwd that holds .git, else cwd: one index per project.
function projectRoot() {
  for (let d = process.cwd(); ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d
    if (dirname(d) === d) return process.cwd()
  }
}

// The project's shared index, made on first use. WAL: parallel agents read while one writes.
function openIndex() {
  const root = projectRoot()
  mkdirSync(join(DATA, 'db'), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(join(DATA, 'db', `${sha(root)}.db`))
  db.exec(`PRAGMA busy_timeout = ${BUSY_MS}`)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, mtime REAL NOT NULL, hash TEXT NOT NULL);
    CREATE VIRTUAL TABLE IF NOT EXISTS sections USING fts5(path UNINDEXED, hash UNINDEXED, id UNINDEXED,
      a UNINDEXED, b UNINDEXED, size UNINDEXED, title, body);
    CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stats(session TEXT PRIMARY KEY, bytes_in INTEGER NOT NULL,
      bytes_out INTEGER NOT NULL, replaced INTEGER NOT NULL);`)
  db.prepare('INSERT OR IGNORE INTO meta VALUES (?, ?)').run('root', root)
  return db
}

// Puts a file's sections in the index unless its mtime and hash are unchanged; returns its text.
// A stored output stays out: tool output may hold secrets, and purge deletes only files.
function index(db, where) {
  const text = load(where)
  if (STORED.test(where)) return text
  const mtime = statSync(where).mtimeMs
  const hash = sha(text)
  const row = db.prepare('SELECT mtime, hash FROM files WHERE path = ?').get(where)
  if (row?.mtime === mtime && row.hash === hash) return text
  const lines = splitLines(text)
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM sections WHERE path = ?').run(where)
    const add = db.prepare('INSERT INTO sections VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const s of sectionize(lines)) {
      add.run(where, hash, s.id, s.a, s.b, bytes(span(lines, s)), s.title, lines.slice(s.a - 1, s.own).join('\n'))
    }
    db.prepare('INSERT OR REPLACE INTO files VALUES (?, ?, ?)').run(where, mtime, hash)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return text
}

const forget = (db, where) => {
  db.prepare('DELETE FROM sections WHERE path = ?').run(where)
  db.prepare('DELETE FROM files WHERE path = ?').run(where)
}

// Re-indexes every indexed file whose mtime moved, drops the gone ones, then ranks sections.
function find(db, query, paths, offset) {
  for (const p of paths) index(db, resolveWhere(p))
  for (const { path, mtime } of db.prepare('SELECT path, mtime FROM files').all()) {
    const st = statSync(path, { throwIfNoEntry: false })
    if (st === undefined) forget(db, path)
    else if (st.mtimeMs !== mtime) index(db, path)
  }
  const words = query.match(/[\p{L}\p{N}_]+/gu)
  if (!words) throw new Fail('give a query with at least one word')
  const rows = db.prepare(`SELECT path, id, a, b, size, title FROM sections WHERE sections MATCH ?
    ORDER BY bm25(sections, 0, 0, 0, 0, 0, 0, 5, 1), path, a`).all(words.map(t => `"${t}"`).join(' OR '))
  const left = rows.length - offset - PAGE
  const q = /^[^"$`\\!]*$/.test(query) ? `"${query}"` : quote(query)
  return rows.slice(offset, offset + PAGE).map(r => `${r.path}#${r.id}  L${r.a}-${r.b}  ${size(r.size)}  ${r.title}\n`).join('')
    + (left > 0 ? `more: ${left} more → node ${arg(TB)} find ${q} --offset ${offset + PAGE}\n` : 'more: none\n')
}

// Deletes stored outputs past RETAIN_MS; unforced, at most once per PURGE_EVERY_MS
// (a stamp from a clock set ahead counts as stale).
function purge(force) {
  const stamp = join(DATA, 'purged')
  const last = existsSync(stamp) ? Number(readFileSync(stamp, 'utf8')) : 0
  const t = now()
  if (!force && last <= t && t - last < PURGE_EVERY_MS) return
  for (const f of existsSync(OUT) ? readdirSync(OUT) : []) {
    // A parallel purge may have taken it already: no entry reads as nothing to do.
    if ((statSync(join(OUT, f), { throwIfNoEntry: false })?.mtimeMs ?? t) < t - RETAIN_MS) rmSync(join(OUT, f), { force: true })
  }
  mkdirSync(DATA, { recursive: true, mode: 0o700 })
  writeFileSync(stamp, String(t))
}

const record = (db, session, bytesIn, bytesOut) => db.prepare(`INSERT INTO stats VALUES (?, ?, ?, ?)
  ON CONFLICT(session) DO UPDATE SET bytes_in = bytes_in + excluded.bytes_in,
  bytes_out = bytes_out + excluded.bytes_out, replaced = replaced + excluded.replaced`)
  .run(session, bytesIn, bytesOut, bytesIn === bytesOut ? 0 : 1)

// Bytes in, bytes out and replacements of put, per project index and per session.
function stats() {
  const dir = join(DATA, 'db')
  const line = (name, r) => `${name}  in ${r.i} B  out ${r.o} B  kept ${r.i - r.o} B  replaced ${r.n}\n`
  let out = ''
  for (const f of existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.db')).sort() : []) {
    const db = new DatabaseSync(join(dir, f), { readOnly: true })
    const rows = db.prepare('SELECT session, bytes_in i, bytes_out o, replaced n FROM stats ORDER BY session').all()
    if (rows.length === 0) continue
    const sum = rows.reduce((s, r) => ({ i: s.i + r.i, o: s.o + r.o, n: s.n + r.n }), { i: 0, o: 0, n: 0 })
    out += line(`project ${db.prepare("SELECT v FROM meta WHERE k = 'root'").get()?.v}`, sum)
      + rows.map(r => line(`  session ${r.session}`, r)).join('')
  }
  return out || 'no puts yet\n'
}

// The placeholder for a tool output: a pure function of its bytes, where and intent.
function put(text, opts) {
  const where = opts.path ? resolve(opts.path) : `tb:${sha(text)}`
  const ph = headings(splitLines(text)).length ? outline(text, where) : excerpt(text, where, opts.intent)
  return bytes(ph) <= bytes(text) * GAIN ? ph : ''
}

// Claude Code saves Bash output past this many chars to a file; flint's env sets 10000 (#47).
const BASH_WINDOW = Number(process.env.BASH_MAX_OUTPUT_LENGTH) || 10000

// `<where>#<id>`, `<where>:<a>-<b>` or all of `<where>` as the current lines,
// numbered. Pages below the Bash window: past it Claude Code saves the output to
// a file, and a Read of that file gets one more placeholder (#52).
function get(db, target) {
  const range = /^(.*):(\d+)-(\d+)$/.exec(target)
  const at = range ? -1 : target.lastIndexOf('#')
  const where = resolveWhere(range ? range[1] : at < 1 ? target : target.slice(0, at))
  const lines = splitLines(index(db, where))
  const s = range ? { a: +range[2], b: +range[3] } : at < 1 ? { a: 1, b: lines.length }
    : sectionize(lines).find(x => x.id === target.slice(at + 1))
  if (!s) throw new Fail(`no section ${target.slice(at + 1)}; list them: node ${arg(TB)} outline ${arg(where)}`)
  const more = n => `more: node ${arg(TB)} get ${quote(`${where}:${n}-${s.b}`)}\n`
  let out = ''
  for (let n = s.a; n <= Math.min(s.b, lines.length); n++) {
    const line = `${n}\t${lines[n - 1]}\n`
    if (out && out.length + line.length + more(n).length >= BASH_WINDOW) return out + more(n)
    out += line
  }
  return out
}

// node:sqlite with FTS5, or why not: every command but doctor needs both.
async function sqlite() {
  try {
    const mod = await import('node:sqlite')
    new mod.DatabaseSync(':memory:').exec('CREATE VIRTUAL TABLE probe USING fts5(x)')
    return { DatabaseSync: mod.DatabaseSync }
  } catch (err) {
    return { missing: `node:sqlite with FTS5 missing: ${err.message}` }
  }
}

// What the mod and silicon-valley check before they trust tb: each problem on its own line.
function doctor() {
  const fails = []
  if (Number(process.versions.node.split('.')[0]) < 26) fails.push(`node ${process.versions.node} is older than 26`)
  if (missing) fails.push(missing)
  try {
    mkdirSync(DATA, { recursive: true, mode: 0o700 })
    const probe = join(DATA, `.doctor-${process.pid}`)
    writeFileSync(probe, 'ok')
    rmSync(probe)
  } catch (err) {
    fails.push(`data dir ${DATA} not writable: ${err.message}`)
  }
  return fails.map(f => f.replace(/\s+/g, ' ')).join('\n') || 'ok'
}

const { DatabaseSync, missing } = await sqlite()
process.umask(0o077)
try {
  const { values: opts, positionals: [cmd, ...pos] } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(['source', 'path', 'intent', 'session', 'offset'].map(k => [k, { type: 'string' }])),
  })
  const commands = {
    put() {
      const text = readFileSync(0, 'utf8')
      const out = put(text, opts)
      if (out && !opts.path) store(text)
      const db = openIndex()
      // The placeholder outlines stdin; indexing the file only readies later calls.
      if (opts.path && existsSync(opts.path)) index(db, resolve(opts.path))
      record(db, opts.session ?? '-', bytes(text), out ? bytes(out) : bytes(text))
      return out
    },
    outline() {
      const where = resolveWhere(pos[0] ?? '')
      return outline(index(openIndex(), where), where)
    },
    get: () => get(openIndex(), pos[0] ?? ''),
    find: () => find(openIndex(), pos[0] ?? '', pos.slice(1), Number(opts.offset ?? 0)),
    stats,
    purge: () => (purge(true), ''),
  }
  if (cmd === 'doctor') {
    const report = doctor()
    process.stdout.write(report + '\n')
    if (report !== 'ok') process.exitCode = 1
  } else {
    if (missing) throw new Fail(missing)
    if (!Object.hasOwn(commands, cmd ?? '')) throw new Fail(`unknown command ${cmd ?? ''}`)
    if (cmd !== 'purge') purge(false)
    process.stdout.write(commands[cmd]())
  }
} catch (err) {
  process.stderr.write(`tb: ${err instanceof Fail ? err.message : err.stack}\n`)
  process.exitCode = err instanceof Fail ? 1 : 2
}
