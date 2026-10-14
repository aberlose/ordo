# Tasks — micro-states, approved 2026-10-10

Design canvas "Ordo — Maquettes", page "Tâches — micro-états". Each file shows variant A and B, light and dark; the chosen variant is the reference.

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Quick add | `QuickAdd.dc.html` | **B** | The "Add" link at the bottom of a column turns into a one-line field (accent border, accent-soft ring, ↵ hint). Enter creates the task at the bottom of the column and keeps the field open for the next one; Escape (or an empty blur) closes it. The created card is briefly highlighted (accent-soft background) |
| Status menu | `Menus.dc.html` | **A** | Dropdown from the Status property: the board's columns in board order, each with its icon in its colour, a check on the current one |
| Priority | `Menus.dc.html` | **B** | No menu: five buttons inline in the properties card (bar height rising, filled in the priority colour up to the level, selected one with accent border and accent-soft background), label below. Keys 1–5 set it when the group has focus |
| Date picker | `DatePicker.dc.html` | **B** | Popover under the date property: shortcuts on the left (Today, Tomorrow, Next Monday, In one week, End of month, No date), a typed field (`jj/mm/aaaa` in French, `mm/dd/yyyy` in English) above a one-month calendar (Monday first in French). Today has an accent ring, the chosen day is filled accent; the start → due period is tinted accent-soft |
| Card hover / focus | `CardStates.dc.html` | **A** | Hover: stronger border, lifted shadow, 1 px up, pointer. Keyboard focus: 2 px accent outline offset by 2 px; a focused card does not lift on hover. Click or Enter opens the detail window |

Colours in these files use the AA-adjusted Ciel values (see `../../tokens.md`).
