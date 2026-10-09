# 0007 — i18n and repository language

- Status: accepted
- Date: 2026-10-09

## Context

The UI must be available in French (default) and English. The repository is read and written mostly by LLMs.

## Decision

- i18next + react-i18next in the renderer; `fr.json` (default) and `en.json`; dates formatted with date-fns locales.
- No user-facing string hard-coded in components.
- Everything in the repository (code, comments, commits, docs, ADRs) is in English; French appears only in translation files.

## Consequences

- Every UI change updates both translation files.
- The French design document is translated into `docs/product/spec.md`, which is the reference from now on.
