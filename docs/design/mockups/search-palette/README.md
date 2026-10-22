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

## Decisions taken with the lot 7 review (2026-10-21)

- **Results**: "Ce board" holds every card of the board shown that matches the free text (full-text ids of the whole board, no limit) and the typed filters, then the board's sub-tasks found by the search, best matches first. "Autres boards" comes from the search called with the typed priority, due and `#tag` filters, so its limit (50) applies after filtering; when the limit is reached the header reads "Autres boards · 50+". The strip's "Résultat" counts the cards only (board filters never apply to sub-tasks).
- **6 rows per group**: the header gives the total; past 6 rows a last grey row, not selectable, says "+ N autres — ↵ sur Appliquer pour tout voir sur le board" (this board) or "+ N autres — affinez la recherche" (other boards; "+ N autres ou plus" when the search reached its limit).
- **States without a mockup, approved**: (1) no board shown (first launch, Archives): free text finds tasks on every board under "Tâches · N" (board square + board · column); typed filters are ignored, the strip's "Résultat" line says "Ouvrez un board pour filtrer", and a filter-only query lists the boards to open ("Aller au board"); (2) the search fails: "Tâches" with the line "La recherche a échoué." and a "Réessayer" row (a palette row rather than a button, so ↑ ↓ ↵ reach it), the commands stay; (3) filters only, no card matches: "Ce board · … · 0" and "Aucune tâche de ce board ne correspond aux filtres."; (4) empty Tags menu of the filter bar: "Aucun tag sur ce board".
- **"Résultat"** is one sentence per variant (plain, "— le board se met à jour en direct", "— ↵ sur une tâche l'ouvre"), one translation key each.
- **Board square** of a task found elsewhere: the board's initials in `--col-*-text` on a 14 % tint of the board colour, not white on the solid colour as drawn: white text fails WCAG AA on amber, orange, green and cyan.
- **Quoted words are text** (`"semaine" de 4 jours` searches the word "semaine"). No footer hint: the footer already carries the filter syntax and a fifth item would crowd it at 640 px.
