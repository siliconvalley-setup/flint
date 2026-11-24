---
type: Guide
title: Ruleset design
description: How to write injected rulesets LLMs follow — fix patterns from upstream prose-rule history.
tags: [guide, ruleset]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-07T16:26:14Z }
sources:
  - id: caveman
    resource: https://github.com/JuliusBrussee/caveman
    title: caveman prose-rule fix history (audited 2026-07)
  - id: ponytail
    resource: https://github.com/DietrichGebert/ponytail
    title: ponytail prose-rule fix history (audited 2026-07)
---

# Ruleset design

Generic rules for text a hook injects.[^caveman][^ponytail] flint artifact + provenance: [ruleset](../style-core/ruleset.md). Delivery side: [hook engineering](./hook-engineering.md).

## Wording = code

- **Benchmark-validated directives stay verbatim.** ponytail #245: shared-helper bug-fix trap, baseline fixed root cause 1/6, ponytail 6/6; commit: "Plain prose ('trace the flow') did not move it; the actionable, lazy-framed directive did." Paraphrase discards tuning. Ship provenance table (rule → bug/benchmark).
- **Keep reason inside rule.** caveman `dc95e91` removed abbreviations/arrows with measured reason ("tokenizer splits them the same as the full word: zero tokens saved"). Bare ban invites re-derivation.
- **Compressing ruleset text breeds ambiguity bugs.** caveman `fbfe83b` cut ruleset ~40%; every later prose fix (#238/#239/#445/#468/#322) re-expanded it. Simplify structure (duplicates, levels, meta); keep wording of rules that cost a bug.

## Fix patterns

- **Exclusions inline.** caveman #238: "abbreviation applies to prose only, never to code symbols" had to sit inside compression rule; distant Boundaries section → model wrote literal `fn` in code.
- **Never advertise mechanism that does not exist.** ponytail #161/#162: "Off only: 'stop ponytail'" + prompt parse → "add a normal mode toggle" deactivated mode. Fixed-point ruleset: zero switch/level/command language.
- **No self-reference; disambiguate lookalikes.** caveman #469: model announced mode, double-answered. Marker sharing name with other rule (e.g. code-comment marker) → state marker is source-comment-only.
- **Scope markers narrowly.** ponytail #120: "mark intentional simplifications" over-applied ~6 months. Fix: "cuts a real corner with a known ceiling" + name ceiling and upgrade path + explicit negative ("Ordinary simple code is not a corner cut. Do not mark it."). Positive + explicit negative beats positive alone.
- **Name banned behaviors.** caveman #322: generic terseness did not stop tool-call narration, decorative tables, log dumps; each named. #714: ban alone not enough; state positive default (call tool directly when safe) + explicit exceptions.
- **Language preservation explicit.** caveman #445: Portuguese users got English until "Compress the style, not the language".
- **Pin safety carve-outs.** ponytail `99139a2`: never-simplify list (trust-boundary validation, data-loss error handling, security, accessibility) in drift canary ("could drift silently"). Auto-clarity triggers (security warnings, irreversible confirmations, ambiguous multi-step order) stay list with concrete example ("migrate table drop column backup first"), caveman #239.
- **Position matters.** ponytail #217/#281: "reuse what's in this codebase" rung missing; fix put it rung 2, before stdlib, with "look before you write", pinned as CI invariant.

## Upstream shape

caveman/ponytail shape (flint used it until `9f5a8f4`, 2026-11-02; current `flint.md` = one `<important>` token-economy line, see [ruleset](../style-core/ruleset.md#history)):

1. One-line identity.
2. Prose rules with inline exclusions + one Not/Yes example pair.
3. Code rules: actionable ladder, root-cause directive, marker rule with explicit negative, one worked example.
4. Never-compress / never-simplify carve-outs, pinned list.
5. Escape hatch as behavior, not mechanism ("User insists on the full version? Build it. No re-arguing.").

Persistence assertion and intensity tiers allowed only as calibration text model self-selects from; never as mechanism request can flip (ponytail #161/#162). Merge of two rulesets: keep validated wording; resolve conflicts by adopting one wording, not re-prosing.

## Per-turn anchor

Upstream advice: short, static, hardcoded in hook, never read from ruleset file (file problem must not kill anchor); content = most-violated rules + safety boundary; re-sync by hand. flint deviates since 2026-11-03: anchor = `flint-submit.md`, full copy of `flint.md`, same loud marker on failure ([hook](../style-core/hook.md#events)).

[^caveman]: caveman prose-rule fix history
[^ponytail]: ponytail prose-rule fix history
