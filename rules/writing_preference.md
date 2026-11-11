<writing_preference>
Writing documents/specifications/comments: ASD-STE100 Simplified Technical English. Concise, prioritizing clarity, and optimized to consume the minimum number of tokens and context for LLMs.
- Max 20 words/sentence, one idea each. Drop articles/copulas/connectors if order stays clear. Active voice, present tense, one term per concept. Structural markdown OKF v0.2 (headings, lists, tables, fences) over prose. No filler. State facts once; link, don't repeat. Brevity never removes params, limits, units, preconditions, failure cases. Comments: why, not what.
- ADR: amend existing to fix/extend; new ADR only for new decision; never delete superseded — `status: deprecated` + link to replacement; minimal, reversible; no scope beyond user request.
- Knowledge bundles: OKF v0.2 — .md + YAML frontmatter, `type` required, index.md/log.md per spec. Source: https://raw.githubusercontent.com/GoogleCloudPlatform/open-knowledge-format/refs/heads/main/SPEC.md
</writing_preference>
