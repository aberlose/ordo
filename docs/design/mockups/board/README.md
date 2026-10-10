# Board — approved 2026-10-09

Design canvas: "Ordo — Maquettes du board" (Claude design canvas, page "Board validé"; rounds 1–5 kept as history pages).

- `Board.dc.html` — the full interactive board (sidebar open/collapsed, filters, command palette, light/dark, all palettes and tag styles as props).
- `Approved.dc.html` — the approved configuration: `palette="ciel"`, `tag-style="soft"`.

These are Claude design-canvas components (`.dc.html`); they need the canvas runtime to render. Treat them as the visual reference for Storybook stories, not as code to copy.

## What is approved

| Element | Decision |
| --- | --- |
| Typeface | Figtree |
| Colour theme | Ciel by default; Aurore, Lavande, Indigo, Corail selectable in settings (see `../../tokens.md`) |
| Sidebar | Open by default: logo, collapse button, search (⌘K), boards with icon and count, Archives / Trash / Settings at the bottom. Collapses to a 64 px rail with board initials |
| Board header | Compact bar: board icon, name, "/ Kanban ▾" view switcher, theme toggle, "New task" button with `N` hint |
| Filter bar | Priority, Tags, Due date buttons opening checkbox menus with counts; active filter shows its values and a clear ×; "or type a filter ⌘K"; result count; "Clear filters" |
| Command palette | Typed filters (`#tag`, `haute`/`basse`…, `retard`, `semaine`, free text), recognised filters shown as chips, live preview of the board, Enter applies them to the filter bar |
| Columns | No background; 2 px underline in the column colour; the column icon in its colour (replaces the former ring dot); count; + and ⋯ buttons; "Show N more" past the display limit; "Add" at the bottom |
| Card | Title (14/500); tags; bottom line: priority bars, attachments, sub-task ring + `done/total`, due date (red and bold when overdue). Task key hidden |
| Tags | Style G: slightly tinted background, small vertical bar in the tag colour, secondary text |
| Priority | Five bars rising in height, filled in the priority colour up to the level; label on hover only |
| Empty column under filters | Dashed box "No task matches the filters" |

## Not covered yet

Drag-and-drop states (see round 1 variant C for a first take), card hover/focus, empty states. Task detail, column settings and settings have their own folders.
