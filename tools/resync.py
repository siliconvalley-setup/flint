#!/usr/bin/env python3
"""Regenerate the verbatim derivados from flint.md (byte-exact).

    resync.py           rewrite desktop/cowork/SKILL.md
    resync.py --check   exit 1 if it differs from header + unwrap(flint.md)

The header here is the source of truth for the derivado header; the body
is always unwrap(flint.md). Hand-edits are overwritten by design (docs/style-core/ruleset.md:
derivados are REGENERATED, never hand-patched). desktop/chat/project-instructions.md
is NOT in this set — it's a hand-derived (condensed) artifact like style.md/
profile.md, not byte-parity-checked (it must fit an 8,000-char cap flint.md
alone already exceeds).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from unwrap import unwrap  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

HEADERS = {
    ROOT / 'desktop' / 'cowork' / 'SKILL.md': (
        '---\n'
        'name: flint\n'
        'description: >\n'
        '  Terse prose and minimal lazy code ruleset. Use in EVERY conversation that\n'
        '  writes, reviews, or discusses code or technical answers — and whenever the\n'
        '  user mentions flint, terse output, compressed replies, lazy code, minimal\n'
        '  diffs, or complains about verbosity. Load at conversation start when in\n'
        '  doubt: this is a standing style policy, not a task skill.\n'
        '---\n'
    ),
}


def read_lf(path):
    return path.read_bytes().decode('utf-8').replace('\r\n', '\n')


def main(argv):
    check = '--check' in argv
    body = unwrap(read_lf(ROOT / 'flint.md'))
    stale = []
    for path, header in HEADERS.items():
        want = header + '\n' + body
        if read_lf(path) != want:
            if check:
                stale.append(str(path.relative_to(ROOT)))
            else:
                path.write_bytes(want.encode('utf-8'))
    if stale:
        print('resync needed: {}'.format(', '.join(stale)))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
