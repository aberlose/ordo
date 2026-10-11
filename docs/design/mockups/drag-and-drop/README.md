# Drag and drop — approved 2026-10-11

Design canvas "Ordo — Maquettes", page "Glisser-déposer". Each file shows variant A and B, light and dark; the chosen variant is the reference.

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Dragging a card | `CardDrag.dc.html` | **B** | The card leaves its column; a dashed slot (accent 55 %, accent-soft fill, card height) opens where it will land, and the target column body is tinted accent-soft. The preview follows the pointer, straight (no tilt), accent border and a strong shadow |
| Moving with the keyboard | `KeyboardMove.dc.html` | **B** | On the focused card, ⌥/Alt + ↑↓ changes the order, ⌥/Alt + ←→ changes the column; the moved card keeps the focus ring and flashes accent-soft. While a card has keyboard focus, a help bar is centred at the bottom of the board: "1 carte sélectionnée · ⌥ ↑↓ ordre · ⌥ ←→ colonne · Entrée ouvrir". Screen readers hear "Déplacée dans En cours, position 1 sur 2" |
| Reordering columns | `ColumnDrag.dc.html` | **B** | The whole column header is the handle (grab cursor). The column leaves its place and a dashed slot column opens at the destination; the preview is straight. Keyboard: ⌥/Alt + ←→ on the focused header, same help bar |
| Save failed | `Toast.dc.html` | **A** | Compact bar, bottom centre, inverse colours: danger icon, message ("Déplacement non enregistré : la carte a repris sa place."), "Réessayer", ×. Hides after 6 s; one at a time. The same toast serves every failed save (add, edit, delete, move) |
