# Glossary

Code and docs use the English term. The French column is what the user (and the French UI) says.

| English (code)          | French (user / UI)             | Meaning                                                              |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------- |
| board                   | dashboard, board, tableau      | A Kanban board with its columns, tasks and tags                      |
| column (`board_column`) | colonne                        | A vertical lane of a board; it _is_ the status                       |
| column category         | catégorie de colonne           | `todo` / `in_progress` / `done`; gives the status a business meaning |
| status                  | statut                         | The column a task is in                                              |
| task                    | tâche                          | A card on the board                                                  |
| sub-task                | sous-tâche                     | A task with a `parent_id`; one level only                            |
| key                     | clé                            | Human-readable task number per board (ORDO-42)                       |
| priority                | priorité                       | 1 Very low … 5 Very high, default 3 Medium                           |
| start date / due date   | date de début / date de fin    | Calendar days, no time                                               |
| tag                     | tag, étiquette                 | Coloured label, scoped to a board                                    |
| display limit           | nombre max de tâches affichées | Tasks shown before "Show more"; not a WIP limit                      |
| rank                    | rang                           | Fractional ordering key                                              |
| attachment              | pièce jointe                   | File copied into the app data folder                                 |
| archive                 | archiver                       | Hide without deleting                                                |
| trash                   | corbeille                      | Soft-deleted items, purged after 30 days                             |
| command palette         | palette de commandes           | Cmd/Ctrl+K launcher                                                  |
| quick add               | ajout rapide                   | Title-only creation at the bottom of a column                        |
