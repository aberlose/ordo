# Boards — approved 2026-10-14 (MVP lot 4)

Design canvas "Ordo — Maquettes", page "Boards — lot 4". Each file shows variants A and B, light and dark; **A was chosen for all four**.

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Create a board / icon and colour | `BoardCreate.dc.html` | **A** | The column settings popover (340 px) reused: anchored under the sidebar's "+" (highlighted while open). Name prefixed with the icon in its colour, the 10 colours, the searchable icon grid (8 per row). Hint: "Il démarre avec trois colonnes : À faire, En cours, Terminé." Footer Annuler / Créer le board. The same popover opens from the board menu ("Icône et couleur…") with "Enregistrer" |
| Board menu | `BoardMenu.dc.html` | **A** | On hover or focus of a sidebar row, a ⋯ button replaces the task count (right click opens the same menu). Items: Renommer (F2), Icône et couleur…, Dupliquer…, separator, Archiver. Rename turns the row into a field (Enter saves, Escape cancels). "Dupliquer…" opens a 320 px popover: "Nom de la copie" (default "Name (copie)") and a checkbox "Inclure les N tâches" (checked by default) with the hint "Les colonnes et leurs réglages sont toujours copiés." The copy goes right after the original |
| Archives | `BoardArchives.dc.html` | **A** | "Archives" at the bottom of the sidebar becomes the active item and the main area lists archived boards (icon, name, task count, archive date) with "Restaurer"; empty state in a dashed box. Archiving needs no confirmation (reversible) and opens the next board. A restored board goes to the end of the sidebar. Archived boards leave the sidebar and search |
| Reorder boards | `BoardReorder.dc.html` | **A** | As cards and columns (lot 2): the row follows the pointer with an accent border, the list closes up and a dashed slot opens at the destination; same with tiles in the collapsed rail. Keyboard: ⌥/Alt + ↑↓ on a focused board, with the help bar ("1 board sélectionné · ⌥ ↑↓ ordre · ↵ ouvrir") |

Colours in these files use the AA-adjusted Ciel values (see `../../tokens.md`).
