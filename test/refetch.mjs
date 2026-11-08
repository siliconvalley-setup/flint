#!/usr/bin/env node
// Refetch report (local only, the transcripts are private): does keeping a large
// tool output out of context pay? Covers each Bash output Claude Code saved to a
// file (core preview) and each tb placeholder (Bash or Read). Estimate, in base
// input-token units (4 bytes = 1 token), against the output inline whole:
//   saved = (original - shown) × (1.25 + 0.1 × later turns of that agent)
//   cost  = per follow-up on the same source in the next 4 results:
//           one more turn (0.1 × context) + its bytes × the same factor
// A follow-up = a call that names the saved file, the tb ref, any tool-results
// file or a file of the command. Shortcut: counts follow-ups an inline output
// would also have had (an Edit's Read), so it leans against keeping out.
// Run: node test/refetch.mjs <transcript.jsonl>...
import { readFileSync } from 'node:fs'

const vis = c => typeof c === 'string' ? c : (c ?? []).map(x => x.text ?? '').join('')
const UNIT = { B: 1, KB: 1024, MB: 1 << 20 }
const rows = []
for (const file of process.argv.slice(2)) {
  const calls = new Map()
  const seq = []
  let ctx = 0
  let turn = 0
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let rec
    try {
      rec = JSON.parse(line)
    } catch {
      continue
    }
    const u = rec.message?.usage
    if (rec.type === 'assistant') turn++
    if (rec.type === 'assistant' && u) ctx = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
    for (const b of Array.isArray(rec.message?.content) ? rec.message.content : []) {
      if (b.type === 'tool_use') calls.set(b.id, { tool: b.name, ...b.input, ctx, turn })
      const e = b.type === 'tool_result' ? calls.get(b.tool_use_id) : undefined
      if (e) seq.push({ e, text: vis(b.content) })
    }
  }
  seq.forEach((s, i) => {
    const cmd = s.e.tool === 'Bash' ? s.e.command : `${s.e.tool} ${s.e.file_path ?? ''}`
    if (/tb\.mjs/.test(cmd)) return
    // Read numbers its lines; core wraps a saved output in its preview.
    const text = s.text.replace(/^\s*\d+[→\t]/gm, '')
    const tb = /^\[tb\] (\d+) B, \d+ lines → (\S+)/.exec(text.replace(/^<persisted-output>[\s\S]*?\n\n/, ''))
    const core = s.e.tool === 'Bash' && /^<persisted-output>\nOutput too large \(([\d.]+)(B|KB|MB)\)[\s\S]*?saved to: (\S+)/.exec(s.text)
    if (!tb && !core) return
    const orig = tb ? +tb[1] : core[1] * UNIT[core[2]]
    const names = [tb?.[2], core?.[3]?.split('/').pop(), ...(cmd.match(/[\w./-]+\.\w+/g) ?? []).map(p => p.split('/').pop())].filter(Boolean)
    const follow = seq.slice(i + 1, i + 5).filter(n => {
      const c = n.e.tool === 'Bash' ? n.e.command : `${n.e.tool} ${n.e.file_path ?? ''}`
      return /tool-results/.test(c) || names.some(x => c.includes(x))
    })
    const life = 1.25 + 0.1 * (turn - s.e.turn)
    const shown = Buffer.byteLength(s.text) / 4
    const fetched = follow.reduce((a, n) => a + Buffer.byteLength(n.text), 0) / 4
    rows.push({
      group: `${tb ? `tb ${s.e.tool}` : 'core preview'} ${orig < 16384 ? '<16K' : orig < 32768 ? '16-32K' : '>=32K'}`,
      follow: follow.length,
      net: (orig / 4 - shown) * life - follow.length * 0.1 * s.e.ctx - fetched * life,
    })
  })
}
const groups = new Map()
for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
console.log('group                 n  follow-ups/out  net/out (tokens)  net < 0')
for (const [g, rs] of [...groups].sort()) {
  const sum = k => rs.reduce((a, r) => a + r[k], 0)
  console.log(`${g.padEnd(20)} ${String(rs.length).padStart(3)}  ${(sum('follow') / rs.length).toFixed(2).padStart(14)}  ${String(Math.round(sum('net') / rs.length)).padStart(16)}  ${rs.filter(r => r.net < 0).length}`)
}
