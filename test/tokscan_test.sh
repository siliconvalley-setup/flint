#!/bin/sh
# tokscan suite: one seam, the CLI. Fixture config dir built by shell (native
# Windows python cannot open Git Bash POSIX paths); tokscan runs from inside
# the fixture with a RELATIVE CLAUDE_CONFIG_DIR, so no path conversion applies.
# Usage: sh test/tokscan_test.sh   (prints ok/FAIL lines, exits 1 on any FAIL)
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
FAILS=0
ck() { if [ "$1" -eq 0 ]; then echo "ok  $2"; else echo "FAIL $2"; FAILS=$((FAILS+1)); fi; }
FX="$(mktemp -d)"
P="$FX/cfg/projects/-w-flint"
mkdir -p "$P/s1/subagents"
L() { printf '%s\n' "$2" >> "$1"; }

# Main thread s1. TZ=BRT3 (UTC-3): 2026-11-07T02:30Z is local 2026-11-06,
# 2026-11-06T02:00Z is local 2026-11-05.
M="$P/s1.jsonl"
L "$M" '{"type":"user","timestamp":"2026-11-06T12:00:00Z","cwd":"/w/flint","message":{"role":"user","content":"fix the bug please"}}'
L "$M" '{"type":"assistant","timestamp":"2026-11-06T12:00:01Z","cwd":"/w/flint","message":{"id":"m1","model":"claude-opus-5-5","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"cd x && sed -n 1,9p f.md"}}],"usage":{"input_tokens":100,"cache_creation_input_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":1000},"cache_read_input_tokens":0,"output_tokens":10}}}'
L "$M" '{"type":"assistant","timestamp":"2026-11-06T12:00:02Z","cwd":"/w/flint","message":{"id":"m1","model":"claude-opus-5-5","content":[{"type":"tool_use","id":"t2","name":"Read","input":{"file_path":"/w/flint/x/f.md"}}],"usage":{"input_tokens":100,"cache_creation_input_tokens":1000,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":1000},"cache_read_input_tokens":0,"output_tokens":10}}}'
L "$M" '{"type":"user","timestamp":"2026-11-06T12:00:03Z","cwd":"/w/flint","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"0123456789012345678901234567890123456789"},{"type":"tool_result","tool_use_id":"t2","content":[{"type":"text","text":"ab"}]}]}}'
L "$M" '{"type":"assistant","timestamp":"2026-11-06T12:01:00Z","cwd":"/w/flint","message":{"id":"m2","model":"claude-opus-5-5","content":[{"type":"tool_use","id":"t3","name":"Bash","input":{"command":"timeout 30 gh pr list"}},{"type":"tool_use","id":"t4","name":"Bash","input":{"command":"cat x/f.md"}},{"type":"tool_use","id":"t5","name":"Read","input":{"file_path":"/w/flint/shot.png"}},{"type":"tool_use","id":"t6","name":"Bash","input":{"command":"A=1 rg foo ."}},{"type":"tool_use","id":"t7","name":"Bash","input":{"command":"cat > o.txt <<'"'"'EOF'"'"'\nsed -n 1p x/f.md\nEOF"}},{"type":"tool_use","id":"t8","name":"Bash","input":{"command":"B(){ agent-browser --cdp 9 \"$@\"; }; B snapshot"}},{"type":"tool_use","id":"t9","name":"Bash","input":{"command":"echo \"a && cat x/f.md"}}],"usage":{"input_tokens":10,"cache_creation_input_tokens":200,"cache_read_input_tokens":2000,"output_tokens":20}}}'
L "$M" '{"type":"user","timestamp":"2026-11-06T12:01:05Z","cwd":"/w/flint","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t3","content":"ok"},{"type":"tool_result","tool_use_id":"t4","content":"0123456789"},{"type":"tool_result","tool_use_id":"t5","content":[{"type":"image","source":{"type":"base64","data":"AAAA"}}]},{"type":"tool_result","tool_use_id":"t6","content":"x"}]}}'
L "$M" '{"type":"system","subtype":"compact_boundary","timestamp":"2026-11-06T12:02:00Z","cwd":"/w/flint"}'
L "$M" '{"type":"assistant","timestamp":"2026-11-07T02:30:00Z","cwd":"/w/flint","message":{"id":"m3","model":"claude-opus-5-5","content":[{"type":"text","text":"done"}],"usage":{"input_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1}}}'
L "$M" '{"type":"assistant","timestamp":"2026-11-06T02:00:00Z","cwd":"/w/flint","message":{"id":"m4","model":"claude-opus-5-5","content":[{"type":"text","text":"old"}],"usage":{"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0}}}'
# Subagent of s1.
S="$P/s1/subagents/agent-a1.jsonl"
printf '%s\n' '{"agentType":"code-review","description":"Fresh review"}' > "$P/s1/subagents/agent-a1.meta.json"
L "$S" '{"type":"user","timestamp":"2026-11-06T13:00:00Z","cwd":"/w/flint","isSidechain":true,"message":{"role":"user","content":"Axis: Standards"}}'
L "$S" '{"type":"assistant","timestamp":"2026-11-06T13:00:01Z","cwd":"/w/flint","isSidechain":true,"message":{"id":"m5","model":"claude-sonnet-5-5","content":[{"type":"text","text":"ok"}],"usage":{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":1000,"output_tokens":100}}}'

# Weighted units (x base input), by hand from the pricing page ratios:
#   m1 opus  100 + 1000*2 (1h write) + 10*5          = 2150
#   m2 opus  10 + 200*1.25 (no split) + 2000*0.05 + 20*5 = 460
#   m3 opus  1 + 1*5                                 = 6
#   m5 sonnet 1000*0.05 + 100*5                      = 550   -> 2026-11-06 total 3166
#   m4 opus  1000 (local 2026-11-05)                 = 1000
TZ=BRT3 "$PY" -I -c 'import sys,time; sys.exit(time.timezone != 10800)'
ck $? "17 python honors TZ=BRT3 (UTC-3; the date cases depend on it)"
run() { (cd "$FX" && TZ=BRT3 CLAUDE_CONFIG_DIR=cfg "$PY" -I "$ROOT/tools/tokscan.py" "$@"); }
run 2026-11-06 --json > "$FX/r.json"; ck $? "17a json run exits 0"
j() { "$PY" -c "import json,os,sys; d=json.load(sys.stdin); sys.exit(0 if ($1) else 1)" < "$FX/r.json" 2>&1; }

j 'd["totals"]["requests"] == 4 and d["totals"]["input"] == 111 and d["totals"]["output"] == 131'
ck $? "17b one request per message id"

j 'd["totals"]["weighted"] == 3166 and d["models"]["claude-sonnet-5-5"]["weighted"] == 550'
ck $? "17c weighted: 1 h write 2x, unsplit write 1.25x, 5.5 read 0.05x"

j 'abs(d["totals"]["usd"] - 0.011564) < 1e-9'
ck $? "17d USD from base price per model"

run 2026-11-05 --json > "$FX/r.json"
j 'd["totals"]["requests"] == 1 and d["totals"]["weighted"] == 1000'
ck $? "17e local-date filter across midnight UTC"

run 2026-11-06 --json > "$FX/r.json"
j '[(s["requests"], s["main_requests"], s["sub_requests"], s["compactions"], s["max_context"], s["weighted"], s["prompt"], s["project"], s["sub_weighted"]) for s in d["sessions"]] == [(4, 3, 1, 1, 2210, 3166, "fix the bug please", "flint", 550)]'
ck $? "17f session row: main vs subagent split, compactions, max context"

j '[(a["type"], a["model"], a["requests"], a["weighted"]) for a in d["subagents"]] == [("code-review", "claude-sonnet-5-5", 1, 550)]'
ck $? "17g subagent row from meta.json"

j 'sorted((p, b["calls"], b["chars"]) for p, b in d["bash"].items()) == [("agent-browser", 1, 0), ("cat", 2, 10), ("echo", 1, 0), ("gh", 1, 2), ("rg", 1, 1), ("sed", 1, 40)]'
ck $? "17h Bash program after cd &&, timeout N, A=1, shell function"

j 'd["categories"]["read file"] == {"calls": 5, "chars": 52, "tokens": 13, "images": 1} and d["categories"]["github"]["calls"] == 1 and d["categories"]["search"]["calls"] == 1'
ck $? "17i categories: Read + sed/cat in read file, image counted"

j 'd["rereads"] == [{"session": "-w-flint/s1", "path": os.path.normpath("/w/flint/x/f.md"), "count": 3}]'
ck $? "17j re-read >= 3 per session (Read, sed -n, cat; cd and cwd resolved; heredoc body and unparsable quote ignored)"

j '(d["largest"][0]["chars"], d["largest"][0]["tool"]) == (40, "Bash:sed")'
ck $? "17k largest tool result first"

run --compare 2026-11-05 2026-11-06 --json > "$FX/r.json"
j 'd["a"]["totals"]["weighted"] == 1000 and d["b"]["totals"]["weighted"] == 3166 and d["delta"]["weighted"] == 2166 and d["delta"]["requests"] == 3 and d["delta"]["subagent weighted"] == 550 and d["delta"]["read file calls"] == 5'
ck $? "17l compare deltas (B - A), metric absent in A counts 0"
run --compare 2026-11-06 2026-11-05 --json > "$FX/r.json"
j 'd["delta"]["read file calls"] == -5'
ck $? "17l2 compare: metric absent in B counts 0"
run --compare 2026-11-05 2026-11-06 > "$FX/c.txt"
grep -q '^weighted .* +2,166' "$FX/c.txt"; ck $? "17m compare text shows delta"

# --json parity: every value the JSON holds for the headline rows is printed as text.
run 2026-11-06 > "$FX/r.txt"; ck $? "17n text run exits 0"
run 2026-11-06 --json > "$FX/r.json"
"$PY" -c 'import json,sys; d=json.load(sys.stdin); t=d["totals"]; w, u, h = t["weighted"], t["usd"], t["cache_write_1h"]
print("\n".join([f"{w:,.0f}", f"{u:.4f}", f"{h:,}"]
 + [s["prompt"] for s in d["sessions"]] + [a["type"] for a in d["subagents"]]
 + [r["path"] for r in d["rereads"]] + list(d["bash"]) + list(d["categories"])))' < "$FX/r.json" > "$FX/want.txt"
tr -d '\r' < "$FX/want.txt" > "$FX/want.lf"   # Windows python writes CRLF
MISS=0; while IFS= read -r w; do grep -qF -- "$w" "$FX/r.txt" || { echo "  missing in text: $w"; MISS=1; }; done < "$FX/want.lf"
[ -s "$FX/want.txt" ] && [ "$MISS" -eq 0 ]; ck $? "17o --json parity with text"

run 2026-11-06 --no-prompts > "$FX/r.txt"
! grep -qF -e 'fix the bug please' -e 'sed -n 1,9p' -e 'Fresh review' "$FX/r.txt"; ck $? "17p --no-prompts hides prompt and input previews"

# Batching: main s2 on local 2026-11-08, one call per request. Runs of read-only
# requests: m21-m23 and m27-m28; write redirect (with heredoc) and sed -i end a run;
# s2's subagent request between m21 and m22 runs on its own.
M2="$P/s2.jsonl"
mkdir -p "$P/s2/subagents"
R() { L "$M2" '{"type":"assistant","timestamp":"2026-11-08T12:00:'"$1"'Z","cwd":"/w/flint","message":{"id":"m'"$1"'","model":"claude-opus-5-5","content":['"$2"'],"usage":{"input_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":'"$3"',"output_tokens":1}}}'; }
B() { printf '{"type":"tool_use","id":"u%s","name":"Bash","input":{"command":"%s"}}' "$1" "$2"; }
R 21 '{"type":"tool_use","id":"u21","name":"Read","input":{"file_path":"/w/flint/a.md"}}' 0
L "$P/s2/subagents/agent-a2.jsonl" '{"type":"assistant","timestamp":"2026-11-08T12:00:21Z","cwd":"/w/flint","isSidechain":true,"message":{"id":"m40","model":"claude-sonnet-5-5","content":[{"type":"tool_use","id":"u40","name":"Read","input":{"file_path":"/w/flint/z.md"}}],"usage":{"input_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1}}}'
R 22 "$(B 22 'rg -n foo src | head -5')" 0
R 23 "$(B 23 'cat a.md b.md; echo ----; sed -n 1,9p c.md')" 1000
R 24 "$(B 24 'cat > o.txt <<EOF\nx\nEOF')" 0
R 25 "$(B 25 'sed -i s/a/b/ f.md')" 0
R 26 "$(B 26 'ls > list.txt')" 0
R 27 "$(B 27 'ls 2>/dev/null; head -3 a.md 2>&1')" 0
R 28 '{"type":"tool_use","id":"u28","name":"Read","input":{"file_path":"/w/flint/b.md"}}' 2000
R 29 '{"type":"text","text":"done"}' 0
run 2026-11-08 --json > "$FX/r.json"
j 'd["batching"] == {"tools_per_request": {"0": 1, "1": 9}, "read_runs": 2, "batchable_requests": 3, "batchable_cache_read_weighted": 150}'
ck $? "17q batching: runs of one-call read-only requests per agent; write redirect, sed -i end a run; cache read 0.05x"
run 2026-11-08 > "$FX/r.txt"
grep -q '^runs of one-call read-only requests: 2 runs, 3 batchable requests, cache read 150 weighted' "$FX/r.txt"; ck $? "17r batching line in text"

rm -rf "$FX"
[ "$FAILS" -eq 0 ]
