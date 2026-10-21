# Search in the command palette — approved 2026-10-21 (MVP lot 7)

Design canvas "Ordo — Maquettes", page "Recherche & palette — lot 7". The file shows variants A and B, light and dark. It completes the approved palette (`../command-palette/`: empty query) and the typed filters of the board (`../board/`: "Filtres reconnus" strip, live board, Enter applies the filters).

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Palette results | `PaletteSearch.dc.html` | **A** | The "Filtres reconnus" / "Résultat" strip of the board mockup stays; the board behind updates live. Tasks are grouped: **this board** first (with their column), then **other boards** (non-archived; board square + board name · column), each group with its count. A sub-task shows its parent in grey: "Parent › Sous-tâche". The matched text is bold. By default the "Appliquer comme filtres du board" command is selected, so Enter applies the filters; ↑ ↓ select a task, Enter opens it and closes the palette. "Nouvelle tâche N" stays under the commands |
| No result | `PaletteSearch.dc.html` | **A** | "Tâches · 0" and a line "Aucune tâche ne correspond à « … », ni sur ce board ni ailleurs. Vérifiez l'orthographe ou retirez un filtre."; an empty other-boards group says "Aucune tâche ailleurs."; the commands stay |

## Decisions taken with the user (2026-10-21)

- **Scope**: the board shown is filtered live; other boards appear only when free text is typed (typed priority, tag and due filters also apply to them; `#tag` matches tags of that name on each board).
- **Filters** are kept per board until the app quits (saved filters come in V1).
- **Overdue** = due date before today and task not done (as the red date on a card); **this week** = due Monday to Sunday of the current week; several due options combine with OR.
- **Sub-tasks** are not cards: board filters only apply to cards; the palette finds sub-tasks and opens their window.
- **⌘/Ctrl + K** inside the notes editor keeps inserting a link; elsewhere it opens the palette (also `/` outside a text field).
- **Recently opened**: the last 5 opened tasks, kept across restarts.
- Trash and Settings actions are hidden from the palette until lots 8 and 9.
