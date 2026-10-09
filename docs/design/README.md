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

## Decisions so far (board, round 3 — 2026-10-09)

Mockup canvas: "Ordo — Maquettes du board" (Claude design canvas, pages Tour 1 → Tour 3).

| Topic | Decision |
| --- | --- |
| Typeface | Figtree (to confirm in context); IBM Plex Mono only for keyboard hints |
| Palette | Warm neutrals + sage green accent (`#1F6F5C` light / `#5CC2A5` dark), from variant B |
| Sidebar | Open by default (variant C style: search, board list with counts); collapsible to a 64 px icon rail (variant B style) |
| Board header | Compact bar from variant C: board icon, name, view switcher, theme, "New task" button with `N` shortcut |
| Columns | Variant B: no background, coloured underline, ring dot (filled for "done" columns), count |
| Priority | Five small bars in the priority colour, no label (label on hover) |
| Sub-tasks | Progress ring + `done/total` |
| Task key | Hidden on cards by default |
| Filters | Buttons with checkbox menus **and** typed filters in ⌘K; both produce the same active filters |
| Tags on cards | Open: labels (A), coloured `#text` (B) or dots on the bottom line (C) |
