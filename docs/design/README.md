# Design

The look of the app matters as much as its features. Every screen goes through mockups before code.

## Direction

The clarity and density of Jira, the restraint of LiteLLM. Neutral backgrounds, a single accent colour; column colours show as thin bands or dots, never as large fills.

- **Typography:** Inter, bundled. Base 14 px, cards 13 px, tabular figures for keys and dates.
- **Grid:** multiples of 4 px. Radius 6 px for cards, 8 px for panels. Hairline borders rather than shadows; shadows only for floating elements (dragged card, menus, popovers).
- **Tokens:** semantic CSS variables (`--bg-canvas`, `--bg-surface`, `--text-primary`, `--border-subtle`, `--accent`, …), each with a light and a dark value. No colour is written directly in a component. Final values land in `tokens.md` after the mockups are approved.
- **Column palette:** 10 hues, each tuned to keep good contrast in light and dark.
- **Themes:** light, dark, system.
- **Accessibility:** WCAG AA contrast minimum, visible focus everywhere, keyboard drag and drop.
- **UI kit:** shadcn/ui (Radix) + Tailwind, components copied into `renderer/shared/ui/` and restyled with the tokens.

## Mockup process (every screen)

1. HTML mockup in 2–3 variants, light and dark, realistic data (`/mockup`).
2. The user picks or combines; iterate until approved.
3. The approved mockup is stored in `mockups/<screen>/` with a short `README.md` (what was decided, which variant).
4. Implementation goes through Storybook stories that reproduce the mockup.
5. Playwright screenshots in both themes act as visual regression tests.

## First mockup series (milestone 1)

- [ ] Kanban board
- [ ] Task detail panel (and full-screen mode)
- [ ] Column settings
- [ ] Search and filter bar
- [ ] Command palette
- [ ] Empty states (first launch, board without tasks)
