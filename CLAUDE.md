@AGENTS.md

## Claude Code specifics

- Slash commands live in `.claude/commands/`: `/feature`, `/mockup`, `/adr`, `/review`.
- Review agents live in `.claude/agents/`: `architecture-reviewer` (layering, IPC, data rules) and `ui-reviewer` (gap with the approved mockup, tokens, i18n, accessibility). Run them before declaring a feature done.
- Layer-specific rules are in nested `CLAUDE.md` files (`packages/domain/`, `apps/desktop/src/main/`, `apps/desktop/src/renderer/`); they load automatically when you work in those folders.
- When a question from "Ask before acting" applies, use the AskUserQuestion tool if available.
