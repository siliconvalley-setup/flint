#!/usr/bin/env bash
# statusline-usage.sh — Claude Code statusline: model · effort + folder @ host + context usage
# + plan session (5h) + weekly (7d) + prompt-cache state. Reads the JSON from
# stdin (no network, only python3/date). Each section renders only when the data
# exists: rate_limits appears for Pro/Max plans after the 1st API response; effort
# appears only when the model supports it; prompt_cache (CLI v2.1.251+) always
# shows its state — hot with time left until cold, or cold with the rewrite
# size. The countdown ticks via statusLine.refreshInterval (seed + mirror set it).
# Last-turn cache split (context_window.current_usage): hit = read/(read+write),
# ccstatusline's turn scope — a low hit shows a cache rewrite at once.
# (caveman, the style ruleset, is a hook with no state — nothing to badge.)
#
# Format: one line, " │ " between segments, short dim labels, colored values, no
# emoji. Detail shows only when actionable (cold → rewrite cost; hit when cacheable).
#   Opus 5.5 (1M context) · high │ vmCODE @ M5AIR │ context 100k/1000k (10%) │ session 42% ↺2h10m │ week 30% ↺Fri 08:49 │ cache hot 30m · hit 95%

ESC=$'\e'
C_RST="${ESC}[0m"

CTX_JSON=$(cat 2>/dev/null)

# Single parse: tab-separated tokens; "-" = absent field (keeps positions). Tabs
# because model/dir names hold spaces ("Opus 5.5 (1M context)"); sanitize drops tabs.
vals=$(printf '%s' "$CTX_JSON" | python3 -c '
import json, sys, datetime, re
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
cw = d.get("context_window") or {}
fh = (d.get("rate_limits") or {}).get("five_hour") or {}
sd = (d.get("rate_limits") or {}).get("seven_day") or {}
def numeric(v):  return isinstance(v, (int, float)) and not isinstance(v, bool)
def num(v):  return str(int(v + 0.5)) if numeric(v) and v >= 0 else "-"   # half-up (not banker)
def raw(v):  return str(int(v))       if numeric(v) else "-"
w7r = sd.get("resets_at")
try:
    w7l = datetime.datetime.fromtimestamp(int(w7r)).strftime("%a %H:%M") if numeric(w7r) else "-"
except (ValueError, OverflowError, OSError):
    w7l = "-"
w7l = re.sub(r"[^a-zA-Z0-9: /-]", "", w7l) or "-"
# model.display_name and effort.level — sanitize to avoid escape injection
mdl = str((d.get("model") or {}).get("display_name") or "-")
mdl = " ".join(re.sub(r"[^a-zA-Z0-9._() -]", "", mdl).split()) or "-"
eff = str((d.get("effort") or {}).get("level") or "-")
eff = re.sub(r"[^a-zA-Z0-9_-]", "", eff) or "-"
# workdir: basename of the session cwd — sanitize to avoid escape injection
ws = str((d.get("workspace") or {}).get("current_dir") or d.get("cwd") or "").rstrip("/")
wd = " ".join(re.sub(r"[^\w.()+@ -]", "", ws.rsplit("/", 1)[-1]).split()) or "-"
# prompt_cache (CLI v2.1.251+): warm/cold + when it goes cold + cold-rewrite size.
pc = d.get("prompt_cache") or {}
pcw = pc.get("warm")
pcw = "1" if pcw is True else ("0" if pcw is False else "-")
# current_usage: last API request only; null before the 1st response.
cu = cw.get("current_usage")
cu = cu if isinstance(cu, dict) else {}
print(raw(cw.get("total_input_tokens") or 0), raw(cw.get("context_window_size") or 0),
      num(cw.get("used_percentage")), num(fh.get("used_percentage")), raw(fh.get("resets_at")),
      num(sd.get("used_percentage")), raw(sd.get("resets_at")), w7l, eff,
      pcw, raw(pc.get("expires_at")), raw(pc.get("recache_tokens_if_cold")),
      raw(cu.get("cache_read_input_tokens")), raw(cu.get("cache_creation_input_tokens")),
      mdl, wd, sep="\t")
' 2>/dev/null)
# No usage data (empty/invalid stdin): nothing to render.
[ -z "$vals" ] && exit 0
IFS=$'\t' read -r CTX_USED CTX_MAX CTX_PCT RL_PCT RL_RESETS W7_PCT _ W7_LABEL EFFORT_LEVEL PC_WARM PC_EXP PC_RE CU_R CU_W MODEL_NAME WORKDIR <<EOF
$vals
EOF

pct_color() {  # $1 = pct (int or "-"); $2 = base color (default 245 gray); 80=red, 60=orange
  if   [ "$1" != "-" ] && [ "$1" -ge 80 ] 2>/dev/null; then printf '%s' "${ESC}[38;5;196m"
  elif [ "$1" != "-" ] && [ "$1" -ge 60 ] 2>/dev/null; then printf '%s' "${ESC}[38;5;214m"
  else printf '%s' "${ESC}[38;5;${2:-245}m"; fi
}
# Palette (ccstatusline-style minimalist: dim labels, colored values, no emoji).
C_BLU="${ESC}[1;38;5;75m" # bold blue — model
C_DIM="${ESC}[38;5;245m"  # gray — labels, host, secondary values
C_SEP="${ESC}[38;5;238m"  # dark gray — separator
C_GRN="${ESC}[38;5;71m"; C_ORG="${ESC}[38;5;214m"; C_RED="${ESC}[38;5;196m"
HOST=$(hostname -s 2>/dev/null | tr -cd 'a-zA-Z0-9._-')
NOW=$(date +%s)

OUT=""
addseg() { OUT="${OUT}${OUT:+ ${C_SEP}│${C_RST} }$1"; }  # " │ " between segments
DOT=" ${C_DIM}·${C_RST} "                                  # separator inside a segment
lbl() { printf '%s' "${C_DIM}$1${C_RST} "; }               # dim label + space
tok() { [ "$1" -ge 1000 ] && printf '%sk' "$(( $1 / 1000 ))" || printf '%s' "$1"; }
ago() {  # $1 = seconds → 2h10m · 42m · <1m
  if   [ "$1" -ge 3600 ]; then printf '%sh%sm' "$(( $1 / 3600 ))" "$(( ($1 % 3600) / 60 ))"
  elif [ "$1" -ge 60 ];   then printf '%sm' "$(( $1 / 60 ))"
  else printf '<1m'; fi
}

# --- Model · effort ---
if [ "$MODEL_NAME" != "-" ]; then
  seg="${C_BLU}${MODEL_NAME}${C_RST}"
  [ "$EFFORT_LEVEL" != "-" ] && seg="${seg}${DOT}${EFFORT_LEVEL}"
  addseg "$seg"
fi

# --- folder @ host (host == container name on Apple Container) ---
if [ "$WORKDIR" != "-" ] && [ -n "$HOST" ]; then addseg "${WORKDIR} ${C_DIM}@ ${HOST}${C_RST}"
elif [ "$WORKDIR" != "-" ]; then addseg "$WORKDIR"
elif [ -n "$HOST" ]; then addseg "${C_DIM}${HOST}${C_RST}"; fi

# --- Context: used/max (pct). Color by absolute tokens used, not pct — the same
# on a 200k or 1M window, on the handoff mod meter scale: blue ≤250k, yellow ≤275k,
# orange ≤300k, red >300k. ---
ctx_color() {
  if   [ "$1" -gt 300000 ]; then printf '%s' "$C_RED"
  elif [ "$1" -gt 275000 ]; then printf '%s' "$C_ORG"
  elif [ "$1" -gt 250000 ]; then printf '%s' "${ESC}[38;5;226m"
  else printf '%s' "${ESC}[38;5;81m"; fi
}
if [ "$CTX_USED" != "-" ] && [ "$CTX_USED" -gt 0 ] 2>/dev/null && [ "$CTX_MAX" -gt 0 ] 2>/dev/null; then
  seg="$(lbl context)$(ctx_color "$CTX_USED")$((CTX_USED/1000))k/$((CTX_MAX/1000))k"
  [ "$CTX_PCT" != "-" ] && seg="${seg} (${CTX_PCT}%)"
  addseg "${seg}${C_RST}"
fi

# --- Plan session (5h window) ---
if [ "$RL_PCT" != "-" ]; then
  seg="$(lbl session)$(pct_color "$RL_PCT" 141)${RL_PCT}%${C_RST}"
  if [ "$RL_RESETS" != "-" ] && [ $(( RL_RESETS - NOW )) -gt 0 ] 2>/dev/null; then
    seg="${seg} ${C_DIM}↺$(ago $(( RL_RESETS - NOW )))${C_RST}"
  fi
  addseg "$seg"
fi

# --- Weekly (7d window): pct + reset day and time ---
if [ "$W7_PCT" != "-" ]; then
  seg="$(lbl week)$(pct_color "$W7_PCT" 71)${W7_PCT}%${C_RST}"
  [ "$W7_LABEL" != "-" ] && seg="${seg} ${C_DIM}↺${W7_LABEL}${C_RST}"
  addseg "$seg"
fi

# --- Prompt cache: state + last-turn hit rate, one segment.
# hot <m>  time left until cold (orange ≤2min) · cold · rewrite ~<n>k  COLD (or hot
# past expiry) + cold-rewrite size · hit <pct>%  last turn (context_window.current_usage),
# read/(read+write), green ≥80, orange ≥50, silent when read+write=0. ---
seg=""
cdiff="-"
[ "$PC_WARM" = "1" ] && [ "$PC_EXP" != "-" ] && cdiff=$(( PC_EXP - NOW ))
if [ "$PC_WARM" = "0" ] || { [ "$cdiff" != "-" ] && [ "$cdiff" -le 0 ]; }; then
  seg="${C_RED}cold${C_RST}"
  [ "$PC_RE" != "-" ] && [ "$PC_RE" -gt 0 ] 2>/dev/null && seg="${seg}${DOT}$(lbl rewrite)${C_RED}~$(tok "$PC_RE")${C_RST}"
elif [ "$PC_WARM" = "1" ]; then
  seg="${C_GRN}hot${C_RST}"
  if [ "$cdiff" != "-" ]; then
    [ "$cdiff" -le 120 ] && col="$C_ORG" || col="$C_GRN"
    seg="${seg} ${col}$(ago "$cdiff")${C_RST}"
  fi
fi
if [ "$CU_R" != "-" ] || [ "$CU_W" != "-" ]; then
  [ "$CU_R" = "-" ] && CU_R=0; [ "$CU_W" = "-" ] && CU_W=0
  cden=$(( CU_R + CU_W ))
  if [ "$cden" -gt 0 ]; then
    hit=$(( (CU_R * 200 / cden + 1) / 2 ))   # half-up, like num() above
    if   [ "$hit" -ge 80 ]; then col="$C_GRN"
    elif [ "$hit" -ge 50 ]; then col="$C_ORG"
    else col="$C_RED"; fi
    seg="${seg}${seg:+$DOT}$(lbl hit)${col}${hit}%${C_RST}"
  fi
fi
[ -n "$seg" ] && addseg "$(lbl cache)${seg}"

printf '%s' "$OUT"
