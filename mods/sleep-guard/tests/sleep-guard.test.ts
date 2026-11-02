import { expect, test, type Engine } from 'claude-code/testing'

function bash($: Engine, command: string, background?: boolean) {
  return $.tool.call({ tool: 'Bash' as const, command, ...(background === undefined ? {} : { run_in_background: background }) })
}

test('a foreground Bash led by sleep ≥ 25 s is denied, the rest runs', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }))
  const denied = ['sleep 60 && gh run view 1', 'sleep 120; tail log', 'sleep 300', 'sleep 30.5', '  sleep 25 | cat', 'sleep 40\necho x']
  const allowed = ['sleep 2 && x', 'sleep 24', 'until grep -q ok log; do sleep 5; done', 'echo a; sleep 60', 'sleep 1m', 'sleeper 60']
  for (const c of denied) expect((await bash($, c)).deny, c).toContain('Not run')
  for (const c of allowed) expect((await bash($, c)).deny, c).toBeUndefined()
  expect((await bash($, 'sleep 300', true)).deny).toBeUndefined()
})

test('a read of a live agent transcript is denied, foreground or background', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }))
  on('agent.list', () => ({
    value: [
      { id: 'a1', description: '', type: 'Explore', status: 'running' as const },
      { id: 'a2', description: '', type: 'Explore', status: 'completed' as const },
    ],
  }))
  const deny = 'tasks/a1.output is the transcript of agent a1, not a log.'
  const denied = ['until [ -s /tmp/claude-501/p/s/tasks/a1.output ]; do sleep 5; done', 'cat /tmp/claude-501/p/s/tasks/a1.output | tail -3']
  // a Bash task's output, a plain log, an ended agent's transcript
  const allowed = ['tail -5 /tmp/claude-501/p/s/tasks/b95jrqxe3.output', 'until rg -q DONE /tmp/x.log; do sleep 5; done', 'tail -5 /tmp/claude-501/p/s/tasks/a2.output']
  for (const c of denied) expect((await bash($, c)).deny, c).toContain(deny)
  for (const c of allowed) expect((await bash($, c)).deny, c).toBeUndefined()
  expect((await bash($, 'cat /tmp/claude-501/p/s/tasks/a1.output', true)).deny).toContain(deny)
})

test('pkill -f or a looped pgrep -f whose pattern matches its own shell is denied', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }))
  const denied = [
    ["pkill -f 'node chk.mjs'", 'node chk.mjs'],
    ["pkill -f /tmp/cap/proxy.mjs; cat > /tmp/x <<'EOF'", '/tmp/cap/proxy.mjs'],
    ["until ! pgrep -f 'pnpm build' >/dev/null; do sleep 10; done", 'pnpm build'],
    ["pkill -f '[n]ode x'; node x &", '[n]ode x'],
  ] as const
  const allowed = ["pkill -f '[n]ode /tmp/cap/proxy'", 'pgrep -af node', 'pkill node']
  for (const [c, pattern] of denied) expect((await bash($, c)).deny, c).toContain(`'${pattern}' matches this call's own shell`)
  for (const c of allowed) expect((await bash($, c)).deny, c).toBeUndefined()
  expect((await bash($, "pkill -f 'node chk.mjs'", true)).deny).toContain("'node chk.mjs' matches this call's own shell")
})
