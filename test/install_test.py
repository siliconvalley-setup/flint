#!/usr/bin/env python3
"""Installer seam tests: end state of settings.json only, no internals.
Run: python3 test/install_test.py  (expect: PASS)"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import install  # noqa: E402


def _find_bash():
    # Resolve the bash the platform contract names (ADR 0002: Git Bash), not
    # whatever PATH finds first. On Windows runners bare `bash` resolves to the
    # System32 WSL stub, which with no distro fails this probe; Git Bash passes.
    candidates = [shutil.which('bash')]
    for v in ('ProgramFiles', 'ProgramFiles(x86)'):
        if os.environ.get(v):
            candidates.append(os.path.join(os.environ[v], 'Git', 'bin', 'bash.exe'))
    for c in candidates:
        if not c:
            continue
        try:
            r = subprocess.run([c, '-c', 'echo flint-probe'],
                               capture_output=True, text=True, timeout=15)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if r.stdout.strip() == 'flint-probe':
            return c
    return None


POSIX = os.name != 'nt'   # the full config installs on macOS/Linux only


def run_cli(config_dir, *args, root=ROOT, home=None, claude_bin=None, path=None):
    """install.py with a fake config dir AND a fake HOME (the installer also
    writes under HOME: the ai-memory credential link). Offline: no fetch of the
    external skills. No `claude` unless the test passes a stub."""
    home = str(home or Path(config_dir) / 'home')
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config_dir), HOME=home,
               USERPROFILE=home, FLINT_OFFLINE='1',
               FLINT_CLAUDE_BIN=claude_bin or str(Path(config_dir) / 'no-claude'))
    if path is not None:
        env['PATH'] = str(path)
    return subprocess.run([sys.executable, str(Path(root) / 'install.py'), *args],
                          env=env, capture_output=True, text=True)


def make_clone(parent):
    """A throwaway copy of this repo, for tests that edit flint's own files."""
    dst = Path(parent) / 'clone'
    shutil.copytree(ROOT, dst, symlinks=True,
                    ignore=shutil.ignore_patterns('.git', '.cache', '__pycache__'))
    return dst


def snapshot(config_dir):
    """Every path under the config dir -> file bytes or link target."""
    out = {}
    for p in sorted(Path(config_dir).rglob('*')):
        rel = str(p.relative_to(config_dir))
        if p.is_symlink():
            out[rel] = 'link:' + os.readlink(p)
        elif p.is_file():
            out[rel] = p.read_bytes()
    return out


def skip_unless_posix():
    if not POSIX:
        print('     (skipped: full config installs on macOS/Linux only)')
        return True
    return False


def test_install_forces_policy_and_keeps_user_choices():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps({
            'model': 'sonnet',                                   # a user /model pick
            'permissions': {'allow': ['Bash(make *)'], 'defaultMode': 'default'},
            'enabledPlugins': {'typescript-lsp@claude-plugins-official': False},
        }))
        assert run_cli(d).returncode == 0
        cfg = read_settings(d)
        perms = cfg['permissions']
        assert perms['defaultMode'] == 'bypassPermissions'       # forced
        assert 'WebFetch' in perms['deny'] and 'Bash(npx *)' in perms['deny']
        assert perms['ask'] == ['Bash(pnpm dlx *)']
        assert perms['allow'] == ['Bash(make *)']               # user key in a forced dict
        assert cfg['autoUpdatesChannel'] == 'stable'
        assert cfg['disableBundledSkills'] is True
        assert cfg['syncClaudeAiSkills'] is False
        assert cfg['enabledPlugins']['agents-md@builtin'] is False
        assert cfg['model'] == 'sonnet'                          # default, user wins
        assert cfg['fallbackModel'] == ['opus', 'sonnet']        # default, absent before
        assert cfg['outputStyle'] == 'caveman'
        assert cfg['enabledPlugins']['typescript-lsp@claude-plugins-official'] is False
        assert cfg['enabledPlugins']['ai-memory@ai-memory'] is True
        assert cfg['extraKnownMarketplaces']['ai-memory']['source']['repo'] == 'akitaonrails/ai-memory'
        sl = cfg['statusLine']['command']
        assert sl == '"{}/statusline/statusline-usage.sh"'.format(ROOT.as_posix()), sl


HERDR_HOOK = {'matcher': '', 'hooks': [{'type': 'command',
              'command': 'herdr integration hook claude SessionStart'}]}
USER_SETTINGS = {
    'model': 'sonnet',
    'hooks': {'SessionStart': [HERDR_HOOK]},
    'permissions': {'allow': ['Bash(make *)']},
    'env': {'MY_VAR': '1'},
}


def test_second_install_changes_no_byte():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps(USER_SETTINGS))
        assert run_cli(d).returncode == 0
        first = snapshot(d)
        assert run_cli(d).returncode == 0
        assert snapshot(d) == first


def test_uninstall_leaves_only_what_was_there_before():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps(USER_SETTINGS))
        run_cli(d)
        r = run_cli(d, '--uninstall')
        assert r.returncode == 0, r.stderr
        assert read_settings(d) == USER_SETTINGS
        assert sorted(snapshot(d)) == ['settings.json']


def test_what_flint_stops_shipping_leaves_the_config_dir():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        clone = make_clone(d)
        cfg_dir = Path(d) / 'cfg'
        assert run_cli(cfg_dir, root=clone).returncode == 0
        assert (cfg_dir / 'skills' / 'tdd').is_symlink()
        cfg = read_settings(cfg_dir)
        cfg['fallbackModel'] = ['sonnet']             # user edits a default
        (cfg_dir / 'settings.json').write_text(json.dumps(cfg))

        shutil.rmtree(str(clone / 'skills' / 'tdd'))
        forced = json.loads((clone / 'settings.json').read_text())
        del forced['autoUpdatesChannel']
        del forced['enabledPlugins']['agents-md@builtin']
        (clone / 'settings.json').write_text(json.dumps(forced))
        defaults = json.loads((clone / 'settings.defaults.json').read_text())
        del defaults['outputStyle'], defaults['fallbackModel']
        (clone / 'settings.defaults.json').write_text(json.dumps(defaults))

        assert run_cli(cfg_dir, root=clone).returncode == 0
        cfg = read_settings(cfg_dir)
        assert not (cfg_dir / 'skills' / 'tdd').exists()
        assert (cfg_dir / 'skills' / 'tdd').is_symlink() is False
        assert 'autoUpdatesChannel' not in cfg
        assert 'agents-md@builtin' not in cfg['enabledPlugins']
        assert 'outputStyle' not in cfg
        assert cfg['fallbackModel'] == ['sonnet']      # the user's value stays


def test_a_users_own_file_is_never_replaced_by_a_link():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        mine = Path(d) / 'rules' / 'rules.md'
        mine.parent.mkdir(parents=True)
        mine.write_text('my rules')
        r = run_cli(d)
        assert r.returncode == 0
        assert not mine.is_symlink() and mine.read_text() == 'my rules'
        assert 'rules.md' in r.stderr
        run_cli(d, '--uninstall')
        assert mine.read_text() == 'my rules'


def test_env_sh_reaches_settings_env_and_a_plain_shell():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps(
            {'env': {'MY_VAR': '1', 'CLAUDE_CODE_PLUGIN_DIRS': '/mine/mod'}}))
        assert run_cli(d).returncode == 0
        env = read_settings(d)['env']
        assert env['FIRECRAWL_API_URL'] == 'http://192.168.1.2:3002'
        assert env['AI_MEMORY_SERVER_URL'] == 'http://192.168.1.2:49374'
        assert env['DISABLE_AUTO_COMPACT'] == '1'
        assert 'DISABLE_UPDATES' not in env
        assert env['MY_VAR'] == '1'
        dirs = env['CLAUDE_CODE_PLUGIN_DIRS'].split(':')
        assert dirs == ['/mine/mod', (ROOT / 'mods' / 'sleep-guard').as_posix()]
        out = subprocess.run(['sh', '-c', '. "$1" && printf %s "$FIRECRAWL_API_URL"',
                              'sh', str(ROOT / 'env.sh')],
                             capture_output=True, text=True).stdout
        assert out == env['FIRECRAWL_API_URL']
        run_cli(d, '--uninstall')
        assert read_settings(d)['env'] == {'MY_VAR': '1',
                                           'CLAUDE_CODE_PLUGIN_DIRS': '/mine/mod'}


def test_a_key_dropped_from_env_sh_leaves_settings_env():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        clone = make_clone(d)
        cfg_dir = Path(d) / 'cfg'
        run_cli(cfg_dir, root=clone)
        env_sh = clone / 'env.sh'
        env_sh.write_text(''.join(l for l in env_sh.read_text().splitlines(True)
                                  if 'FIRECRAWL_API_URL' not in l))
        run_cli(cfg_dir, root=clone)
        env = read_settings(cfg_dir)['env']
        assert 'FIRECRAWL_API_URL' not in env and 'DISABLE_AUTO_COMPACT' in env


def fake_claude(parent, installed=(), version='1.0.0'):
    """A `claude` stub: logs each call, answers the two list calls with JSON."""
    log = Path(parent) / 'claude.log'
    plugins = json.dumps([{'id': i, 'version': version} for i in installed])
    mkts = json.dumps([{'name': i.split('@')[1]} for i in installed])
    stub = Path(parent) / 'claude'
    stub.write_text('#!/bin/sh\n'
                    'echo "$*" >> "{log}"\n'
                    'case "$*" in\n'
                    "  'plugin list --json') echo '{p}' ;;\n"
                    "  'plugin marketplace list --json') echo '{m}' ;;\n"
                    'esac\n'.format(log=log, p=plugins, m=mkts))
    stub.chmod(0o755)
    return str(stub), log


CATALOG = ['typescript-lsp@claude-plugins-official', 'pyright-lsp@claude-plugins-official',
           'ai-memory@ai-memory']


def test_install_adds_the_marketplace_and_installs_the_catalog():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        stub, log = fake_claude(d)
        assert run_cli(d, claude_bin=stub).returncode == 0
        calls = log.read_text().splitlines()
        assert 'plugin marketplace add https://github.com/akitaonrails/ai-memory' in calls
        for plugin in CATALOG:
            assert 'plugin install {}'.format(plugin) in calls
        assert not any('builtin' in c for c in calls)


def fake_bin(parent, name, output):
    d = Path(parent) / 'bin'
    d.mkdir(exist_ok=True)
    b = d / name
    b.write_text('#!/bin/sh\necho "{}"\n'.format(output))
    b.chmod(0o755)
    return d


def test_installed_plugins_are_left_alone():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        stub, log = fake_claude(d, installed=CATALOG, version='3.2.4')
        r = run_cli(d, claude_bin=stub, path=fake_bin(d, 'ai-memory', 'ai-memory 3.2.4'))
        assert r.returncode == 0, r.stderr
        calls = log.read_text().splitlines()
        assert [c for c in calls if 'list' not in c] == []


def test_ai_memory_plugin_follows_a_newer_binary():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        stub, log = fake_claude(d, installed=CATALOG, version='3.2.4')
        run_cli(d, claude_bin=stub, path=fake_bin(d, 'ai-memory', 'ai-memory 3.3.0'))
        calls = [c for c in log.read_text().splitlines() if 'list' not in c]
        assert calls == ['plugin marketplace update ai-memory',
                         'plugin update ai-memory@ai-memory']


def test_a_missing_plugin_binary_is_named():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        r = run_cli(d, path=fake_bin(d, 'pyright', ''))
        assert 'typescript-language-server' in r.stderr
        assert '`ai-memory`' in r.stderr
        assert '`pyright`' not in r.stderr


def test_a_plugin_the_user_disabled_is_not_installed():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps(
            {'enabledPlugins': {'pyright-lsp@claude-plugins-official': False}}))
        stub, log = fake_claude(d)
        run_cli(d, claude_bin=stub)
        assert 'plugin install pyright-lsp@claude-plugins-official' not in log.read_text()


def test_missing_claude_warns_and_still_succeeds():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        r = run_cli(d)
        assert r.returncode == 0
        assert 'claude not found' in r.stderr


def test_fetched_external_skills_are_linked_and_pruned_with_the_cache():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        clone = make_clone(d)
        gapi = clone / '.cache' / 'git' / 'google-apis-cli' / 'skills' / 'gapi'
        qb = clone / '.cache' / 'npm' / 'qb' / 'package' / 'skills' / 'quickbooks-epic'
        for s in (gapi, qb):
            s.mkdir(parents=True)
            (s / 'SKILL.md').write_text('---\nname: x\n---\n')
        cfg_dir = Path(d) / 'cfg'
        assert run_cli(cfg_dir, root=clone).returncode == 0
        assert (cfg_dir / 'skills' / 'gapi').resolve() == gapi.resolve()
        assert (cfg_dir / 'skills' / 'quickbooks-epic').resolve() == qb.resolve()
        shutil.rmtree(str(gapi))
        run_cli(cfg_dir, root=clone)
        assert not (cfg_dir / 'skills' / 'gapi').is_symlink()


def test_external_skills_list_names_the_three_sources():
    lines = [l.split() for l in (ROOT / 'external-skills.txt').read_text().splitlines()
             if l.strip() and not l.startswith('#')]
    assert lines == [['git', 'realroboto/bing-webmaster-cli'],
                     ['git', 'realroboto/google-apis-cli'],
                     ['npm', '@reallroboto/qb']]


def test_ai_memory_token_link_follows_the_machine_secret():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        home = Path(d) / 'home'
        link = home / '.local' / 'share' / 'ai-memory' / 'auth-token'
        run_cli(d, home=home)
        assert not link.is_symlink()                    # no secret, no link
        secret = home / '.config' / 'ai-memory-auth-token'
        secret.parent.mkdir(parents=True)
        secret.write_text('tok\n')
        run_cli(d, home=home)
        assert link.is_symlink() and link.resolve() == secret.resolve()
        run_cli(d, '--uninstall', home=home)
        assert not link.is_symlink() and secret.read_text() == 'tok\n'


def test_ai_memory_token_file_of_the_user_is_kept():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        home = Path(d) / 'home'
        (home / '.config').mkdir(parents=True)
        (home / '.config' / 'ai-memory-auth-token').write_text('tok')
        link = home / '.local' / 'share' / 'ai-memory' / 'auth-token'
        link.parent.mkdir(parents=True)
        link.write_text('my own token')
        run_cli(d, home=home)
        assert not link.is_symlink() and link.read_text() == 'my own token'


def _cache(d, mkt, name, versions):
    plug = Path(d) / 'plugins' / 'cache' / mkt / name
    for v in versions:
        (plug / v).mkdir(parents=True)
    return plug


def test_only_the_loaded_version_of_a_flint_plugin_is_kept():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        plug = _cache(d, 'ai-memory', 'ai-memory', ('1.0.0', '1.2.0', '0397d7d88fa6'))
        (Path(d) / 'plugins' / 'installed_plugins.json').write_text(json.dumps(
            {'plugins': {'ai-memory@ai-memory': [{'installPath': str(plug / '1.0.0') + '/'}]}}))
        run_cli(d)
        assert sorted(x.name for x in plug.iterdir()) == ['1.0.0']


def test_cache_of_other_plugins_or_without_a_record_is_untouched():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        other = _cache(d, 'mkt', 'p', ('1.0.0', '1.2.0'))
        flint = _cache(d, 'ai-memory', 'ai-memory', ('1.0.0', '1.2.0'))
        (Path(d) / 'plugins' / 'installed_plugins.json').write_text(json.dumps(
            {'plugins': {'p@mkt': [{'installPath': str(other / '1.2.0')}]}}))
        run_cli(d)
        assert sorted(x.name for x in other.iterdir()) == ['1.0.0', '1.2.0']
        assert sorted(x.name for x in flint.iterdir()) == ['1.0.0', '1.2.0']


def test_a_link_the_user_repointed_survives_uninstall():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        run_cli(d)
        link = Path(d) / 'rules' / 'rules.md'
        mine = Path(d) / 'mine.md'
        mine.write_text('x')
        link.unlink()
        link.symlink_to(mine)
        run_cli(d)
        assert os.readlink(str(link)) == str(mine)
        run_cli(d, '--uninstall')
        assert os.readlink(str(link)) == str(mine)


def test_a_preexisting_ai_memory_link_is_not_flints_to_remove():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        home = Path(d) / 'home'
        secret = home / '.config' / 'ai-memory-auth-token'
        secret.parent.mkdir(parents=True)
        secret.write_text('tok')
        link = home / '.local' / 'share' / 'ai-memory' / 'auth-token'
        link.parent.mkdir(parents=True)
        link.symlink_to(secret)
        run_cli(d, home=home)
        run_cli(d, '--uninstall', home=home)
        assert link.is_symlink()


def test_a_marketplace_with_a_string_source_does_not_crash():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps(
            {'extraKnownMarketplaces': {'claude-plugins-official': {'source': 'x'}}}))
        stub, log = fake_claude(d)
        r = run_cli(d, claude_bin=stub)
        assert r.returncode == 0, r.stderr


def test_env_sh_sources_in_zsh():
    zsh = shutil.which('zsh')
    if not zsh:
        print('     (skipped: no zsh)')
        return
    r = subprocess.run([zsh, '-c', '. "$1" && printf %s "$AI_MEMORY_SERVER_URL"',
                        'zsh', str(ROOT / 'env.sh')], capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout == 'http://192.168.1.2:49374', r


def test_every_style_command_carries_the_marker_and_no_foreign_one_does():
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'settings.json').write_text(json.dumps({'hooks': {'SessionStart': [HERDR_HOOK]}}))
        run_cli(d)
        cmds = [h['command'] for entries in read_settings(d)['hooks'].values()
                for e in entries for h in e['hooks']]
        assert len([c for c in cmds if install.MARKER in c]) == 3
        assert [c for c in cmds if install.MARKER not in c] == \
            [HERDR_HOOK['hooks'][0]['command']]


def test_a_custom_statusline_is_left_whole():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        mine = {'type': 'command', 'command': '~/my-status.sh'}
        (Path(d) / 'settings.json').write_text(json.dumps({'statusLine': mine}))
        run_cli(d)
        assert read_settings(d)['statusLine'] == mine


def test_install_links_every_skill_agent_rule_and_output_style():
    if skip_unless_posix():
        return
    with tempfile.TemporaryDirectory() as d:
        r = run_cli(d)
        assert r.returncode == 0, r.stderr
        for kind, pattern in (('skills', '*/SKILL.md'), ('agents', '*.md'),
                              ('rules', '*.md'), ('output-styles', '*.md')):
            names = [Path(p).parent.name if kind == 'skills' else Path(p).name
                     for p in (ROOT / kind).glob(pattern)]
            assert names, kind
            for name in names:
                link = Path(d) / kind / name
                assert link.is_symlink(), link
                assert link.resolve() == (ROOT / kind / name).resolve()


def read_settings(config_dir):
    return json.loads((Path(config_dir) / 'settings.json').read_text())


def flint_commands(cfg):
    out = []
    for entries in cfg.get('hooks', {}).values():
        for entry in entries:
            for h in entry.get('hooks', []):
                if 'flint-style.sh' in h.get('command', ''):
                    out.append(h['command'])
    return out


def test_install_registers_3_events_with_quoted_path_and_event_argv():
    with tempfile.TemporaryDirectory() as d:
        assert run_cli(d).returncode == 0
        cfg = read_settings(d)
        assert set(cfg['hooks']) >= set(install.EVENTS)
        for event in install.EVENTS:
            cmds = [c for e in cfg['hooks'][event] for c in
                    [h['command'] for h in e['hooks']] if 'flint-style.sh' in c]
            assert cmds == ['"{}" {}'.format(
                str(install.HOOK).replace('\\', '/'), event)]
            assert cfg['hooks'][event][0]['matcher'] == ''  # re-fires on compact


def test_install_is_idempotent_across_reruns():
    with tempfile.TemporaryDirectory() as d:
        run_cli(d)
        run_cli(d)
        assert len(flint_commands(read_settings(d))) == 3


def test_install_repoints_a_stale_clone_path():
    with tempfile.TemporaryDirectory() as d:
        stale = {'hooks': {'SessionStart': [
            {'matcher': '', 'hooks': [{'type': 'command',
             'command': '/old/vmCODE/scripts/flint-style.sh SessionStart'}]}]}}
        p = Path(d) / 'settings.json'
        p.write_text(json.dumps(stale))
        run_cli(d)
        cmds = flint_commands(read_settings(d))
        assert len(cmds) == 3
        assert not any('/old/vmCODE' in c for c in cmds)


def test_foreign_hooks_survive_install_and_uninstall():
    foreign = {'matcher': '', 'hooks': [{'type': 'command',
               'command': '/usr/local/bin/other-hook.sh'}]}
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'settings.json'
        p.write_text(json.dumps({'hooks': {'SessionStart': [foreign]},
                                 'model': 'opus'}))
        run_cli(d)
        run_cli(d, '--uninstall')
        cfg = read_settings(d)
        assert cfg['hooks']['SessionStart'] == [foreign]
        assert cfg['model'] == 'opus'
        assert flint_commands(cfg) == []


def test_registered_command_executes_end_to_end():
    # The seam real sessions take: settings.json command string -> bash ->
    # hook. On Windows the command embeds a native C:\ path that Git Bash
    # must parse inside the double quotes (caveman #157 class); asserting
    # the string alone never exercised that translation.
    bash = _find_bash()
    if not bash:
        print('     (skipped: no working bash found)')
        return
    with tempfile.TemporaryDirectory() as d:
        assert run_cli(d).returncode == 0
        cfg = read_settings(d)
        for event in install.EVENTS:
            cmds = [c for e in cfg['hooks'][event]
                    for c in [h['command'] for h in e['hooks']]
                    if 'flint-style.sh' in c]
            assert len(cmds) == 1
            r = subprocess.run([bash, '-c', cmds[0]], capture_output=True,
                               text=True, timeout=15)
            assert r.returncode == 0, (event, r.returncode, r.stderr, r.stdout)
            out = json.loads(r.stdout)
            assert out['hookSpecificOutput']['hookEventName'] == event
            ctx = out['hookSpecificOutput']['additionalContext']
            assert 'FLINT HOOK ERROR' not in ctx
            if event == 'UserPromptSubmit':
                assert ctx.startswith('**FLINT ULTRA ACTIVE**')
            else:
                assert ctx.lstrip().startswith('# CAVEMAN')


def test_uninstall_py_wrapper_removes_entries():
    with tempfile.TemporaryDirectory() as d:
        run_cli(d)
        env = dict(os.environ, CLAUDE_CONFIG_DIR=str(d), HOME=d, USERPROFILE=d)
        r = subprocess.run([sys.executable, str(ROOT / 'uninstall.py')],
                           env=env, capture_output=True, text=True)
        assert r.returncode == 0
        assert flint_commands(read_settings(d)) == []


def test_default_home_branch_without_claude_config_dir():
    # The branch real installs hit: no CLAUDE_CONFIG_DIR, settings under
    # ~/.claude. HOME (POSIX) and USERPROFILE (Windows) both point at the tmp.
    with tempfile.TemporaryDirectory() as d:
        env = {k: v for k, v in os.environ.items() if k != 'CLAUDE_CONFIG_DIR'}
        env['HOME'] = d
        env['USERPROFILE'] = d
        env['FLINT_OFFLINE'] = '1'
        env['FLINT_CLAUDE_BIN'] = str(Path(d) / 'no-claude')
        r = subprocess.run([sys.executable, str(ROOT / 'install.py')],
                           env=env, capture_output=True, text=True)
        assert r.returncode == 0
        cfg = json.loads((Path(d) / '.claude' / 'settings.json').read_text())
        assert len(flint_commands(cfg)) == 3


def test_invalid_settings_json_aborts_without_clobber():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / 'settings.json'
        p.write_text('{broken')
        r = run_cli(d)
        assert r.returncode != 0
        assert 'nothing was changed' in r.stderr
        assert p.read_text() == '{broken'


if __name__ == '__main__':
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith('test_') and callable(fn):
            try:
                fn()
                print('ok  {}'.format(name))
            except Exception:
                failed += 1
                import traceback
                traceback.print_exc()
                print('FAIL {}'.format(name))
    print('PASS' if not failed else 'FAIL ({})'.format(failed))
    sys.exit(1 if failed else 0)
