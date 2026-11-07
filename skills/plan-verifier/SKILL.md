---
name: plan-verifier
description: "Gate a drafted plan, spec, or ticket through blind plan-verifier audits: re-confront each finding, fix its root at the origin, re-audit, stop at READY or two loops. Use once a plan or spec is drafted, before implementation."
---

# plan-verifier

Gate a drafted plan, spec, or ticket through **blind** `plan-verifier` audits until it comes back **READY**. The agent diagnoses: root cause and a grounded fix per blocker. You own the verdict on each finding and every write. A blind audit knows nothing of prior audits, why the artifact changed, or the outcome you want. That blindness is the whole value: a primed audit rubber-stamps.

## The loop

1. **Launch a blind audit.** Spawn the `plan-verifier` agent with the artifact (inline or path) and the source paths it leans on. Pass nothing else: no prior findings, revisions, or expected verdict.
2. **Read the verdict.**
   - **READY** → stop. Wait for instructions; continue only when told.
   - **REVISE** → step 3.
3. **Re-confront each blocker.** The report is a hypothesis. Open its Evidence and Root cause `file:line` yourself; re-run its doc query. Low confidence → do the check the agent could not. Decide one:
   - **confirmed** → step 4 with its root;
   - **reframed** → the real root differs; step 4 with your root;
   - **rejected** → the evidence fails first-hand; write the decision and its evidence into the artifact, so the next blind audit sees it.

   *Done when:* every blocker has a decision backed by a `file:line` or doc you opened this session.
4. **Fix at the origin.** Edit where the false claim starts: the spec a plan copies, the ADR a spec cites (amend, never delete), the glossary term, the ticket body. Then `rg` every other place the same assumption lives and fix each one. Adopt the agent's Fix only after you check its pattern or doc. Same root in two loops → redesign, don't patch: design from the job (smallest surface first), write the threat model, verify each CLI fact via `--help`, cite each codebase claim as `file:line`.

   **Write scope:** when your caller limits edits to the artifact, fix only the artifact. A root or sibling outside it becomes a question to the caller, naming the origin `file:line` and its evidence.

   *Done when:* every confirmed root is fixed at its origin or raised as a question; each fix meets its Acceptance check; `rg` finds no sibling in scope.
5. **Re-audit.** Launch a fresh blind audit on the revised artifact. Repeat from step 2.

**Cap:** stop after 2 REVISE, READY or not.

## Completion criterion

A blind audit returns READY, or 2 REVISE loops are spent; every blocker got a first-hand decision, and every fix landed at its origin, not on the flagged line alone.
