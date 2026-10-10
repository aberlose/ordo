# Task detail — chosen layout 2026-10-10

Design canvas "Ordo — Maquettes", page "Détail tâche — tour 1".

- `Detail.dc.html` — the component, `mode` prop: `modal` (chosen), `full`, `panel` (rejected).
- `Approved.dc.html` — the chosen default: centred window over the dimmed board.
- `FullScreen.dc.html` — the expanded state, with the "/" block menu open.

| Element | Decision |
| --- | --- |
| Opening | Centred window, 1040 px wide, 40 px from top and bottom, over a dimmed board (Jira style). The expand button switches to full screen and back |
| Top bar | Breadcrumb (board › column), theme, expand, ⋯ actions, close |
| Layout | Two columns: content (title, notes, sub-tasks, attachments) and a 300 px properties card on the right |
| Properties | Status (column), priority (bars), start date, due date (red, with an "Overdue by N days" pill on its own line), tags (bar style) with +, created / modified dates |
| Notes | Rich editor: formatting toolbar (bold, italic, strike, code, heading, lists, checklist, quote, link, image), Markdown shortcuts, "/" block menu |
| Sub-tasks | Header with `done/total` and progress bar; rows with checkbox, title (struck when done), status of the sub-task; "Add a sub-task" |
| Attachments | File tiles (type badge, name, size) and a drop zone |
