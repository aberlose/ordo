# Column settings — chosen layout 2026-10-10

Design canvas "Ordo — Maquettes", page "Colonnes — tour 1".

`ColumnSettings.dc.html` — `mode` prop: `popover` (chosen), `inline`, `dialog` (rejected alternatives).

| Element | Decision |
| --- | --- |
| Opening | Floating popover (340 px) anchored under the column's ⋯ button; the button stays highlighted. Adding a column opens the same popover under "+ New column" |
| Name | Text field, prefixed with the chosen icon in the chosen colour |
| Colour | 10 swatches: slate, blue, cyan, teal, green, amber, orange, red, pink, violet |
| Icon | Searchable grid (8 per row, scrolls), accent-insensitive search on French names and keywords; ~50 icons in the mockup, the full Lucide set (filtered) in the app |
| Status type | Segmented control To do / In progress / Done, with a one-line explanation of the effect |
| Tasks shown | − / + stepper and a "No limit" checkbox; the hint explains the "Show N more" behaviour |
| Footer | Delete (danger, edit only), Cancel, Save |
| Column header on the board | The chosen icon, in the column colour, **replaces the ring dot** |

## Complements — approved 2026-10-14

`ColumnStates.dc.html` (page "Colonnes — compléments"), variants A and B, light and dark.

| State | Chosen | Decision |
| --- | --- | --- |
| Deleting a column | **A** | The popover footer turns into the confirmation: "Supprimer « name » et ses N tâches ?" in danger, a reminder that tasks go to the trash (restorable 30 days), Annuler / Supprimer (danger filled). The column and its tasks go to the trash together. The last column of a board cannot be deleted |
| Show less | **B** | Past the display limit the column ends with "Voir N de plus" (rail button, board mockup); once expanded, a "Replier" button (accent-soft, chevron up) sits in the column header, so it stays reachable in a long column. Not remembered across restarts |
| New column defaults | — | From the approved popover: added at the right end, status type "En cours", no limit |
