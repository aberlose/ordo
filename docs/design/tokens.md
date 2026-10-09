# Design tokens

Semantic CSS variables. Components use these names only — never raw colours. Each colour theme defines every token for light and dark mode.
Source of truth for the values: `mockups/board/Board.dc.html` (CSS classes `.ordo.p-<theme>` and `.ordo.p-<theme>.dark`).

## Colour themes

| Theme | Role | Light accent | Dark accent | Gradient |
| --- | --- | --- | --- | --- |
| **Ciel** (`ciel`) | **Default** | `#1F5EFF` | `#5B8CFF` | Blue halo at the top of the canvas; accent button gradient |
| Aurore (`aurore`) | Option in settings | `#5146E5` | `#9A8CFF` | Accent button indigo → violet; light sidebar gradient |
| Lavande (`lavande`) | Option in settings | `#6248E8` | `#A594FF` | Canvas lavender → white; sidebar gradient |
| Indigo (`indigo`) | Option in settings | `#4F46E5` | `#8E88FF` | None |
| Corail (`corail`) | Option in settings | `#CC4426` | `#FF7A55` | None |

Rejected palettes (kept in the canvas history only): sage, encre, prune, nuit.

## Tokens

| Token | Use |
| --- | --- |
| `--canvas` | Page background (solid fallback) |
| `--canvas-bg` | Page background, may be a gradient |
| `--surface` | Cards, popovers, inputs |
| `--side` / `--side-bg` | Sidebar background (solid / may be a gradient) |
| `--rail` | Soft fills (show more, highlighted rows) |
| `--border`, `--border-strong` | Hairlines, dashed placeholders |
| `--text`, `--text-2`, `--text-3` | Primary, secondary, tertiary text |
| `--accent` | Links, focus, active states |
| `--accent-bg` | Primary button background, may be a gradient |
| `--accent-fg` | Text on the accent |
| `--accent-soft` | Selected/active background |
| `--danger` | Overdue dates, destructive actions |
| `--side-text*`, `--side-active`, `--side-border` | Sidebar-scoped overrides (allows a dark sidebar in a light theme) |
| `--shadow`, `--lift`, `--scrim` | Card shadow, floating elements, modal backdrop |

## Ciel — values

| Token | Light | Dark |
| --- | --- | --- |
| `--canvas` | `#F2F6FF` | `#0A1020` |
| `--canvas-bg` | `linear-gradient(180deg, #E6EFFF 0%, #F4F7FD 280px)` | `linear-gradient(180deg, #0F1C3A 0%, #0A1020 300px)` |
| `--surface` | `#FFFFFF` | `#121B30` |
| `--side` / `--side-bg` | `#FFFFFF` | `#0C1426` |
| `--rail` | `#E9EFFC` | `#0A1120` |
| `--border` | `#DFE6F3` | `#20304F` |
| `--border-strong` | `#C4D0E6` | `#2E4068` |
| `--text` | `#0F1A33` | `#E7EEFB` |
| `--text-2` | `#465472` | `#A2B1CE` |
| `--text-3` | `#6D7A97` | `#7383A3` |
| `--accent` | `#1F5EFF` | `#5B8CFF` |
| `--accent-bg` | `linear-gradient(135deg, #1F5EFF 0%, #2F8BFF 100%)` | `linear-gradient(135deg, #3D73FF 0%, #4FA3FF 100%)` |
| `--accent-fg` | `#FFFFFF` | `#06101F` |
| `--accent-soft` | `#E2EBFF` | `#16294F` |
| `--danger` | `#D92D20` | `#FF8A80` |

## Fixed colours (all themes)

| Use | Values |
| --- | --- |
| Priority 1 → 5 | `#94A3B8`, `#3B82F6`, `#CA8A04`, `#EA580C`, `#DC2626` |
| Tag / column palette (user-pickable) | `#7C3AED`, `#2563EB`, `#0F766E`, `#B45309`, `#DC2626`, `#16A34A`, `#D97706`, `#78716C`, … (10 hues, to finalise with the column settings mockup) |

## Typography and shape

- Figtree 400/500/600/700, bundled; IBM Plex Mono for keyboard hints only.
- Base 14 px; card title 14/500; meta 12; labels 11.5.
- Radius: cards 10, buttons and inputs 8, tags 4, popovers 10, palette 14.
