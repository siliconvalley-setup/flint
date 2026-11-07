#!/usr/bin/env node
// Refetch report (local only, the transcripts are private): what agents did after
// each tb placeholder. Per content kind of the replaced output (by its command),
// the bytes of the original, of the placeholder and of the next 3 tool results in
// the same agent, and how many of those used `tb get`. A placeholder pays when
// next3 stays well under orig (#74, #75).
// Run: node test/refetch.mjs <transcript.jsonl>...
import { readFileSync } from 'node:fs'

const vis = c => typeof c === 'string' ? c : (c ?? []).map(x => x.text ?? '').join('')
const KINDS = [[/\bdiff\b/, 'diff'], [/tb\.mjs/, 'tb'], [/\.(md|mdx)\b/, 'md'], [/\.(ts|js|mjs|cjs|py|sh|json|tsx|go|rs)\b/, 'code']]
const kind = c => KINDS.find(([re]) => re.test(c))?.[1] ?? (c.startsWith('Read ') ? 'read' : 'other')
const rows = []
for (const file of process.argv.slice(2)) {
  const calls = new Map()
  const seq = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let rec
    try {
      rec = JSON.parse(line)
    } catch {
      continue
    }
    for (const b of Array.isArray(rec.message?.content) ? rec.message.content : []) {
      if (b.type === 'tool_use') calls.set(b.id, { tool: b.name, ...b.input })
      const e = b.type === 'tool_result' ? calls.get(b.tool_use_id) : undefined
      if (e) seq.push({ e, text: vis(b.content) })
    }
  }
  seq.forEach((s, i) => {
    // Core's own preview wraps a saved output; Read numbers its lines.
    const txt = s.text.replace(/^<persisted-output>[\s\S]*?\n\n/, '').replace(/^\s*\d+→/gm, '')
    const m = /^\[tb\] (\d+) B, \d+ lines → \S+\n/.exec(txt)
    if (!m) return
    const next = seq.slice(i + 1, i + 4)
    rows.push({
      kind: kind(s.e.tool === 'Bash' ? s.e.command : `Read ${s.e.file_path}`),
      shape: /\n#\S+ {2}L\d+-\d+ {2}/.test(txt) ? 'outline' : 'excerpt',
      orig: +m[1],
      ph: Buffer.byteLength(s.text),
      next3: next.reduce((a, n) => a + Buffer.byteLength(n.text), 0),
      tbget: next.some(n => n.e.tool === 'Bash' && /tb\.mjs get/.test(n.e.command)),
    })
  })
}
const groups = new Map()
for (const r of rows) groups.set(`${r.kind} ${r.shape}`, [...(groups.get(`${r.kind} ${r.shape}`) ?? []), r])
const line = (name, rs) => {
  const sum = k => rs.reduce((a, r) => a + r[k], 0)
  return `${name.padEnd(16)} n ${String(rs.length).padStart(3)}  orig ${sum('orig')} B  placeholder ${sum('ph')} B  next3 ${sum('next3')} B`
    + `  tb get ${rs.filter(r => r.tbget).length}  next3 >= orig ${rs.filter(r => r.next3 >= r.orig).length}`
}
for (const [g, rs] of [...groups].sort((a, b) => b[1].length - a[1].length)) console.log(line(g, rs))
console.log(line('all', rows))
