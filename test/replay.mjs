#!/usr/bin/env node
// Offline replay (issue #46 acceptance; local only, the transcripts are private).
// Runs every Read and Bash result of the given transcripts through the
// token-budget mod's own eligibility rules and a real `tb put`, then reports
// eligible bytes before and after and the replacement count.
// Pass: Read after <= 50% of before, and no replaced Read under TRIGGER_B.
// A saved Bash output is reported against core's preview, what the model gets without tb.
// Run: node test/replay.mjs <transcript.jsonl>...
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eligible, TRIGGER_B } from '../mods/token-budget/hooks/register.ts'

const TB = fileURLToPath(new URL('../tools/tb.mjs', import.meta.url))
const data = mkdtempSync(join(tmpdir(), 'tb-replay-'))
const env = { ...process.env, TB_DATA_DIR: data }
const bytes = s => Buffer.byteLength(s)
let results = 0
let before = 0
let after = 0
let replaced = 0
let small = 0
let saved = 0
let savedReplaced = 0
let preview = 0
let shown = 0
let gone = 0
const visible = c => typeof c === 'string' ? c : (c ?? []).map(x => x.text ?? '').join('')

for (const file of process.argv.slice(2)) {
  const calls = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let rec
    try {
      rec = JSON.parse(line)
    } catch {
      continue
    }
    for (const b of Array.isArray(rec.message?.content) ? rec.message.content : []) {
      if (b.type === 'tool_use') calls.set(b.id, { tool: b.name, ...b.input })
      const e = b.type === 'tool_result' && !b.is_error ? calls.get(b.tool_use_id) : undefined
      if ((e?.tool !== 'Read' && e?.tool !== 'Bash') || rec.toolUseResult === undefined) continue
      results++
      const hit = eligible(e, rec.toolUseResult)
      // Core deletes a saved Bash output with its session: replay the ones still on disk.
      if (!hit) continue
      if (hit.file !== undefined && !existsSync(hit.file)) {
        gone++
        continue
      }
      const text = hit.file === undefined ? hit.text : readFileSync(hit.file, 'utf8')
      // A file read gets no placeholder: inline whole up to INLINE_MAX_B, else core's preview (#81).
      const whole = 'whole' in hit ? hit.whole : undefined
      const r = whole ? undefined : spawnSync(process.execPath, [TB, 'put', ...hit.args, '--session', 'replay'],
        { input: text, encoding: 'utf8', env, maxBuffer: 1 << 30 })
      const out = whole ? (whole(text) ? text : '') : r.status === 0 && r.stdout !== '' && hit.replace(r.stdout.replace(/\n$/, '')) ? r.stdout : ''
      if (hit.file !== undefined) {
        saved++
        preview += bytes(visible(b.content))
        shown += out ? bytes(out) : bytes(visible(b.content))
        if (out) savedReplaced++
        continue
      }
      before += bytes(text)
      after += out ? bytes(out) : bytes(text)
      if (out) replaced++
      if (out && bytes(text) < TRIGGER_B) small++
    }
  }
}

rmSync(data, { recursive: true, force: true })
const pass = before > 0 && after <= before * 0.5 && small === 0
console.log(`results ${results}  Read eligible ${before} B -> ${after} B (${(100 * after / (before || 1)).toFixed(1)}%)`
  + `  replaced ${replaced}  replaced under ${TRIGGER_B} B: ${small}  ${pass ? 'PASS' : 'FAIL'}`)
console.log(`saved Bash ${saved} (${gone} files gone)  replaced ${savedReplaced}  core preview ${preview} B -> shown ${shown} B`)
process.exitCode = pass ? 0 : 1
