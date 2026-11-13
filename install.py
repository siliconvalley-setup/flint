#!/usr/bin/env python3
"""Apply flint to Claude Code's config dir (idempotent).

Run from the clone. Everything points at this clone, so an edit to a skill,
agent, rule or output style takes effect at once; settings.json, its defaults
file, env.sh and external-{skills,plugins}.txt take effect on the next run,
which also pulls each external source. Updating = `git pull` + re-run.

    install.py               install (or re-point after a clone move)
    install.py --uninstall   remove exactly what flint added (installed
                             plugins stay), nothing else

Config dir: $CLAUDE_CONFIG_DIR, default ~/.claude. What flint wrote is kept in
<config dir>/.flint-state.json: the next run prunes what flint no longer ships,
and --uninstall removes exactly that. Windows: style hooks only.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

if sys.version_info < (3, 7):
    sys.exit('flint install: needs Python 3.7+')

EVENTS = ('SessionStart', 'SubagentStart', 'UserPromptSubmit')
ROOT = Path(__file__).resolve().parent
HOOK = ROOT / 'hooks' / 'flint-style.sh'
# Identifies a flint entry in any clone location — old paths (a moved clone,
# a vmCODE-era registration) match too and get re-pointed on install.
MARKER = 'flint-style.sh'


FULL_CONFIG = os.name != 'nt'   # Windows: style hooks only, no links (README)


def config_dir():
    return Path(os.environ.get('CLAUDE_CONFIG_DIR') or str(Path.home() / '.claude'))


def settings_path():
    return config_dir() / 'settings.json'


def state_path():
    return config_dir() / '.flint-state.json'


def warn(msg):
    print('flint: WARN: {}'.format(msg), file=sys.stderr)


# ── Links: ~/.claude/<kind>/<name> -> this clone ──────────────────────────────
def link_sources(root=ROOT):
    """(kind, name, source) for every file-shaped item flint ships: each skill
    dir (has SKILL.md), each agent/rule/output-style .md."""
    out = []
    skills = root / 'skills'
    if skills.is_dir():
        out += [('skills', d.name, d) for d in sorted(skills.iterdir())
                if (d / 'SKILL.md').is_file()]
    local = {name for _, name, _ in out}
    for d in external_skills(root / '.cache'):
        if d.name in local:
            warn('external skill {} shadowed by the local one'.format(d.name))
        else:
            out.append(('skills', d.name, d))
            local.add(d.name)
    for kind in ('agents', 'rules', 'output-styles'):
        src = root / kind
        if src.is_dir():
            out += [(kind, f.name, f) for f in sorted(src.glob('*.md'))]
    return out


# ── External skills: fetched into .cache/, linked like local ones ─────────────
CACHE = ROOT / '.cache'


def external_specs(root=ROOT):
    """(kind, ref, cache dir) per line of external-skills.txt."""
    out = []
    try:
        text = (root / 'external-skills.txt').read_text(encoding='utf-8')
    except OSError:
        return out
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0] in ('git', 'npm') and not line.startswith('#'):
            out.append((parts[0], parts[1],
                        root / '.cache' / parts[0] / parts[1].rsplit('/', 1)[-1]))
    return out


def fetch_external(specs):
    """git clone/pull or npm pack each source into its cache dir. A failure keeps
    the previous copy and warns. FLINT_OFFLINE=1 skips the network."""
    if os.environ.get('FLINT_OFFLINE'):
        return
    for kind, ref, dst in specs:
        try:
            if kind == 'git':
                if (dst / '.git').is_dir():
                    cmd = ['git', '-C', str(dst), 'pull', '--ff-only', '-q']
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    cmd = ['git', 'clone', '-q', '--depth', '1',
                           'https://github.com/{}.git'.format(ref), str(dst)]
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                if r.returncode != 0:
                    raise OSError(r.stderr.strip()[:200])
            else:
                _npm_unpack(ref, dst)
        except (OSError, subprocess.SubprocessError, tarfile.TarError) as e:
            warn('could not fetch {} {} ({}); kept the cached copy'.format(kind, ref, e))


def _npm_unpack(package, dst):
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run(['npm', 'pack', '--silent', '--pack-destination', tmp, package],
                           capture_output=True, text=True, timeout=300)
        tarballs = list(Path(tmp).glob('*.tgz'))
        if r.returncode != 0 or not tarballs:
            raise OSError(r.stderr.strip()[:200] or 'npm pack produced nothing')
        new = Path(tmp) / 'unpacked'
        with tarfile.open(str(tarballs[0])) as tar:
            members = [m for m in tar.getmembers()
                       if m.isfile() or m.isdir()]           # no links/devices
            for m in members:
                if m.name.startswith('/') or '..' in Path(m.name).parts:
                    raise OSError('unsafe path in tarball: {}'.format(m.name))
            tar.extractall(str(new), members=members)
        if dst.exists():
            shutil.rmtree(str(dst))
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(new), str(dst))


def external_skills(cache=CACHE):
    """Skill dirs found in the cache: git/<repo>/skills/<name>/ and
    npm/<pkg>/package/skills/<name>/."""
    found = sorted(cache.glob('git/*/skills/*/SKILL.md')) + \
        sorted(cache.glob('npm/*/package/skills/*/SKILL.md'))
    return [f.parent for f in found]


# ── External plugins: fetched into .cache/plugins/, loaded in place ───────────
# No plugin cache copy, so the manifest version never pins an old copy.
def plugin_specs(root=ROOT):
    """(ref, clone, plugin dir, target) per line `git <owner/repo>[:<subdir>]
    <target>` of external-plugins.txt; target = `global` or an absolute
    project path."""
    out = []
    try:
        text = (root / 'external-plugins.txt').read_text(encoding='utf-8')
    except OSError:
        return out
    for line in text.splitlines():
        parts = line.strip().split(None, 2)
        if not parts or parts[0].startswith('#'):
            continue
        ref, _, sub = parts[1].partition(':') if len(parts) == 3 else ('', '', '')
        if parts[0] != 'git' or '/' not in ref or \
                not (parts[2] == 'global' or os.path.isabs(parts[2])):
            warn('external-plugins.txt: bad line {!r}; skipped'.format(line))
            continue
        clone = root / '.cache' / 'plugins' / ref.rsplit('/', 1)[-1]
        out.append((ref, clone, clone / sub, parts[2]))
    return out


def place_plugins(specs):
    """Returns (global plugin dirs, [(project link, plugin dir)], warnings).
    A line with no manifest or no project dir is skipped with a warning:
    flint never creates a project."""
    dirs, links, skipped = [], [], []
    for ref, clone, plugin, target in specs:
        if not _is_plugin(plugin):
            skipped.append('{}: no .claude-plugin/plugin.json in {}; skipped'.format(ref, plugin))
        elif target == 'global':
            dirs.append(plugin.as_posix())
        elif not Path(target).is_dir():
            skipped.append('{}: target {} is not a dir; skipped'.format(ref, target))
        else:
            links.append((Path(target) / '.claude' / 'skills' / clone.name, plugin))
    return dirs, links, skipped


def _points_at(link, target):
    return link.is_symlink() and os.readlink(str(link)) == str(target)


def apply_links(pairs, owned):
    """Create/re-point each link. `owned` = {link: target} from the last run:
    a link still pointing there is flint's (a moved clone re-points). A real
    file, or a link the user re-pointed, is theirs: warn and leave it.
    Returns {link: target} now owned."""
    now = {}
    for dst, src in pairs:
        if not _points_at(dst, src):
            if dst.is_symlink() or dst.exists():
                if not _points_at(dst, owned.get(str(dst))):
                    warn('{} exists and is not flint\'s; left as is'.format(dst))
                    continue
                dst.unlink()
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.symlink_to(src)
        now[str(dst)] = str(src)
    return now


def remove_links(links):
    """Unlink each {link: target} that still points at its target."""
    for link, target in links.items():
        if _points_at(Path(link), target):
            Path(link).unlink()


# ── Settings: forced policy + defaults ─────────────────────────────────────────
# settings.json          forced: each top-level key is flint's. A dict value
#                        merges per sub-key (flint's sub-keys win, the user's
#                        other sub-keys stay: permissions.allow, a hand-added
#                        enabledPlugins entry); any other value is replaced.
# settings.defaults.json set only where absent, so a /model pick or a custom
#                        statusLine survives; enabledPlugins per entry, so a
#                        plugin the user disabled stays disabled.
# "${FLINT}" in any string = this clone's path.
def _subst(value, root=ROOT):
    if isinstance(value, str):
        return value.replace('${FLINT}', root.as_posix())
    if isinstance(value, list):
        return [_subst(v, root) for v in value]
    if isinstance(value, dict):
        return {k: _subst(v, root) for k, v in value.items()}
    return value


def read_json(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except OSError:
        return {}
    except ValueError as e:
        sys.exit('flint install: {} is not valid JSON ({})'.format(path, e))
    return {k: _subst(v) for k, v in data.items()} if isinstance(data, dict) else {}


def _leaves(value):
    """Sub-keys flint owns in a value: a dict's keys, or None (the whole value)."""
    return sorted(value) if isinstance(value, dict) else None


def apply_forced(cfg, forced, prev):
    """Write the forced keys; drop what the previous run forced and flint no
    longer ships. Returns the state record {key: sub-keys | None}."""
    for key, subs in prev.items():
        if key not in forced:
            if subs is None:
                cfg.pop(key, None)
            elif isinstance(cfg.get(key), dict):
                for sub in subs:
                    cfg[key].pop(sub, None)
        elif subs is not None and isinstance(cfg.get(key), dict):
            for sub in subs:
                if not isinstance(forced[key], dict) or sub not in forced[key]:
                    cfg[key].pop(sub, None)
    for key, value in forced.items():
        if isinstance(value, dict) and isinstance(cfg.get(key), dict):
            cfg[key].update(value)
        else:
            cfg[key] = value
    return {key: _leaves(value) for key, value in forced.items()}


PER_ENTRY = ('enabledPlugins',)   # default maps owned entry by entry


def apply_defaults(cfg, defaults, prev):
    """Set each default where absent. Returns {path: value} for the values
    flint set (path = key or key/sub-key), so a later run or --uninstall
    removes a default only while it still holds flint's value."""
    owned = {}
    for path, value in prev.items():     # drop defaults flint no longer ships
        key, _, sub = path.partition('/')
        shipped = defaults.get(key)
        per_entry = key in PER_ENTRY and isinstance(shipped, dict)
        if key in defaults and (sub in shipped if sub and per_entry else not sub and not per_entry):
            continue
        _pop_if(cfg, key, sub, value)
    for key, value in defaults.items():
        if key in PER_ENTRY and isinstance(value, dict) and \
                (key not in cfg or isinstance(cfg[key], dict)):
            cfg.setdefault(key, {})    # a dict default is owned per sub-key, always
            for sub, v in value.items():
                path = '{}/{}'.format(key, sub)
                if sub not in cfg[key] or (path in prev and cfg[key][sub] == prev[path]):
                    cfg[key][sub] = v
                    owned[path] = v
        elif key not in cfg or (key in prev and cfg[key] == prev[key]):
            cfg[key] = value
            owned[key] = value
    return owned


def _pop_if(cfg, key, sub, value):
    if sub:
        if isinstance(cfg.get(key), dict) and cfg[key].get(sub) == value:
            del cfg[key][sub]
            if not cfg[key]:
                del cfg[key]
    elif cfg.get(key) == value:
        del cfg[key]


def remove_settings(cfg, state):
    apply_forced(cfg, {}, state.get('forced', {}))
    for path, value in state.get('defaults', {}).items():
        key, _, sub = path.partition('/')
        _pop_if(cfg, key, sub, value)
    for key in [k for k, v in cfg.items() if v == {} and k in state.get('forced', {})]:
        del cfg[key]


# ── env.sh + mods ─────────────────────────────────────────────────────────────
ENV_LINE = re.compile(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)')


def read_env(path):
    """{KEY: value} from `export KEY=value` lines; quotes around the value are
    dropped. Missing file -> {}."""
    env = {}
    try:
        text = path.read_text(encoding='utf-8')
    except OSError:
        return env
    for raw in text.splitlines():
        line = raw.strip()
        m = ENV_LINE.match(line) if line and not line.startswith('#') else None
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"\'')
    return env


PLUGIN_DIRS = 'CLAUDE_CODE_PLUGIN_DIRS'


def _is_plugin(d):
    return (d / '.claude-plugin' / 'plugin.json').is_file()


def mod_dirs(root=ROOT):
    mods = root / 'mods'
    return [d.as_posix() for d in sorted(mods.iterdir()) if _is_plugin(d)] if mods.is_dir() else []


def apply_plugin_dirs(cfg, dirs, prev):
    """Merge flint's mod and global plugin dirs into the `:` list of CLAUDE_CODE_PLUGIN_DIRS:
    the user's entries stay, a dir flint stopped shipping leaves."""
    env = cfg.setdefault('env', {})
    keep = [d for d in env.get(PLUGIN_DIRS, '').split(':') if d and d not in prev]
    merged = keep + [d for d in dirs if d not in keep]
    if merged:
        env[PLUGIN_DIRS] = ':'.join(merged)
    else:
        env.pop(PLUGIN_DIRS, None)
    return dirs


# ── Plugins ───────────────────────────────────────────────────────────────────
# The machine provides each plugin's binary; flint only warns when it is absent.
PLUGIN_BINARIES = {
    'typescript-lsp@claude-plugins-official': 'typescript-language-server',
    'pyright-lsp@claude-plugins-official': 'pyright',
    'ai-memory@ai-memory': 'ai-memory',
}
AI_MEMORY = 'ai-memory@ai-memory'
TOKENECONOMIZER = 'microsoft/TokenEconomizer'   # its external-plugins.txt ref
CLAUDE_TIMEOUT = 600


def claude_bin():
    return os.environ.get('FLINT_CLAUDE_BIN') or shutil.which('claude')


def _claude(claude, *args):
    try:
        return subprocess.run([claude, *args], capture_output=True, text=True,
                              timeout=CLAUDE_TIMEOUT)
    except (OSError, subprocess.TimeoutExpired) as e:
        return subprocess.CompletedProcess(args, 1, '', str(e))


def _claude_json(claude, *args):
    try:
        data = json.loads(_claude(claude, *args).stdout)
    except ValueError:
        return []
    return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else []


def _version(text):
    m = re.search(r'\d+(?:\.\d+)+', text or '')
    return tuple(int(x) for x in m.group(0).split('.')) if m else None


def _python3_version():
    py = shutil.which('python3')
    if not py:
        return None
    try:
        r = subprocess.run([py, '--version'], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return _version(r.stdout + r.stderr)


def _github_repo(markets, mkt):
    conf = markets.get(mkt) if isinstance(markets, dict) else None
    src = conf.get('source') if isinstance(conf, dict) else None
    if isinstance(src, dict) and src.get('source') == 'github' and src.get('repo'):
        return src['repo']
    return None


def apply_plugins(cfg, catalog):
    """Install each flint plugin the config leaves enabled and is missing.
    ai-memory is also updated while it is older than the machine's binary
    (the plugin must not run ahead of the server client). Needs `claude`:
    missing -> warn, the next run retries. Returns the plugins installed."""
    wanted = [p for p in catalog if cfg.get('enabledPlugins', {}).get(p) is True]
    for plugin in wanted:
        binary = PLUGIN_BINARIES.get(plugin)
        if binary and not shutil.which(binary):
            warn('{} needs `{}` on PATH; install it on this machine'.format(plugin, binary))
    if not wanted:
        return []
    claude = claude_bin()
    if not claude or not os.access(claude, os.X_OK):
        warn('claude not found on PATH; plugins not installed ({}). '
             'Re-run after installing Claude Code.'.format(', '.join(wanted)))
        return []
    installed = {p.get('id'): p.get('version') for p in
                 _claude_json(claude, 'plugin', 'list', '--json')}
    known = {m.get('name') for m in _claude_json(claude, 'plugin', 'marketplace', 'list', '--json')}
    steps = []
    for plugin in wanted:
        mkt = plugin.split('@', 1)[-1]
        repo = _github_repo(cfg.get('extraKnownMarketplaces'), mkt)
        if plugin in installed:
            if plugin == AI_MEMORY and _ai_memory_behind(installed[plugin]):
                steps.append([['plugin', 'marketplace', 'update', mkt],
                              ['plugin', 'update', plugin]])
            continue
        group = []
        if mkt not in known and repo:
            # HTTPS: owner/repo makes the CLI clone over SSH (needs known_hosts).
            group.append(['plugin', 'marketplace', 'add', 'https://github.com/{}'.format(repo)])
            known.add(mkt)
        group.append(['plugin', 'install', plugin])
        steps.append(group)
    return [group[-1][-1] for group in steps if _run(claude, group)]


def _run(claude, group):
    for step in group:
        r = _claude(claude, *step)
        if r.returncode != 0:
            warn('claude {} failed ({}); the next run retries'
                 .format(' '.join(step), (r.stderr or '').strip()[:200]))
            return False
    return True


def _ai_memory_behind(plugin_version):
    binary = shutil.which('ai-memory')
    if not binary:
        return False
    try:
        out = subprocess.run([binary, '--version'], capture_output=True, text=True,
                             timeout=30).stdout
    except (OSError, subprocess.TimeoutExpired):
        return False
    have, want = _version(plugin_version), _version(out)
    return bool(have and want and have < want)


# ── ai-memory credential ──────────────────────────────────────────────────────
# `ai-memory hook` (the plugin's) reads its bearer only from
# <data dir>/auth-token; 3.2.2-3.3.1 ignore AI_MEMORY_AUTH_TOKEN. A link to the
# machine's secret file keeps one source. Drop once upstream reads the env var.
def _ai_memory_paths():
    home = Path(os.environ.get('HOME') or str(Path.home()))
    # data dir as the binary resolves it: AI_MEMORY_DATA_DIR, else
    # Rust dirs::data_local_dir() + /ai-memory (XDG_DATA_HOME only if absolute)
    xdg = os.environ.get('XDG_DATA_HOME', '')
    if os.environ.get('AI_MEMORY_DATA_DIR'):
        data = Path(os.environ['AI_MEMORY_DATA_DIR'])
    elif sys.platform == 'darwin':
        data = home / 'Library' / 'Application Support' / 'ai-memory'
    else:
        data = (Path(xdg) if os.path.isabs(xdg) else home / '.local' / 'share') / 'ai-memory'
    return (data / 'auth-token', home / '.config' / 'ai-memory-auth-token')


def link_ai_memory_token(owned, remove=False):
    """Create the link where nothing is. `owned` = path of the link flint made
    (state file); only that link is re-checked, moved or removed. Returns the
    path flint owns now, or False."""
    link, secret = _ai_memory_paths()
    if owned is True:  # older state: flint's link at the old fixed path
        owned = str(Path(os.environ.get('HOME') or str(Path.home()))
                    / '.local' / 'share' / 'ai-memory' / 'auth-token')
    if owned and _points_at(Path(owned), secret):
        if not remove and secret.is_file() and Path(owned) == link:
            return owned
        Path(owned).unlink()
    if remove or not secret.is_file() or link.exists() or link.is_symlink():
        return False
    link.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    link.symlink_to(secret)
    return str(link)


# ── Plugin cache: one version per flint plugin ────────────────────────────────
# Claude Code loads skills and tools from EVERY cached version, and `plugin
# install`/`update` leave the old dir behind. For flint's own plugins only,
# keep the dir installed_plugins.json names and drop the others. No record ->
# nothing is deleted (never guess which version is live).
def _plugin_records():
    """installed_plugins.json `plugins`: id -> list of install records."""
    try:
        data = json.loads((config_dir() / 'plugins' / 'installed_plugins.json')
                          .read_text(encoding='utf-8'))['plugins']
    except (OSError, ValueError, KeyError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def dedupe_plugin_cache(catalog):
    root = config_dir() / 'plugins'
    records = _plugin_records()
    for plugin in catalog:
        entries = records.get(plugin)
        live = {Path(e['installPath']).resolve() for e in entries or []
                if isinstance(e, dict) and isinstance(e.get('installPath'), str)}
        name, _, mkt = plugin.partition('@')
        cache = root / 'cache' / mkt / name
        if not live or not cache.is_dir():
            continue
        try:
            versions = [v for v in cache.iterdir() if v.is_dir() and not v.name.startswith('.')]
            if not any(v.resolve() in live for v in versions):
                continue
            for old in versions:
                if old.resolve() not in live:
                    shutil.rmtree(str(old))
        except OSError as e:
            warn('plugin cache {}: {}'.format(cache, e))


def load_state():
    try:
        data = json.loads(state_path().read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def hook_specs(hook=HOOK):
    """One (event, hook_obj, command) per event. The event travels as argv;
    the path is double-quoted so a clone under a path with spaces survives
    the shell (caveman #157 class)."""
    specs = []
    for event in EVENTS:
        # Forward slashes: valid Windows path form, inert in double-quoted
        # shell text, no-op on POSIX. Git Bash rejects native backslashes
        # inside the quotes (rc 1 on the executed command).
        cmd = '"{}" {}'.format(str(hook).replace('\\', '/'), event)
        specs.append((event,
                      {'matcher': '', 'hooks': [{'type': 'command', 'command': cmd,
                                                 'timeout': 10,
                                                 'statusMessage': 'Loading flint style...'}]},
                      cmd))
    return specs


def _commands(hook_list):
    for entry in hook_list:
        for h in entry.get('hooks', []):
            yield h.get('command', '')


def _strip_flint(hook_list):
    return [entry for entry in hook_list
            if not any(MARKER in c for c in _commands([entry]))]


def apply(cfg, hook=HOOK):
    """Drop stale flint entries (old paths), register the 3 current ones."""
    hooks = cfg.setdefault('hooks', {})
    for event, hook_obj, cmd in hook_specs(hook):
        entries = hooks.get(event)
        if not isinstance(entries, list):
            entries = []
        entries = _strip_flint(entries)
        entries.append(hook_obj)
        hooks[event] = entries
    return cfg


def remove(cfg):
    """Remove flint entries from every event; foreign hooks untouched."""
    hooks = cfg.get('hooks')
    if isinstance(hooks, dict):
        for event, entries in list(hooks.items()):
            if isinstance(entries, list):
                kept = _strip_flint(entries)
                if kept:
                    hooks[event] = kept
                elif entries:          # emptied by flint: the event goes too
                    del hooks[event]
        if not hooks:
            del cfg['hooks']
    return cfg


def load(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except ValueError as e:
        # Never clobber a file we can't parse — that's the user's live config.
        sys.exit('flint install: {} is not valid JSON ({}); fix it first, '
                 'nothing was changed'.format(path, e))


def save(path, cfg):
    """Atomic write; skipped when the bytes would not change (a re-run with
    nothing new leaves the file untouched)."""
    text = json.dumps(cfg, indent=2) + '\n'
    if path.is_file() and path.read_text(encoding='utf-8') == text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.flint-tmp')
    tmp.write_text(text, encoding='utf-8')
    tmp.replace(path)


def uninstall(cfg, state):
    if FULL_CONFIG:
        remove_settings(cfg, state)
        apply_plugin_dirs(cfg, [], state.get('plugin_dirs', []))
        if cfg.get('env') == {} and 'env' in state.get('forced', {}):
            del cfg['env']
    save(settings_path(), remove(cfg))
    if FULL_CONFIG:
        remove_links(state.get('links', {}))
        link_ai_memory_token(state.get('ai_memory_link', False), remove=True)
    if state_path().exists():
        state_path().unlink()
    print('flint: removed from {}'.format(config_dir()))


def install(cfg, state):
    """Settings first (policy lands even if a later step fails), then the
    state that names what flint owns, then the network/CLI steps."""
    if not FULL_CONFIG:
        save(settings_path(), apply(cfg))
        print('flint: style hooks registered in {} -> {}'.format(settings_path(), HOOK))
        return
    forced = read_json(ROOT / 'settings.json')
    forced['env'] = dict(forced.get('env', {}), **read_env(ROOT / 'env.sh'))
    defaults = read_json(ROOT / 'settings.defaults.json')
    plugins = plugin_specs()
    new_state = {
        'forced': apply_forced(cfg, forced, state.get('forced', {})),
        'plugin_dirs': apply_plugin_dirs(cfg, mod_dirs() + place_plugins(plugins)[0],
                                         state.get('plugin_dirs', [])),
        'defaults': apply_defaults(cfg, defaults, state.get('defaults', {})),
        'links': state.get('links', {}),
        'ai_memory_link': state.get('ai_memory_link', False),
    }
    save(settings_path(), apply(cfg))
    save(state_path(), new_state)

    fetch_external(external_specs() + list(dict.fromkeys(
        ('git', ref, clone) for ref, clone, _, _ in plugins)))
    dirs, plugin_links, skipped = place_plugins(plugins)   # the fetch may add or drop some
    for msg in skipped:
        warn(msg)
    # Its hook runs the PATH python3 and silently does nothing below 3.10.
    if any(ref == TOKENECONOMIZER for ref, _, _, _ in plugins) and \
            (_python3_version() or ()) < (3, 10):
        warn('{} needs python3 >= 3.10 on PATH; below that it does nothing'
             .format(TOKENECONOMIZER))
    old_links = state.get('links', {})
    new_state['links'] = apply_links(
        [(config_dir() / kind / name, src) for kind, name, src in link_sources()]
        + plugin_links, old_links)
    remove_links({l: t for l, t in old_links.items() if l not in new_state['links']})
    new_state['ai_memory_link'] = link_ai_memory_token(state.get('ai_memory_link', False))
    if mod_dirs() + dirs != new_state['plugin_dirs']:
        new_state['plugin_dirs'] = apply_plugin_dirs(cfg, mod_dirs() + dirs,
                                                     new_state['plugin_dirs'])
        save(settings_path(), cfg)
    save(state_path(), new_state)

    catalog = list(defaults.get('enabledPlugins', {}))
    apply_plugins(cfg, catalog)
    dedupe_plugin_cache(catalog)
    print('flint: installed into {} -> {}'.format(config_dir(), ROOT))


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    removing = '--uninstall' in args
    if not removing and not HOOK.is_file():
        sys.exit('flint install: hook not found at {} — run from the clone'
                 .format(HOOK))
    cfg = load(settings_path())
    (uninstall if removing else install)(cfg, load_state())
    return 0


if __name__ == '__main__':
    sys.exit(main())
