# Design tokens

Semantic CSS variables. Components use these names only — never raw colours. Each colour theme defines every token for light and dark mode.
Implemented in `apps/desktop/src/renderer/styles/tokens.css` (`<html data-palette data-mode>`), mapped to Tailwind utilities in `styles/index.css`. Visual reference: `mockups/board/Board.dc.html`.

## Colour themes

| Theme               | Role               | Light accent | Dark accent | Gradient                                                   |
| ------------------- | ------------------ | ------------ | ----------- | ---------------------------------------------------------- |
| **Ciel** (`ciel`)   | **Default**        | `#1A52E6`    | `#5B8CFF`   | Blue halo at the top of the canvas; accent button gradient |
| Aurore (`aurore`)   | Option in settings | `#5146E5`    | `#9A8CFF`   | Accent button indigo → violet; light sidebar gradient      |
| Lavande (`lavande`) | Option in settings | `#6248E8`    | `#A594FF`   | Canvas lavender → white; sidebar gradient                  |
| Indigo (`indigo`)   | Option in settings | `#4F46E5`    | `#8E88FF`   | None                                                       |
| Corail (`corail`)   | Option in settings | `#CC4426`    | `#FF7A55`   | None                                                       |

Rejected palettes (kept in the canvas history only): sage, encre, prune, nuit.

## Tokens

| Token                                                               | Use                                                                                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--canvas`                                                          | Page background (solid fallback)                                                                                                                                      |
| `--canvas-bg`                                                       | Page background, may be a gradient                                                                                                                                    |
| `--surface`                                                         | Cards, popovers, inputs                                                                                                                                               |
| `--side` / `--side-bg`                                              | Sidebar background (solid / may be a gradient)                                                                                                                        |
| `--rail`                                                            | Soft fills (show more, highlighted rows)                                                                                                                              |
| `--border`, `--border-strong`                                       | Hairlines, dashed placeholders                                                                                                                                        |
| `--text`, `--text-2`, `--text-3`                                    | Primary, secondary, tertiary text                                                                                                                                     |
| `--accent`                                                          | Links, focus, active states                                                                                                                                           |
| `--accent-bg`                                                       | Primary button background, may be a gradient                                                                                                                          |
| `--accent-fg`                                                       | Text on the accent                                                                                                                                                    |
| `--accent-soft`                                                     | Selected/active background                                                                                                                                            |
| `--danger`                                                          | Overdue dates, destructive actions                                                                                                                                    |
| `--side-text*`, `--side-active`, `--side-border`                    | Sidebar-scoped overrides (allows a dark sidebar in a light theme)                                                                                                     |
| `--shadow-card`, `--shadow-pop`, `--scrim`                          | Card shadow, floating elements, modal backdrop                                                                                                                        |
| `--shadow-lift`, `--shadow-drag`                                    | Card on hover; card or column being dragged                                                                                                                           |
| `--danger-fg`, `--danger-soft`, `--danger-line`                     | Text on a filled danger button; background and top border of a destructive confirmation (derived from `--danger`; the soft tint is 4 % in light, 8 % in dark, for AA) |
| `--slot-border`, `--slot-fill`, `--drop-tint`                       | Drop slot (dashed) and the tint of the column a card is dragged over (derived from the accent)                                                                        |
| `--inverse`, `--inverse-fg`, `--inverse-danger`, `--inverse-accent` | Error toast in inverse colours (derived: text as background, canvas as text)                                                                                          |

## Ciel — values

| Token                  | Light                                                | Dark                                                 |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `--canvas`             | `#F2F6FF`                                            | `#0A1020`                                            |
| `--canvas-bg`          | `linear-gradient(180deg, #E6EFFF 0%, #F4F7FD 280px)` | `linear-gradient(180deg, #0F1C3A 0%, #0A1020 300px)` |
| `--surface`            | `#FFFFFF`                                            | `#121B30`                                            |
| `--side` / `--side-bg` | `#FFFFFF`                                            | `#0C1426`                                            |
| `--rail`               | `#E9EFFC`                                            | `#0A1120`                                            |
| `--border`             | `#DFE6F3`                                            | `#20304F`                                            |
| `--border-strong`      | `#C4D0E6`                                            | `#2E4068`                                            |
| `--text`               | `#0F1A33`                                            | `#E7EEFB`                                            |
| `--text-2`             | `#465472`                                            | `#A2B1CE`                                            |
| `--text-3`             | `#5F6B88`                                            | `#7B8BAB`                                            |
| `--accent`             | `#1A52E6`                                            | `#5B8CFF`                                            |
| `--accent-bg`          | `linear-gradient(135deg, #1A52E6 0%, #2B6CF0 100%)`  | `linear-gradient(135deg, #3D73FF 0%, #4FA3FF 100%)`  |
| `--accent-fg`          | `#FFFFFF`                                            | `#06101F`                                            |
| `--accent-soft`        | `#E2EBFF`                                            | `#16294F`                                            |
| `--danger`             | `#D92D20`                                            | `#FF8A80`                                            |

Ciel values were darkened on 2026-10-10 so text and accent reach WCAG AA (4.5:1) on every Ciel background. The `.dc.html` mockups keep the earlier, slightly lighter values.

## Fixed colours (all themes)

| Use                                  | Values                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priority 1 → 5                       | `#94A3B8`, `#3B82F6`, `#CA8A04`, `#EA580C`, `#DC2626`                                                                                                                                                                                                             |
| Tag / column palette (user-pickable) | slate `#78716C`, blue `#2563EB`, cyan `#0891B2`, teal `#0F766E`, green `#16A34A`, amber `#CA8A04`, orange `#D97706`, red `#DC2626`, pink `#DB2777`, violet `#7C3AED` (CSS `--col-<name>`)                                                                         |
| Board colours as small text          | `--col-<name>-text`, per mode: the palette darkened in light (amber `#8B5F03`, green `#107736`…) and lightened in dark (violet `#A679F3`, blue `#628FF1`…) to keep 4.5:1 on every palette's sidebar, hover and active tile. Used by the collapsed rail's initials |

## Typography and shape

- Figtree 400/500/600/700, bundled; IBM Plex Mono for keyboard hints only.
- Base 14 px; card title 14/500; meta 12; labels 11.5.
- Type scale (`--text-*` in `styles/index.css`, Tailwind `text-<name>`): kbd 11, caption 11.5, small 12, label 12.5, meta 13, body 13.5, input 14 (text fields set the 14 px base explicitly: rename field, name of a copy), title 15, heading 22, display 28, heading-lg 30. Task notes (`styles/notes.css`, mockup notes-attachments/NotesEditor A): note 14.5 (body, line height 1.65, and level 3 heading), note-h1 20, note-h2 16; their code uses label (12.5) and their tables body (13.5). Command palette (mockups command-palette, search-palette A): palette 16 (its query field), micro 8.5 (bold initials in the 14 px board square of a task found on another board).
- Strong border 1.5 px (`--border-width-strong`, Tailwind `border-strong`): text fields, drag previews, drop slots. Hairlines stay 1 px.
- Radius: cards 10, buttons and inputs 8, tags 4, menus and date picker 10, settings popover 12 (`--radius-popover`), palette 14.
- Sizes: column 296 (`--column-width` on `:root`, read at run time to fit card tags; `--spacing-column` points to it), settings popover 340 (`--spacing-popover`), small popover 320 (`--spacing-popover-sm`, duplicate a board), tag picker 300 (`--spacing-popover-xs`), board menu 236 (`--spacing-menu`), icon grid of the column settings 148 high (`--spacing-icon-grid`), "/" block menu of the notes 280 (`--spacing-menu-blocks`), ⋯ menu of an attachment tile 250 (`--spacing-menu-file`), address in the link bubble 170 at most (`--spacing-bubble-label`), gap between a line of text (or a table) and what floats under or beside it 6 (`--spacing-float-gap`). The settings popover, the "/" menu and the floating gap point to `--popover-width`, `--menu-blocks-width` and `--float-gap` on `:root`: the notes editor reads them at run time to keep its popover and menus inside the notes.
- Checklist boxes of the notes: 16 px, `--border-width-strong` in `--border-strong`, 4 px radius on `--surface`; checked, filled with `--accent` and a `--surface` check mark (as a done sub-task's box).
