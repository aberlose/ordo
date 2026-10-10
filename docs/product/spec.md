# Ordo — functional specification

Source of truth for behaviour. Translated from the French design document validated on 2026-10-09.
If something you need is not here, ask — do not invent behaviour.

## Product

- Desktop app for macOS and Windows, installed locally, one user per machine.
- Purpose: organise, prioritise and visualise a backlog of tasks.
- Works fully offline. No account, no server.
- UI languages: French (default) and English, switchable in settings.
- Appearance: light, dark, or follow the system; colour theme **Ciel** by default, with Aurore, Lavande, Indigo and Corail selectable in settings.
- Name: **Ordo** (Latin "order, rank").

## Core features (from the pitch) — all in MVP

| Feature                        | Behaviour                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Several boards                 | Listed in the sidebar. Create, rename, duplicate, archive, reorder. Each board has an icon and a colour.                                                                                                                                                                                                                                                |
| Kanban view                    | Columns side by side, horizontal scroll. A card shows title, priority, tags, due date, attachment count and sub-task progress. The task key (ORDO-42) is **hidden by default**; a board setting to show it comes later.                                                                                                                                 |
| Search and filters             | Full-text search on title, description and tags. Combinable filters: priority, tag, due date (overdue, this week, no date). Two entry points producing the same active filters: filter buttons with checkbox menus above the board, and typed filters in the command palette (`#tag`, `haute`, `retard`…). Results update live; clear all in one click. |
| Columns on the fly             | Added from the board. Settings: name, icon, main colour, number of tasks shown by default (beyond it, a "Show more" button; "no limit" is allowed). This is a **display limit only** — there is no WIP limit. Columns can be reordered by drag and drop.                                                                                                |
| Status                         | A task's status **is** its column. Each column has a category (To do, In progress, Done), as in Jira, so "done" is known whatever the column names. A new board starts with three columns: TO-DO, IN PROGRESS, DONE (localised).                                                                                                                        |
| Tasks                          | Quick add at the bottom of each column (type a title, press Enter). Details open in a centred window over the dimmed board, which can be expanded to full screen.                                                                                                                                                                                       |
| Drag and drop                  | Between columns (changes status) and within a column (changes order). Also doable with the keyboard.                                                                                                                                                                                                                                                    |
| Task fields                    | Title (required). Description (optional). Status (first column by default). Priority on five levels, Very low → Very high, **Medium by default**. Start date and due date (optional, **day only, no time**).                                                                                                                                            |
| Sub-tasks                      | **One level only.** Tasks attached to a parent task, with their own title and status. On the parent card they show as a progress bar (e.g. 3/5).                                                                                                                                                                                                        |
| Tags                           | **Scoped to a board.** One colour per tag. Autocomplete and inline creation from the task.                                                                                                                                                                                                                                                              |
| Rich description (note taking) | Rich editor: headings, lists, checkboxes, code blocks, quotes, links, tables, pasted images. Markdown shortcuts, "/" menu, autosave.                                                                                                                                                                                                                    |

## Enhancements

| Feature                                                                                  | Inspiration     | Lot   |
| ---------------------------------------------------------------------------------------- | --------------- | ----- |
| Command palette (Cmd/Ctrl+K) to do everything from the keyboard                          | Linear, Raycast | MVP   |
| Keyboard shortcuts: N new task, / search, arrows to navigate                             | Jira, Linear    | MVP   |
| Undo / redo (Cmd/Ctrl+Z) on moves, edits and deletions                                   | Trello          | MVP   |
| Archive and trash (deleted items kept 30 days)                                           | Jira, Trello    | MVP   |
| Local attachments, copied into the app data folder                                       | Jira            | MVP   |
| Daily automatic backup, full JSON export and import                                      | Kanri           | V1    |
| Saved filters, recalled in one click                                                     | Jira            | V1    |
| Swimlanes by priority or by tag                                                          | Jira            | V1    |
| List view: sortable table of all tasks of a board                                        | Jira, Linear    | V1    |
| Links between tasks (blocks, is blocked by, relates to) and `[[task]]` mentions in notes | Jira, Notion    | V1    |
| Task and board templates                                                                 | Trello, Jira    | V1    |
| Global quick add from the menu bar / system tray                                         | Things          | V1    |
| Calendar view by due date                                                                | Jira, Trello    | Later |
| Reminders via system notifications                                                       | Todoist         | Later |
| Statistics: cumulative flow diagram, tasks done per week                                 | Jira            | Later |
| Focus mode: only today's tasks or a single column                                        | Things          | Later |
| Quick-add syntax (`Fix login !high #bug ^friday`)                                        | Todoist         | Never |
| WIP limit per column                                                                     | Jira            | Never |
| Activity history per task                                                                | Jira            | Never |
| Markdown export of a task or board                                                       | Kanri           | Never |
| Recurring tasks                                                                          | Todoist         | Never |
| Import from Trello / Jira (CSV) or Kanri (JSON)                                          | —               | Never |

"Never" means rejected for now: do not implement, do not prepare for it, ask if a task seems to need it.

## Distribution

- Unsigned builds for now (personal use). On first launch macOS and Windows ask for confirmation.
- No auto-update in scope.
