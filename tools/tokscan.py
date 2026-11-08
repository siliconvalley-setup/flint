#!/usr/bin/env python3
"""tokscan: cost report from this user's Claude Code transcripts (flint#48).

Reads $CLAUDE_CONFIG_DIR (or ~/.claude) projects/*/*.jsonl and
projects/*/*/subagents/*.jsonl, local files only, no network.

Usage: python3 -I tools/tokscan.py [DAY | A..B] [--compare A..B C..D] [--json] [--no-prompts]
Dates are local YYYY-MM-DD, ranges inclusive. Default: today.
"""
import argparse
import glob
import io
import json
import os
import re
import shlex
import sys
from datetime import date, datetime

PRICING_URL = 'https://platform.claude.com/docs/en/about-claude/pricing'
# Ratios to base input price, from PRICING_URL (2026-11-06). First prefix match wins,
# so the specific id goes before its family. Columns: model prefix, USD per Mtok
# base input, USD per Mtok over 100k-token prompts (None = one tier),
# cache write 5 m, cache write 1 h, cache read, output.
PRICES = [
    ('claude-fable-5-1',  10.0, None, 1.25, 2.0, 0.025, 5.0),
    ('claude-mythos-5-1', 10.0, None, 1.25, 2.0, 0.025, 5.0),
    ('claude-opus-5-5',    4.0, None, 1.25, 2.0, 0.05,  5.0),
    ('claude-sonnet-5-5',  2.0, None, 1.25, 2.0, 0.05,  5.0),
    ('claude-haiku-5-5',   0.1, 0.5,  1.25, 2.0, 0.1,   5.0),
    ('claude-fable-5',    10.0, None, 1.25, 2.0, 0.1,   5.0),
    ('claude-mythos-5',   10.0, None, 1.25, 2.0, 0.1,   5.0),
    ('claude-opus-5',      5.0, None, 1.25, 2.0, 0.1,   5.0),
]
DEFAULT = ('(unlisted)', None, None, 1.25, 2.0, 0.1, 5.0)  # no USD
# First program of a Bash command -> category. Unknown programs go to 'other'.
BASH_CATEGORY = {
    'cat': 'read file', 'sed': 'read file', 'awk': 'read file', 'head': 'read file', 'tail': 'read file', 'nl': 'read file', 'wc': 'read file',
    'ls': 'list', 'fd': 'list', 'find': 'list', 'tree': 'list',
    'rg': 'search', 'grep': 'search', 'ast-grep': 'search', 'sg': 'search',
    'jq': 'data', 'sqlite3': 'data', 'pdftotext': 'data', 'pdftoppm': 'data', 'magick': 'data', 'ffmpeg': 'data',
    'python3': 'script', 'python': 'script', 'node': 'script', 'uv': 'script', 'sh': 'script', 'bash': 'script',
    'git': 'git', 'gh': 'github',
    'gapi': 'api', 'fbg': 'api', 'bwt': 'api', 'qb': 'api', 'cf': 'api', 'wrangler': 'api', 'vultr-cli': 'api', 'gcloud': 'api', 'bq': 'api',
    'agent-browser': 'browser', 'playwright-cli': 'browser',
    'firecrawl': 'web', 'curl': 'web', 'ctx7': 'web',
    'pnpm': 'build/test', 'npm': 'build/test', 'tsc': 'build/test', 'vitest': 'build/test', 'make': 'build/test', 'claude': 'build/test',
    'ai-memory': 'memory',
    'mkdir': 'write', 'cp': 'write', 'mv': 'write', 'rm': 'write', 'touch': 'write', 'ln': 'write', 'chmod': 'write', 'tee': 'write',
    'echo': 'shell', 'printf': 'shell', 'test': 'shell', 'command': 'shell', 'which': 'shell', 'pwd': 'shell',
    'mktemp': 'shell', 'seq': 'shell', 'readlink': 'shell', '[': 'shell', 'date': 'shell', 'sleep': 'shell',
    'ps': 'process', 'kill': 'process', 'pkill': 'process', 'lsof': 'process', 'open': 'process',
}
TOOL_CATEGORY = {'Read': 'read file', 'Write': 'write', 'Edit': 'write', 'NotebookEdit': 'write', 'Grep': 'search', 'Glob': 'list',
                 'WebSearch': 'web', 'WebFetch': 'web', 'Agent': 'subagent', 'Task': 'subagent', 'Skill': 'skill',
                 'ToolSearch': 'meta', 'Monitor': 'process', 'TaskStop': 'process'}
WRAPPERS = {'timeout', 'env', 'time', 'nohup', 'exec', 'nice', '!'}
ASSIGN = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=')
KEYWORDS = {'for', 'while', 'until', 'if', 'case', 'select', 'function', 'then', 'do', 'else', 'elif', 'fi', 'done', 'esac', '{', '}'}
KINDS = ('input', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'output')
# A run of requests, each with one call that only reads, could have been one request.
READ_ONLY = {'read file', 'search', 'list'}
# Bash programs that print and change nothing, besides the READ_ONLY categories.
PRINT = {'echo', 'printf'}


def int_field(d, k):
    v = d.get(k) if isinstance(d, dict) else None
    return v if isinstance(v, int) else 0


def price_row(model):
    return next((r for r in PRICES if model.startswith(r[0])), DEFAULT)


def tokens(u):
    cw = int_field(u, 'cache_creation_input_tokens')
    cc = u.get('cache_creation')
    if isinstance(cc, dict) and ('ephemeral_5m_input_tokens' in cc or 'ephemeral_1h_input_tokens' in cc):
        w5, w1 = int_field(cc, 'ephemeral_5m_input_tokens'), int_field(cc, 'ephemeral_1h_input_tokens')
    else:
        w5, w1 = cw, 0  # no split recorded: price as 5 m
    return {'input': int_field(u, 'input_tokens'), 'cache_write_5m': w5, 'cache_write_1h': w1,
            'cache_read': int_field(u, 'cache_read_input_tokens'), 'output': int_field(u, 'output_tokens')}


def cost(model, t):
    """(weighted units of base input price, USD or None)."""
    _, base, base_long, r5, r1, rr, ro = price_row(model)
    w = t['input'] + r5 * t['cache_write_5m'] + r1 * t['cache_write_1h'] + rr * t['cache_read'] + ro * t['output']
    prompt = t['input'] + t['cache_write_5m'] + t['cache_write_1h'] + t['cache_read']
    if base_long is not None and prompt > 100_000:
        base = base_long
    return w, (w * base / 1e6 if base is not None else None)


def bash(cmd, cwd):
    """(first program, files read by cat/sed -n/head/tail, only reads) of one Bash command.
    Only reads: every program in READ_ONLY categories or PRINT, no sed -i, no write redirect."""
    lines, end, ro = [], None, True
    for line in cmd.split('\n'):  # drop heredoc bodies: data, not commands
        if end is not None:
            end = None if line.strip() == end else end
            continue
        lines.append(line)
        h = re.search(r"<<-?\s*['\"]?(\w+)", line)
        end = h.group(1) if h else None
    lex = shlex.shlex('\n'.join(lines), posix=True, punctuation_chars='();<>|&\n')
    lex.whitespace, lex.whitespace_split = ' \t\r', True
    try:
        toks = list(lex)
    except ValueError:
        toks = '\n'.join(lines).split()[:1]  # shortcut: unbalanced quote, first word only and no reads; upgrade if 'other' grows
        ro = False
    prog, reads, funcs, shvars, seg = None, [], set(), {}, []
    for t in toks + [';']:
        if not set(t) <= set(';&|()\n') or t == '()':
            seg.append(t)
            continue
        argv, words = [], iter(seg)
        for w in words:
            if set(w) <= set('<>&'):  # redirection: drop it, its target and its fd number
                target = next(words, None)
                ro = ro and not ('>' in w and w != '>&' and target != '/dev/null')
                if argv and argv[-1].isdigit():
                    argv.pop()
                continue
            argv.append(w)
        seg = []
        if argv[1:2] == ['()']:  # shell function: its body is the program, its name is not
            funcs.add(argv[0])
            argv = argv[2:]
        while argv and (argv[0] in KEYWORDS or argv[0] in WRAPPERS or ASSIGN.match(argv[0])):
            w = argv.pop(0)
            if ASSIGN.match(w):
                name, _, value = w.partition('=')
                shvars[name] = value.split()[:1]
            elif w in ('for', 'while', 'until', 'if', 'case', 'select', 'function'):
                argv = []  # loop or test header; the body segments count
            elif w in ('timeout', 'env', 'nice'):
                while argv and argv[0].startswith('-'):
                    argv.pop(0)
                if w == 'timeout':
                    argv = argv[1:]  # the duration
        if argv and argv[0].startswith('$'):  # A="agent-browser --cdp 9222"; $A click
            argv = shvars.get(argv[0].strip('${}'), []) + argv[1:]
        if not argv or argv[0] in funcs:
            continue
        p = os.path.basename(argv[0])
        if p == 'cd':
            cwd = os.path.join(cwd, argv[1]) if len(argv) > 1 else cwd
            continue
        if p in ('export', 'set', 'source', '.', 'local', 'unset', 'trap', 'true', ':'):
            continue
        prog = prog or p
        ro = ro and (BASH_CATEGORY.get(p) in READ_ONLY or p in PRINT) and not (p == 'sed' and '-i' in argv)
        reads += [os.path.normpath(os.path.join(cwd, f)) for f in file_args(p, argv[1:]) if '$' not in f]
    return prog or 'cd', reads, ro


def file_args(p, args):
    if p == 'sed':
        if '-n' not in args or '-i' in args:
            return []
        rest = [a for a in args if not a.startswith('-')]
        return rest[0 if '-e' in args else 1:]
    if p in ('head', 'tail'):
        out, skip = [], False
        for a in args:
            if skip:
                skip = False
            elif a in ('-n', '-c'):
                skip = True
            elif not a.startswith('-') and not a.isdigit():
                out.append(a)
        return out
    if p == 'cat':
        return [a for a in args if not a.startswith('-')]
    return []


def call(key, name, inp, cwd):
    name, inp = str(name), inp if isinstance(inp, dict) else {}
    c = {'session': key, 'tool': name, 'category': TOOL_CATEGORY.get(name, 'other'), 'program': None, 'reads': [],
         'input': '', 'chars': 0, 'images': 0, 'done': False}
    c['ro'] = c['category'] in READ_ONLY
    if name == 'Bash':
        cmd = str(inp.get('command') or '')
        c['program'], c['reads'], c['ro'] = bash(cmd, cwd)
        c['category'] = BASH_CATEGORY.get(c['program'], 'other')
        c['tool'], c['input'] = 'Bash:' + c['program'], cmd
    elif name == 'Read':
        c['reads'] = [os.path.normpath(os.path.join(cwd, str(inp.get('file_path'))))] if inp.get('file_path') else []
        c['input'] = str(inp.get('file_path') or '')
    elif name in ('Agent', 'Task'):
        c['tool'], c['input'] = 'Agent:' + str(inp.get('subagent_type') or '-'), str(inp.get('description') or '')
    elif name == 'Skill':
        c['tool'] = 'Skill:' + str(inp.get('skill') or '-')
    elif name.startswith('mcp__'):
        c['category'] = 'memory' if 'ai-memory' in name else 'mcp'
    c['input'] = c['input'].replace('\n', ' ')[:70]
    return c


def result(c, content):
    if c['done']:
        return
    c['done'] = True
    if isinstance(content, str):
        c['chars'] = len(content)
    elif isinstance(content, list):
        for x in content:
            if isinstance(x, dict) and x.get('type') == 'image':
                c['images'] += 1
            elif isinstance(x, dict):
                c['chars'] += len(str(x.get('text') or ''))


def local_date(ts):
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone()
    except (ValueError, AttributeError):
        return None


def transcripts(cfg):
    root = os.path.join(cfg, 'projects')
    mains = glob.glob(os.path.join(root, '*', '*.jsonl'))
    subs = glob.glob(os.path.join(root, '*', '*', 'subagents', '*.jsonl'))
    for f in sorted(mains) + sorted(subs):
        parts = os.path.relpath(f, root).replace(os.sep, '/').split('/')
        sid = parts[1][:-6] if parts[1].endswith('.jsonl') else parts[1]
        agent = parts[3][:-6] if len(parts) == 4 else None
        yield f, parts[0] + '/' + sid, agent


def entries(path):
    try:
        fh = open(path, encoding='utf-8', errors='replace')
    except OSError:
        return
    with fh:
        for line in fh:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if isinstance(e, dict):
                yield e


def scan(cfg, lo, hi):
    reqs = {}  # message.id -> request; streamed lines repeat the id
    calls = {}  # tool_use id -> call
    sessions, agents = {}, {}
    for path, key, agent in transcripts(cfg):
        meta = {}
        if agent:
            try:
                with open(path[:-6] + '.meta.json', encoding='utf-8') as fh:
                    meta = json.load(fh)
            except (OSError, ValueError):
                pass
        for e in entries(path):
            lt = local_date(e.get('timestamp'))
            if lt is None or not lo <= lt.date() <= hi:
                continue
            s = sessions.setdefault(key, {'session': key, 'project': os.path.basename(str(e.get('cwd') or '')) or key.split('/')[0],
                                          'first': lt, 'last': lt, 'compactions': 0, 'max_context': 0, 'prompt': ''})
            s['first'], s['last'] = min(s['first'], lt), max(s['last'], lt)
            m = e.get('message')
            if agent:
                a = agents.setdefault((key, agent), {'session': key, 'agent': agent, 'type': meta.get('agentType') if isinstance(meta, dict) else None,
                                                     'description': meta.get('description') if isinstance(meta, dict) else None})
                if not a['description'] and e.get('type') == 'user' and isinstance(m, dict) and isinstance(m.get('content'), str):
                    a['description'] = m['content'][:70].replace('\n', ' ')
            else:
                if e.get('isCompactSummary') or (e.get('type') == 'system' and e.get('subtype') == 'compact_boundary'):
                    s['compactions'] += 1
                if (not s['prompt'] and e.get('type') == 'user' and not e.get('isMeta') and isinstance(m, dict)
                        and isinstance(m.get('content'), str) and not m['content'].startswith('<')):
                    s['prompt'] = m['content'][:70].replace('\n', ' ')
            if e.get('type') == 'user' and isinstance(m, dict) and isinstance(m.get('content'), list):
                for c in m['content']:
                    if isinstance(c, dict) and c.get('type') == 'tool_result' and c.get('tool_use_id') in calls:
                        result(calls[c['tool_use_id']], c.get('content'))
            if e.get('type') != 'assistant' or not isinstance(m, dict) or not isinstance(m.get('usage'), dict):
                continue
            new = []
            for c in m.get('content') or []:
                if isinstance(c, dict) and c.get('type') == 'tool_use' and c.get('id') not in calls:
                    calls[c.get('id')] = call(key, c.get('name'), c.get('input'), str(e.get('cwd') or ''))
                    new.append(calls[c.get('id')]['ro'])
            model = str(m.get('model') or '?')
            if model == '<synthetic>':
                continue
            mid = m.get('id') or e.get('uuid')
            r = reqs.setdefault(mid, {'session': key, 'agent': agent, 'model': model, 'at': lt})
            r['tokens'] = tokens(m['usage'])  # last line of the stream wins
            r.setdefault('tools', []).extend(new)
            if not agent:
                s['max_context'] = max(s['max_context'], sum(r['tokens'][k] for k in KINDS[:4]))
    return report(reqs, sessions, agents, calls.values(), lo, hi)


def add(acc, r):
    for k in KINDS:
        acc[k] = acc.get(k, 0) + r['tokens'][k]
    w, usd = cost(r['model'], r['tokens'])
    acc['requests'] = acc.get('requests', 0) + 1
    acc['weighted'] = acc.get('weighted', 0) + w
    acc.setdefault('usd', None)
    if usd is not None:
        acc['usd'] = (acc['usd'] or 0) + usd
    else:
        acc['unpriced_requests'] = acc.get('unpriced_requests', 0) + 1
    return acc


def report(reqs, sessions, agents, calls, lo, hi):
    totals, models = {}, {}
    for r in reqs.values():
        add(totals, r)
        add(models.setdefault(r['model'], {}), r)
        s = sessions[r['session']]
        add(s, r)
        side = 'sub_requests' if r['agent'] else 'main_requests'
        s[side] = s.get(side, 0) + 1
        if r['agent']:
            s['sub_weighted'] = s.get('sub_weighted', 0) + cost(r['model'], r['tokens'])[0]
            a = add(agents[(r['session'], r['agent'])], r)
            a.setdefault('models', {})[r['model']] = a.get('models', {}).get(r['model'], 0) + 1
    for a in agents.values():
        a['model'] = max(a.get('models', {'-': 0}).items(), key=lambda kv: kv[1])[0]
        a.pop('models', None)
    by_cost = lambda x: -x.get('weighted', 0)
    rows = sorted((s for s in sessions.values() if s.get('requests')), key=by_cost)
    for s in rows:
        s.setdefault('main_requests', 0)
        s.setdefault('sub_requests', 0)
        s.setdefault('sub_weighted', 0)
    # Tool calls per request; runs of one-call read-only requests per agent, in transcript order.
    # A batchable request (2nd and later of a run) would save its cache read: it re-reads the whole context.
    batching, run = {'tools_per_request': {}, 'read_runs': 0, 'batchable_requests': 0, 'batchable_cache_read_weighted': 0}, {}
    for r in reqs.values():
        n, who = len(r['tools']), (r['session'], r['agent'])
        k = str(n) if n < 4 else '4+'
        batching['tools_per_request'][k] = batching['tools_per_request'].get(k, 0) + 1
        run[who] = run.get(who, 0) + 1 if n == 1 and r['tools'][0] else 0
        batching['read_runs'] += run[who] == 2
        if run[who] >= 2:
            batching['batchable_requests'] += 1
            batching['batchable_cache_read_weighted'] += cost(r['model'], dict.fromkeys(KINDS, 0) | {'cache_read': r['tokens']['cache_read']})[0]
    categories, programs, reads = {}, {}, {}
    calls = list(calls)
    for c in calls:
        for acc in [categories.setdefault(c['category'], {})] + ([programs.setdefault(c['program'], {})] if c['program'] else []):
            acc['calls'] = acc.get('calls', 0) + 1
            acc['chars'] = acc.get('chars', 0) + c['chars']
            acc['tokens'] = acc['chars'] // 4  # shortcut: ~4 chars per token, no tokenizer; upgrade if a token count must be exact
            acc['images'] = acc.get('images', 0) + c['images']
        for f in c['reads']:
            reads[(c['session'], f)] = reads.get((c['session'], f), 0) + 1
    return {'range': [lo.isoformat(), hi.isoformat()], 'pricing': PRICING_URL,
            'ratios': {m: dict(zip(('row', 'usd_per_mtok', 'usd_per_mtok_over_100k', 'cache_write_5m', 'cache_write_1h', 'cache_read', 'output'), price_row(m))) for m in models},
            'totals': totals, 'models': models, 'sessions': rows,
            'subagents': sorted((a for a in agents.values() if a.get('requests')), key=by_cost)[:10],
            'categories': categories, 'bash': programs, 'batching': batching,
            'largest': [{k: c[k] for k in ('chars', 'images', 'session', 'tool', 'input')}
                        for c in sorted(calls, key=lambda c: -c['chars'])[:10]],
            'rereads': [{'session': k[0], 'path': k[1], 'count': v} for k, v in sorted(reads.items(), key=lambda kv: -kv[1]) if v >= 3]}


def flat(rep):
    """Headline metrics of one range, for --compare."""
    t = rep['totals']
    f = {k: t.get(k, 0) for k in ('requests',) + KINDS + ('weighted',)}
    f['usd'] = t.get('usd') or 0  # priced requests only, as in TOTALS
    f['sessions'] = len(rep['sessions'])
    f['subagent weighted'] = sum(s['sub_weighted'] for s in rep['sessions'])
    for k, c in sorted(rep['categories'].items()):
        f[k + ' calls'], f[k + ' tokens'] = c['calls'], c['tokens']
    f['files read 3+ times'] = len(rep['rereads'])
    b = rep['batching']
    f['requests with 1 tool'] = b['tools_per_request'].get('1', 0)
    f['batchable requests'], f['batchable cache read weighted'] = b['batchable_requests'], b['batchable_cache_read_weighted']
    return f


def compare(ra, rb):
    """(metrics A, metrics B, B - A); a metric seen in one range only counts 0 in the other."""
    fa, fb = flat(ra), flat(rb)
    keys = list(dict.fromkeys([*fa, *fb]))
    fa, fb = {k: fa.get(k, 0) for k in keys}, {k: fb.get(k, 0) for k in keys}
    return fa, fb, {k: fb[k] - fa[k] for k in keys}


def num(v, signed=False):
    if v is None:
        return '-'
    s = f'{v:+,.4f}' if isinstance(v, float) and abs(v) < 1000 and v != int(v) else f'{v:+,.0f}'
    return s if signed else s.lstrip('+')


def table(title, head, rows):
    out = ['', title, '  '.join(f'{h:>{w}}' if w > 0 else f'{h:<{-w}}' for h, w in head)]
    for r in rows:
        out.append('  '.join(f'{str(v)[:abs(w)]:>{w}}' if w > 0 else f'{str(v)[:-w]:<{-w}}' for v, (_, w) in zip(r, head)).rstrip())
    return out


def hm(dt):
    return dt.strftime('%m-%d %H:%M') if dt else ''


def render(rep):
    t = rep['totals']
    usd = lambda x: '-' if x.get('usd') is None else f"{x.get('usd', 0):.4f}"
    out = [f"tokscan {rep['range'][0]}..{rep['range'][1]}  weighted = units of base input price  source {rep['pricing']}"]
    out += table('RATIOS (x base input)', [('model', -24), ('table row', -18), ('cw 5m', 6), ('cw 1h', 6), ('read', 6), ('out', 5), ('$/Mtok', 7)],
                 [(m, r['row'], r['cache_write_5m'], r['cache_write_1h'], r['cache_read'], r['output'], '-' if r['usd_per_mtok'] is None else f"{r['usd_per_mtok']:g}")
                  for m, r in sorted(rep['ratios'].items())])
    unpriced = sorted(m for m, x in rep['models'].items() if x.get('unpriced_requests'))
    if unpriced:
        out.append('usd excludes models with no base price: ' + ', '.join(unpriced))
    head = [('', -24), ('requests', 9)] + [(k, 15) for k in KINDS] + [('weighted', 15), ('usd', 10)]
    out += table('TOTALS', head, [('all' if not m else m, x.get('requests', 0), *(num(x.get(k, 0)) for k in KINDS), num(x.get('weighted', 0)), usd(x))
                                  for m, x in [(None, t)] + sorted(rep['models'].items(), key=lambda kv: -kv[1]['weighted'])])
    out += table('SESSIONS (by weighted)', [('project', -16), ('session', -8), ('span', -23), ('req', 5), ('main', 5), ('sub', 5),
                                            ('sub weighted', 13), ('max ctx', 9), ('compact', 7), ('weighted', 13), ('usd', 9), ('first prompt', -70)],
                 [(s['project'], s['session'].split('/')[-1], f"{hm(s['first'])}-{hm(s['last'])[6:]}" if s['first'].date() == s['last'].date() else f"{hm(s['first'])}-{hm(s['last'])}",
                   s['requests'], s['main_requests'], s['sub_requests'], num(s['sub_weighted']), num(s['max_context']), s['compactions'], num(s['weighted']), usd(s), s['prompt'])
                  for s in rep['sessions']])
    out += table('SUBAGENTS (top 10 by weighted)', [('session', -8), ('type', -18), ('model', -18), ('req', 5), ('weighted', 13), ('description', -50)],
                 [(a['session'].split('/')[-1], a['type'] or '-', a['model'], a['requests'], num(a['weighted']), a['description'] or '') for a in rep['subagents']])
    cat_rows = lambda d: [(k, c['calls'], num(c['chars']), num(c['tokens']), c['images']) for k, c in sorted(d.items(), key=lambda kv: -kv[1]['chars'])]
    out += table('TOOLS by category', [('category', -14), ('calls', 6), ('result chars', 13), ('~tokens', 11), ('images', 6)], cat_rows(rep['categories']))
    b = rep['batching']
    out += table('TOOL BATCHING (calls per request)', [('tools', -6), ('requests', 9)],
                 [(k, b['tools_per_request'][k]) for k in sorted(b['tools_per_request'])])
    out.append(f"runs of one-call read-only requests: {b['read_runs']} runs, {b['batchable_requests']} batchable requests, "
               f"cache read {num(b['batchable_cache_read_weighted'])} weighted (dependent calls count too)")
    out += table('BASH by program (top 20)', [('program', -14), ('calls', 6), ('result chars', 13), ('~tokens', 11), ('category', -12)],
                 [(p, c['calls'], num(c['chars']), num(c['tokens']), BASH_CATEGORY.get(p, 'other')) for p, c in sorted(rep['bash'].items(), key=lambda kv: -kv[1]['chars'])[:20]])
    out += table('LARGEST TOOL RESULTS', [('chars', 9), ('img', 3), ('session', -8), ('tool', -22), ('input', -70)],
                 [(num(c['chars']), c['images'], c['session'].split('/')[-1], c['tool'], c['input']) for c in rep['largest']])
    out += table('FILES READ 3+ TIMES IN ONE SESSION', [('count', 5), ('session', -8), ('path', -100)],
                 [(r['count'], r['session'].split('/')[-1], r['path']) for r in rep['rereads']])
    return '\n'.join(out)


def render_compare(rep):
    a, b = rep['a']['range'], rep['b']['range']
    fa, fb, _ = compare(rep['a'], rep['b'])
    rows = []
    for k, d in rep['delta'].items():
        pct = f'{d / fa[k] * 100:+.0f}%' if d is not None and fa[k] else ''
        rows.append((k, num(fa[k]), num(fb[k]), num(d, signed=True), pct))
    head = [('metric', -24), (f'{a[0]}..{a[1]}', 22), (f'{b[0]}..{b[1]}', 22), ('delta', 16), ('%', 7)]
    return '\n'.join([f"tokscan compare  weighted = units of base input price  source {rep['a']['pricing']}"] + table('', head, rows)[1:])


def parse_range(s):
    a, _, b = s.partition('..')
    try:
        lo = date.fromisoformat(a)
        hi = date.fromisoformat(b) if b else lo
    except ValueError:
        raise argparse.ArgumentTypeError(f'bad date range {s!r}: want YYYY-MM-DD or YYYY-MM-DD..YYYY-MM-DD')
    if hi < lo:
        raise argparse.ArgumentTypeError(f'bad date range {s!r}: end before start')
    return lo, hi


def main(argv=None):
    ap = argparse.ArgumentParser(prog='tokscan', description='Cost report from Claude Code transcripts.')
    ap.add_argument('range', nargs='?', type=parse_range, help='DAY or A..B (local dates), default today')
    ap.add_argument('--compare', nargs=2, type=parse_range, metavar=('A..B', 'C..D'))
    ap.add_argument('--json', action='store_true', help='print the same data as JSON')
    ap.add_argument('--no-prompts', action='store_true', help='hide prompt and input previews')
    a = ap.parse_args(argv)
    cfg = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.join(os.path.expanduser('~'), '.claude')
    lo, hi = a.range or (date.today(), date.today())
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors='replace')  # a cp1252 console must not crash on a prompt preview
    if a.compare:
        ra, rb = scan(cfg, *a.compare[0]), scan(cfg, *a.compare[1])
        rep = {'a': ra, 'b': rb, 'delta': compare(ra, rb)[2]}
    else:
        rep = scan(cfg, lo, hi)
    if a.no_prompts:
        for r in [rep] if not a.compare else [rep['a'], rep['b']]:
            for row in r['sessions'] + r['largest']:
                row['prompt' if 'prompt' in row else 'input'] = ''
            for row in r['subagents']:
                row['description'] = None
    if a.json:
        json.dump(rep, sys.stdout, indent=1, default=str)
        print()
    else:
        print(render_compare(rep) if a.compare else render(rep))
    return 0


if __name__ == '__main__':
    sys.exit(main())
