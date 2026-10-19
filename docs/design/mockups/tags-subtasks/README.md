# Tags and sub-tasks — approved 2026-10-16 (MVP lot 5)

Design canvas "Ordo — Maquettes", page "Tags & sous-tâches — lot 5". Each file shows variants A and B, light and dark.

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Pick tags | `TagPicker.dc.html` | **A** | The "+" in the detail properties opens a 300 px popover: a field that searches and creates ("Rechercher ou créer un tag"), then every tag of the board with a check box, its chip (style G) and its task count. Click or Enter toggles without closing; ↑↓ move. On hover or focus a ⋯ replaces the count. When nothing matches, "Créer « … »" adds the tag with the first free board colour ("Couleur automatique, modifiable avec ⋯") and checks it. Outside the popover, a chip shows a × on hover or focus (Delete also removes it) |
| Manage a tag | `TagManage.dc.html` | **A** | The ⋯ of a tag opens a "Modifier le tag" page inside the same popover: back ‹, name (Enter or leaving the field saves), the 10 colours (applied at once), "Supprimer le tag" with the task count. Changes apply to every task of the board. The delete confirmation replaces the footer, as for a column (lot 3): "Supprimer « design » ? Il sera retiré de 9 tâches.", Annuler focused |
| Sub-task rows | `SubtaskRows.dc.html` | **A**, empty state from **B** | Header "Sous-tâches" with `done/total` and a progress bar. Rows: check box, title, status in small text. On hover or focus the row is tinted, the title is underlined (it opens the sub-task) and the status becomes a button listing the board's columns. Checking sends the sub-task to the first Done column, unchecking to the first To-do column. "Ajouter une sous-tâche" opens a field at the bottom: Enter adds and keeps it open, Escape closes. A sub-task is deleted from its own window (⋯). With no sub-task: a dashed box "Aucune sous-tâche" with a short hint and an "Ajouter une sous-tâche" button (variant B) |
| Sub-task window | `SubtaskDetail.dc.html` | **B** | The task window without the Sub-tasks section (one level). Breadcrumb Board › Parent task (link) › Sub-task. Above the title, a "Sous-tâche de « Parent »" button with the parent's progress (3/5) leads back to the parent; the properties get a "Parente" row |
| Tags on a card | `CardTags.dc.html` | **A** | Tags on one line; the overflow is summed up as "+N", whose hover or focus shows the hidden tags in a bubble. Bottom line: priority, sub-task ring with `done/total`, due date |

The tag and column colours are the fixed palette of `../../tokens.md`.

## Decisions taken at review (2026-10-18)

- **Approved without a mockup**: the name conflict when renaming a tag (red field and "Un tag « … » existe déjà sur ce board."); matching tags and "Créer « … »" in the same list when the query is a new name; the message "Aucun tag sur ce board. Tapez un nom pour en créer un." (any other query matches a tag or offers "Créer « … »", so there is no "no match" state).
- **Sub-task list load error**: the empty state's dashed box with the message and "Réessayer", as for the Archives.
- **Done sub-task box**: filled with `--col-<name>-text` (the AA variant of its column colour) with the check in `--surface`, so the mark keeps 4.5:1 in light and dark.
- **Keyboard**: in the picker, → on the active option (or Tab to its ⋯) opens "Modifier le tag"; Escape there goes back to the list. On a card, "+N" is not focusable on its own (it sits inside the card button): the bubble shows on hover of "+N" or keyboard focus of the card, and screen readers get the full tag list.
