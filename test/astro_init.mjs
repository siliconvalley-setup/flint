// Regression for lsp mod astro server: LSP initialize via manifest command + initializationOptions must succeed
// from a cwd without node_modules/typescript. Usage: node test/astro_init.mjs (run from any dir).
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../mods/lsp', import.meta.url))
const srv = JSON.parse(readFileSync(`${root}/.claude-plugin/plugin.json`, 'utf8')).lspServers.astro
const cmd = srv.command.replace('${CLAUDE_PLUGIN_ROOT}', root)
const p = spawn(cmd, srv.args, { stdio: ['pipe', 'pipe', 'inherit'] })
const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: process.pid, rootUri: `file://${process.cwd()}`, capabilities: {}, initializationOptions: srv.initializationOptions } })
p.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
const done = (msg, rc) => { console.log(msg); p.kill(); process.exit(rc) }
let buf = ''
p.stdout.on('data', (d) => {
  const m = (buf += d).match(/\r\n\r\n(\{.*"id":1.*\})/s)
  if (m) { const r = JSON.parse(m[1]); r.error ? done(`initialize failed: ${r.error.message}`, 1) : done('initialize ok', 0) }
})
setTimeout(() => done('initialize timeout', 2), 15000)
