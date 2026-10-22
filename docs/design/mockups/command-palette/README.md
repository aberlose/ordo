# Command palette — approved 2026-10-10

Design canvas "Ordo — Maquettes", page "États vides et palette" (empty query). Typed filters are in the board mockup.

| Element | Decision |
| --- | --- |
| Frame | 640 px, 96 px from the top, over a dimmed board; max height keeps 48 px from the bottom, list scrolls |
| Input | "Search a task, filter (#tag, haute…) or run a command" |
| Empty query | Three groups: **Recently opened** tasks (with their column), **Actions** (new task `N`, new column, new board, toggle light/dark `⇧⌘L`, collapse sidebar `⌘\`, settings `⌘,`, trash), **Go to board** (with task counts) |
| Selection | Accent-soft row background, follows mouse and ↑ ↓ |
| Footer | ↑↓ navigate, ↵ open, Esc close; reminder of the filter syntax |

## Implementation notes (lot 7)

- **Actions**: new task `N` and new column need a board shown and are hidden otherwise; "Nouvelle colonne" opens the board's new-column popover (a request through the shared layout store, as "Nouveau board" opens the sidebar's popover). Settings and trash stay hidden until lots 8 and 9.
- **Input row**: the "Échap" key hint sits at the right of the query field for every query, empty included (drawn in search-palette A, not in this mockup), and again in the footer.
- **Key labels**: symbols on macOS (`⇧⌘L`, `⌘\`), words elsewhere (`Ctrl Shift L`, `Ctrl \`), as "Alt" for ⌥.
- **"Aller au board"** icon boxes and the board squares use the board colour on a 14 % tint; text on it uses `--col-*-text` (AA).
