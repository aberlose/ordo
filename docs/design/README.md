# Design

The look of the app matters as much as its features. Every screen goes through mockups before code.

## Direction

The clarity of Jira, the restraint of LiteLLM, with a vivid blue/violet identity. Cool tinted backgrounds with light gradients, one accent per colour theme; column colours show as thin underlines and dots, never as large fills. Five colour themes (Ciel by default), each in light and dark.

- **Typography:** Figtree, bundled. Base 14 px, card titles 14 px, tabular figures for counts and dates.
- **Grid:** multiples of 4 px. Radius 6 px for cards, 8 px for panels. Hairline borders rather than shadows; shadows only for floating elements (dragged card, menus, popovers).
- **Tokens:** semantic CSS variables (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--border-subtle`, `--accent`, …), each with a light and a dark value. No colour is written directly in a component. Final values land in `tokens.md` after the mockups are approved.
- **Column palette:** 10 hues, each tuned to keep good contrast in light and dark.
- **Themes:** light, dark, system.
- **Breathing room:** floating panels (popovers, menus, dialogs) and board columns always keep at least 24 px between their edge and the window edge; when content is taller, the panel scrolls inside instead of touching the edge.
- **Accessibility:** WCAG AA contrast minimum, visible focus everywhere, keyboard drag and drop.
- **UI kit:** shadcn/ui (Radix) + Tailwind, components copied into `renderer/shared/ui/` and restyled with the tokens.

## Mockup process (every screen)

1. HTML mockup in 2–3 variants, light and dark, realistic data (`/mockup`).
2. The user picks or combines; iterate until approved.
3. The approved mockup is stored in `mockups/<screen>/` with a short `README.md` (what was decided, which variant).
4. Implementation goes through Storybook stories that reproduce the mockup.
5. Playwright screenshots in both themes act as visual regression tests.

## First mockup series (milestone 1)

- [x] Kanban board
- [x] Task detail window (and full-screen mode)
- [x] Column settings
- [x] Search and filter bar (part of the board)
- [ ] Command palette (filters part approved with the board; commands list still to design)
- [x] Settings
- [ ] Empty states (first launch, board without tasks)

## Approved so far

- **Board** — approved 2026-10-09: `mockups/board/` (decisions in its README), tokens in `tokens.md`.
- **Task detail** — layout chosen 2026-10-10: `mockups/task-detail/`.
- **Column settings** — layout chosen 2026-10-10: `mockups/column-settings/`.
- **Settings** — layout chosen 2026-10-10: `mockups/settings/`.
