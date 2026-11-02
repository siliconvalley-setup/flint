---
name: docs-refactor
disable-model-invocation: true
description: "refactor all docs.md file to follow progressive disclosure principles"
---
I want you to refactor all docs markdown files to follow OKF format + progressive disclosure principles (https://okf.md/examples/). Use /okf-open-knowledge-format skill for this task.

Follow these steps:

1. **Find contradictions**: Identify any instructions that conflict with each other. Remove prose. Drop articles, copulas, connectives when order stays clear. Compress each document for LLM-only use. Investigate the source of the truth and raise doubts only when they are genuine and only the owner can answer them.

2. **Identify the essentials**: Extract only what belongs in the root README.md:
   - One-sentence project description
   - Package manager (if not npm)
   - Non-standard build/typecheck commands
   - Anything truly relevant to every single task

3. **Group the rest**: Organize remaining instructions into OKF logical categories (e.g., TypeScript conventions, testing patterns, API design, Git workflow). For each group, create a separate markdown file.

4. **Create the file OKF structure**: Output:
   - A minimal root README.md with markdown links to the separate files
   - Each separate file with its relevant instructions
   - A suggested docs/ folder structure

5. **Flag for deletion**: Identify any instructions that are:
   - Redundant (the agent already knows this)
   - Too vague to be actionable
   - Overly obvious (like "write clean code")
   - Stales instructions
6. **Limits files**
   - Max 2000 words per docs.
   - Max 200 lines per docs.
   - Max 20kb per docs.