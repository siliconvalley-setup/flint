---
name: strategy-prep
description: aviato strategy prep: run a site's paid research, write sites/<site>/strategy-draft.md from the template, pass `aviato strategy check --draft`, blind-audit its claims before the owner's strategy session.
disable-model-invocation: true
---

Prep session of aviato (repo `realroboto/aviato`) for one site, before its strategy session. No owner time: you run the research, write the draft, and audit it. Code picks the calls and checks the form; the audit checks the claims; the owner judges in the strategy session. `METHOD.md` rules apply to every claim: each one names its source, or it is a ⚠️ hipótese.

Run from the aviato checkout (the folder with `METHOD.md` and `sites/`), on `main`. Site = the id the owner gave (`CB`, `PZ`). A `sites/<site>/strategy-draft.md` from a cut session exists → continue from it at step 3.

## Steps

1. **Research.** `aviato rebuild`, then `aviato strategy research <site>` (Bash `timeout` 600000). It posts the SERP batch, then the Live calls, each tagged `aviato:<site>:strategy:<item>` and capped at $5 a site.
   - Exit 1 "strategy research stopped … cost asked": the cap holds. Stop the session; tell the owner the cost asked and the line printed. Never raise the cap.
   - Exit 1 "money may be spent": `dfs +collect`, then the same command again. A rerun sends only the calls the Store lacks.
   Done when the command ends on `strategy research <site>: $… stored`.
2. **Collect.** `dfs +collect` every 10 minutes until `dfs store list --since 2h` shows no pending `aviato:<site>:strategy:serp:` task, at most 60 minutes after the post. Done when no SERP task is pending, or 60 minutes passed: each missing SERP term becomes a ⚠️ line in Fontes.
3. **Draft.** Write `sites/<site>/strategy-draft.md` from the template below, pt-BR, one page. Read:
   - the aviato database (`<data root>/aviato.db`) and raw pulls: GSC, Bing, GA4, Ads, Meta, `kpi.weekly`, report captures, page health, prompt-set answers;
   - the research results: `dfs store search`, `dfs store show <id>` per `aviato:<site>:strategy:` tag;
   - the site docs listed in `sites/<site>/site.yaml` `docs` (read, never copy), and owner notes in `sites/<site>/notes/`;
   - `site.yaml` `campanhas` when present: its repo at `main`, naming the commit in Fontes. Evidence: the xlsx Decisões, Alterações and Buscas tabs, the "do not propose again" list, `v2.md` with the newest review result, `incrementality.md`, the open items of `docs/metaads/README.md`. The ceciliobooks draft proposes D-067 as drop and the keyword-verdict rule text of the ads review.
   Propose values for every field; leave empty only the owner-set fields: `objetivo.number`, `objetivo.date`, `money_month`. Done when every template part holds content with a source or a ⚠️ mark.
4. **Check.** `aviato strategy check <site> --draft`. Fix each line it prints and run it again. Done when it prints `strategy ok`.
5. **Audit.** Dispatch one subagent with no draft context: give it only the draft path and the order "check each claim of this file against the source it names; report per claim: holds, wrong, or no source". Fix each finding in the draft, then step 4 again. At most 3 audit loops. Done when an audit reports no finding, or after loop 3: each open finding becomes a ⚠️ line in Fontes.
6. **Hand over.** Leave the draft in the checkout, uncommitted: the strategy session writes `strategy.md` from it and deletes it in the commit that records "Estratégia v1" (R37). Tell the owner: research spend, draft path, open ⚠️ lines, owner-set fields to answer. Done when that message is sent; end the session there.

## Template

Headings exactly as below. YAML keys are the ones `aviato strategy check` reads; prose around them is for the owner.

````markdown
# Estratégia <site>

## Objetivo

Um número de negócio com data, e o valor hoje. Fonte = resultado de negócio, não conversão de plataforma.

```yaml
objetivo: { number: null, date: null, source: <repo path or raw pull of the number> }
```

## Cliente e oferta

No máximo 3 linhas, com links para os docs do site.

## Canais

Por canal: papel, dinheiro por mês (o dono define) e por quê, com fontes. `name` = chave em `site.yaml` `channels`; canal orgânico = `organic`, com N = peças de conteúdo por mês.

```yaml
canais:
  - { name: google_ads, money_month: null, stop: { weeks: 4, spend: 300, outcomes: 0 } }
  - { name: organic, money_month: null, n_content: 2 }
```

## Mudanças planejadas

No máximo 5, cada uma com efeito esperado com número e data de conferência.

```yaml
mudancas:
  - { text: "<mudança>", expected: "<efeito com número>", check_on: decision+28d }
```

## Regra de parada

Uma por canal pago: canal, W semanas, gasto ≥ $X, resultados ≤ N, em texto (os números ficam em `canais[].stop`).

## Fontes

| Afirmação | Fonte | ✅ / ⚠️ hipótese |
|---|---|---|

## Concorrentes

No máximo 5: os da pesquisa (`competitors`, `intersection:` tags) e os que os docs do site nomeiam.

```yaml
concorrentes:
  - { domain: example.com, brand_names: [Example], why: "<por quê>", source: "<fonte>" }
```
````
