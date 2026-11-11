// install-guard mod: a soft gate on Bash installs, in the main conversation and
// every subagent (docs/adr/0006-install-guard.md).
// - Asks only on clear "new stack" signals; on doubt the command runs. An ask is a deny
//   with a reason: the agent keeps working and asks the human in its reply.
//   - project dep or runner package absent from the manifests, command dir up to /;
//   - global whose install dir is missing;
//   - always: scaffolders, system and toolchain installs, piped install scripts.
// - Free: lockfile installs, updates, removals, scripts, local paths, an add or run of what exists.
// - Yes: after the human's yes, the agent reruns the segment prefixed with FLINT_INSTALL_OK=1.
// - No Bash, Edit or Read permission rules: one turns off
//   CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS (env.sh).
// - Fail-open: a hook that throws is skipped by the mods runtime (no .catch).
// shortcut: text classifier, not a shell parser; installs inside scripts, `bash -c` or `xargs` run ungated. Courtesy gate, not a security boundary.
// shortcut: `--filter` checks the cwd's manifests, not the filtered package's; read workspace packages when it asks too often.
import type { EngineInterface, On } from 'claude-code'

const APPROVAL = 'FLINT_INSTALL_OK=1'
const PIPED = 'a piped install script'
const HEREDOC = /(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/g
const PIPED_SCRIPT = [
  // `| python3 -m json.tool` reads data; `| python3`, `| python3 -` run a script.
  /\b(curl|wget)\b[^|;&]*\|\s*(sudo(\s+-\S+)*\s+)?((ba|z)?sh\b|python3?(?=\s*(-(\s|$)|$|[;&|)])))/,
  /\b(ba|z)?sh\s+(-c\s+["']?\$\(|<\()\s*(curl|wget)\b/,
]
// Hidden inside quotes and after a backslash, so the comment, redirect and split steps skip them.
const SPECIAL = ';&|\n#<> \t'
const COMMENT = /(^|[\s;&|])#.*$/gm
// `2>&1` and `>&2` have no target word; `> log`, `&> log`, `2>/dev/null`, `<<EOF` drop theirs.
const REDIRECT = /\d*[<>]+&(\d+|-)|(&>>?|\d*[<>]+)\s*[^\s<>;&|]*/g
const SEPARATOR = /&&|\|\||[;|&\n]/
const ASSIGNMENT = /^[A-Za-z_]\w*=/
const PREFIXES = new Set(['sudo', 'command', 'env', 'exec', 'time', 'nohup'])
// Prefix flags whose next word is their value: `sudo -u x`, `sudo -g x`, `env -u X`, `exec -a name`.
const PREFIX_VALUES = new Set(['-u', '-g', '-a', '-C', '-D'])
// npm, PyPI, crate or Go module shape, with version or extras; never a path, URL, `$VAR` or `file:` spec.
const PACKAGE = /^(@[\w.-]+\/)?[A-Za-z0-9][\w.~/-]*(\[[\w,.-]*\])?([@<>=!~].*)?$/
// Flags whose next word is their value, not a package.
const NODE_VALUES = new Set(['--filter', '-F', '--dir', '-C', '--prefix', '--registry'])
// npm only: pnpm's `-w` and `--workspace` take no value.
const NPM_VALUES = new Set([...NODE_VALUES, '-w', '--workspace'])
const PY_VALUES = new Set(['-r', '--requirement', '-c', '--constraint', '-e', '--editable', '-i', '--index-url', '--extra-index-url',
  '-f', '--find-links', '--group', '--extra', '--optional', '--package', '--from', '--with', '--python'])
const CARGO_VALUES = new Set(['-F', '--version', '--git', '--branch', '--tag', '--rev', '--path', '--root', '--bin', '--features'])
const VALUE_FLAGS = new Map<string, ReadonlySet<string>>([['npm', NPM_VALUES], ['pnpm', NODE_VALUES], ['yarn', NODE_VALUES],
  ['bun', NODE_VALUES], ['pip', PY_VALUES], ['pip3', PY_VALUES], ['uv', PY_VALUES], ['uvx', PY_VALUES], ['pipx', PY_VALUES],
  ['cargo', CARGO_VALUES]])
const NO_VALUES = new Set<string>()
const NODE_DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
const TEXT_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod']
// The official Astro update tool: runs free though no project lists it.
const ASTRO_UPGRADE = '@astrojs/upgrade'

type Where = { dir: string, home: string }
// What proves a name is not new: a project dep, a project runner, a global's install dir; `ask`: nothing.
type Kind = 'node' | 'node-runner' | 'text' | 'npm-global' | 'uv-tool' | 'pipx' | 'ask'
type Need = { kind: Kind, name: string }
type Parsed = { args: string[], opts: Map<string, string>, flags: Set<string> }

const denyNew = (what: string) => `Not run. New install: ${what}. The human approves new packages, tools and stacks; `
  + 'installs and updates of what exists run free. Keep working on the rest; in your reply ask the human for a yes. '
  + `After it, rerun with ${APPROVAL} at the start of the segment that ${what === PIPED ? 'fetches the script' : `installs ${what}`}.`

const isFlag = (w: string) => w.startsWith('-') && w !== '-'
const inDir = (dir: string, file: string) => `${dir === '/' ? '' : dir}/${file}`
// `@s/x@1` → `@s/x`, `httpx>=0.27` → `httpx`, `x[extra]` → `x`.
function nameOf(spec: string): string {
  const s = spec.split(/[<>=~!\[;\s]/, 1)[0]!
  return s.lastIndexOf('@') > 0 ? s.slice(0, s.lastIndexOf('@')) : s
}

function hide(c: string): string {
  const k = c === '' ? -1 : SPECIAL.indexOf(c)
  return k < 0 ? c : String.fromCharCode(0xe000 + k)
}
const unhide = (w: string) => w.replace(/[\ue000-\ue008]/g, c => SPECIAL[c.charCodeAt(0) - 0xe000]!)
const unquote = (w: string) => unhide(w).replace(/['"\\]/g, '')

function mask(text: string): string {
  let out = ''
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '\\' && quote !== "'") out += c + hide(text[++i] ?? '')
    else if (quote !== '' && c !== quote) out += hide(c)
    else {
      // outside quotes, or the closing quote
      quote = quote === '' && (c === "'" || c === '"') ? c : ''
      out += c
    }
  }
  return out
}

// Keeps each heredoc's command line, drops its body up to the line that holds only its word.
function dropHeredocs(command: string): string {
  const ends: string[] = []
  const kept: string[] = []
  for (const line of command.split('\n')) {
    if (ends.length > 0) {
      if (line.trim() === ends[0]) ends.shift()
      continue
    }
    kept.push(line)
    for (const m of line.matchAll(HEREDOC)) ends.push(m[2]!)
  }
  return kept.join('\n')
}

// A piped script is approved only by the prefix on its own segment.
function pipedScript(text: string): boolean {
  for (const r of PIPED_SCRIPT) {
    const m = r.exec(text)
    if (m === null) continue
    const lead = text.slice(0, m.index).split(/[;&|\n]/).at(-1)!.trim().split(/\s+/)
    if (!lead.includes(APPROVAL)) return true
  }
  return false
}

// Shifts assignments, prefixes and their flags; true when one is the approval.
function shiftPrefixes(words: string[]): boolean {
  let approved = false
  while (words[0] !== undefined && (ASSIGNMENT.test(words[0]) || PREFIXES.has(words[0]) || isFlag(words[0]))) {
    const w = words.shift()!
    if (PREFIX_VALUES.has(w)) words.shift()
    if (w === APPROVAL) approved = true
  }
  return approved
}

function parse(words: string[], values: ReadonlySet<string>): Parsed {
  const p: Parsed = { args: [], opts: new Map(), flags: new Set() }
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!
    const eq = w.indexOf('=')
    if (!isFlag(w)) p.args.push(w)
    else if (eq > 0) p.opts.set(w.slice(0, eq), w.slice(eq + 1))
    else if (values.has(w) && i + 1 < words.length) p.opts.set(w, words[++i]!)
    else p.flags.add(w)
  }
  return p
}

// One need per package-shaped spec: local paths, URLs and variables are the project's own.
const toNeeds = (kind: Kind, specs: readonly string[]): Need[] => specs.filter(s => PACKAGE.test(s)).map(s => ({ kind, name: nameOf(s) }))

// A runner's package: `create-*` scaffolds a new stack, so it always asks; the Astro upgrade runs free.
function runner(kind: 'node-runner' | 'text', spec: string | undefined): Need[] {
  const [need] = toNeeds(kind, spec === undefined ? [] : [spec])
  if (need === undefined || need.name === ASTRO_UPGRADE) return []
  return [need.name.startsWith('create-') ? { kind: 'ask', name: need.name } : need]
}

// A system or toolchain install always asks: named by its first package, its `--git` source, or itself.
function alwaysAsk(label: string, args: string[], git?: string): Need[] {
  const pkg = args.find(a => PACKAGE.test(a))
  const name = pkg === undefined ? git ?? (args.length === 0 ? label : undefined) : nameOf(pkg)
  return name === undefined ? [] : [{ kind: 'ask', name }]
}

// What `npm init x` runs: `x` → `create-x`, `@s/x` → `@s/create-x`, `@s` → `@s/create`.
function scaffolder(spec: string): Need[] {
  if (!PACKAGE.test(spec.replace(/^@/, ''))) return []  // a bare `@s` is a scope, not a package
  const [scope = '', pkg] = nameOf(spec).split('/')
  const name = !scope.startsWith('@') ? `create-${scope}` : pkg === undefined ? `${scope}/create` : `${scope}/create-${pkg}`
  return [{ kind: 'ask', name }]
}

// `astro add react` installs `@astrojs/react`; a scoped or pathed name installs itself.
function astroAdd(args: string[]): Need[] | undefined {
  if (args[0] !== 'astro' || args[1] !== 'add') return undefined
  return toNeeds('node', args.slice(2).map(x => (x.includes('/') ? x : `@astrojs/${x}`)))
}

function nodeNeeds(cmd: string, verb: string, args: string[], p: Parsed): Need[] {
  const runs = verb === 'dlx' || (cmd === 'npm' && verb === 'exec') || ((cmd === 'npm' || cmd === 'bun') && verb === 'x')
  const astro = astroAdd(runs ? args : p.args)
  if (astro !== undefined) return astro
  if (runs) return runner('node-runner', args[0])
  if (verb === 'create' || (cmd === 'npm' && verb === 'init')) return args[0] === undefined ? [] : scaffolder(args[0])
  if (cmd === 'yarn' && verb === 'global') return args[0] === 'add' ? toNeeds('npm-global', args.slice(1)) : []
  if (verb !== 'add' && verb !== 'install' && verb !== 'i') return []
  return toNeeds(p.flags.has('-g') || p.flags.has('--global') ? 'npm-global' : 'node', args)
}

function uvNeeds(verb: string, args: string[], p: Parsed): Need[] {
  if (verb === 'add') return toNeeds('text', args)
  if (verb === 'pip') return args[0] === 'install' ? toNeeds('text', args.slice(1)) : []
  if (verb !== 'tool') return []
  if (args[0] === 'install') return toNeeds('uv-tool', args.slice(1))
  return args[0] === 'run' ? runner('text', p.opts.get('--from') ?? args[1]) : []
}

function rustupNeeds(verb: string, args: string[]): Need[] {
  if (verb === 'install') return alwaysAsk('rustup install', args)
  const [sub = '', ...rest] = args
  const adds = (verb === 'toolchain' && sub === 'install') || ((verb === 'target' || verb === 'component') && sub === 'add')
  return adds ? alwaysAsk(`rustup ${verb} ${sub}`, rest) : []
}

// The installs a segment asks for, and the dir a -C, --dir or --prefix moves it to.
function classify(words: string[]): { needs: Need[], dir?: string } {
  let [cmd = '', ...rest] = words
  if ((cmd === 'python' || cmd === 'python3') && rest[0] === '-m' && rest[1] === 'pip') [cmd = '', ...rest] = rest.slice(1)
  const p = parse(rest, VALUE_FLAGS.get(cmd) ?? NO_VALUES)
  const [verb = '', ...args] = p.args
  switch (cmd) {
    case 'npm': case 'pnpm': case 'yarn': case 'bun':
      return { needs: nodeNeeds(cmd, verb, args, p), dir: p.opts.get('-C') ?? p.opts.get('--dir') ?? p.opts.get('--prefix') }
    case 'npx': case 'bunx': return { needs: astroAdd(p.args) ?? runner('node-runner', verb) }
    case 'pip': case 'pip3': return { needs: verb === 'install' ? toNeeds('text', args) : [] }
    case 'uv': return { needs: uvNeeds(verb, args, p) }
    case 'uvx': return { needs: runner('text', p.opts.get('--from') ?? verb) }
    case 'pipx': return { needs: verb === 'install' ? toNeeds('pipx', args) : verb === 'run' ? runner('text', args[0]) : [] }
    case 'cargo': return { needs: verb === 'add' ? toNeeds('text', args) : verb === 'install' ? alwaysAsk('cargo install', args, p.opts.get('--git')) : [] }
    case 'go': return { needs: verb === 'get' ? toNeeds('text', args) : verb === 'install' ? alwaysAsk('go install', args) : [] }
    case 'rustup': return { needs: rustupNeeds(verb, args) }
    case 'brew': case 'apt': case 'apt-get': case 'nvm': return { needs: verb === 'install' ? alwaysAsk(`${cmd} install`, args) : [] }
    default: return { needs: [] }
  }
}

function lineage(dir: string): string[] {
  const out = [dir]
  while (out.at(-1) !== '/') out.push(out.at(-1)!.replace(/\/[^/]*$/, '') || '/')
  return out
}

function resolve(base: string, path: string, home: string): string {
  const abs = path.startsWith('~') ? home + path.slice(1) : path.startsWith('/') ? path : `${base}/${path}`
  const parts: string[] = []
  for (const p of abs.split('/')) {
    if (p === '..') parts.pop()
    else if (p !== '' && p !== '.') parts.push(p)
  }
  return `/${parts.join('/')}`
}

async function readIfExists($: EngineInterface, path: string): Promise<string | undefined> {
  return (await $.fs.exists(path)) ? $.fs.read(path) : undefined
}

// A malformed package.json counts as none: the gate asks rather than crash open.
async function nodeDeps($: EngineInterface, { dir }: Where): Promise<Set<string>> {
  const deps = new Set<string>()
  for (const d of lineage(dir)) {
    const text = await readIfExists($, inDir(d, 'package.json'))
    let pkg: Partial<Record<typeof NODE_DEP_KEYS[number], Record<string, string>>> = {}
    try {
      pkg = JSON.parse(text ?? '{}')
    } catch {
      // malformed: no deps from this file
    }
    for (const key of NODE_DEP_KEYS) for (const name of Object.keys(pkg[key] ?? {})) deps.add(name)
  }
  return deps
}

// A word match in any text manifest: `httpx` in pyproject.toml, `serde` in Cargo.toml, a module in go.mod.
// `-`, `_` and `.` match each other, as in PyPI names: `typing_extensions` is `typing-extensions`.
async function declares($: EngineInterface, { dir }: Where, name: string): Promise<boolean> {
  const body = name.toLowerCase().split(/[-_.]+/).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[-_.]+')
  const word = new RegExp(`(^|[^a-z0-9_.-])${body}([^a-z0-9_.-]|$)`, 'm')
  for (const d of lineage(dir)) {
    for (const f of TEXT_MANIFESTS) {
      const text = await readIfExists($, inDir(d, f))
      if (text !== undefined && word.test(text.toLowerCase())) return true
    }
  }
  return false
}

async function someExists($: EngineInterface, paths: readonly string[]): Promise<boolean> {
  for (const p of paths) if (await $.fs.exists(p)) return true
  return false
}

// $ is spelled at each call: the mods runtime refuses $ inside a map of functions.
async function exists($: EngineInterface, w: Where, { kind, name }: Need): Promise<boolean> {
  switch (kind) {
    case 'node': return (await nodeDeps($, w)).has(name)
    // npx and dlx run a project bin without a download: `tsc` of typescript, `vitest`.
    case 'node-runner': return (await nodeDeps($, w)).has(name) || someExists($, lineage(w.dir).map(d => inDir(d, `node_modules/.bin/${name}`)))
    case 'text': return declares($, w, name)
    case 'npm-global': return $.fs.exists(`${(await $.env.get('NPM_CONFIG_PREFIX')) ?? `${w.home}/.npm-global`}/lib/node_modules/${name}`)
    case 'uv-tool': return $.fs.exists(`${w.home}/.local/share/uv/tools/${name.toLowerCase()}`)
    case 'pipx': return $.fs.exists(`${w.home}/.local/pipx/venvs/${name.toLowerCase()}`)
    case 'ask': return false
  }
}

async function firstNew($: EngineInterface, command: string): Promise<string | undefined> {
  const text = dropHeredocs(command)
  if (pipedScript(text)) return PIPED
  const home = (await $.env.get('HOME')) ?? '/'
  let dir = await $.session.cwd()
  const plain = mask(text).replace(COMMENT, '$1').replace(REDIRECT, ' ')
  for (const segment of plain.split(SEPARATOR)) {
    const words = segment.split(/\s+/).filter(Boolean).map(unquote)
    const approved = shiftPrefixes(words)
    if (words[0] === 'cd') {
      dir = resolve(dir, words[1] ?? home, home)
      continue
    }
    if (approved) continue
    const install = classify(words)
    const where: Where = { dir: install.dir === undefined ? dir : resolve(dir, install.dir, home), home }
    for (const need of install.needs) if (!(await exists($, where, need))) return need.name
  }
  return undefined
}

export function register(on: On) {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const what = await firstNew($, e.command)
    return what === undefined ? next(e) : { deny: denyNew(what) }
  })
}
