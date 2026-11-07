#!/usr/bin/env node
// Offline replay (issue #46 acceptance; local only, the transcripts are private).
// Runs every Read and Bash result of the given transcripts through the
// token-budget mod's own eligibility rules and a real `tb put`, then reports
// eligible bytes before and after and the replacement count.
// Pass: after <= 50% of before, and no replaced result under TRIGGER_B.
// Run: node test/replay.mjs <transcript.jsonl>...
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

for (const file of process.argv.slice(2)) {
  const calls = new Map()
  const boundedPersisted = new Set()
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
      const hit = eligible(e, rec.toolUseResult, boundedPersisted)
      if (!hit) continue
      const r = spawnSync(process.execPath, [TB, 'put', ...hit.args, '--session', 'replay'],
        { input: hit.text, encoding: 'utf8', env, maxBuffer: 1 << 30 })
      const out = r.status === 0 ? r.stdout : ''
      before += bytes(hit.text)
      after += out ? bytes(out) : bytes(hit.text)
      if (out) replaced++
      if (out && bytes(hit.text) < TRIGGER_B) small++
    }
  }
}

rmSync(data, { recursive: true, force: true })
const pass = before > 0 && after <= before * 0.5 && small === 0
console.log(`results ${results}  eligible ${before} B -> ${after} B (${(100 * after / (before || 1)).toFixed(1)}%)`
  + `  replaced ${replaced}  replaced under ${TRIGGER_B} B: ${small}  ${pass ? 'PASS' : 'FAIL'}`)
process.exitCode = pass ? 0 : 1
