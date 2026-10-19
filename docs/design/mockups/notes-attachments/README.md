# Rich notes and attachments — approved 2026-10-19 (MVP lot 6)

Design canvas "Ordo — Maquettes", page "Notes & pièces jointes — lot 6". Each file shows variants A and B, light and dark. They complete the approved task detail (`../task-detail/`: toolbar, "/" menu, attachment tiles and drop zone).

| State | File | Chosen | Decision |
| --- | --- | --- | --- |
| Notes editor | `NotesEditor.dc.html` | **A** | The approved toolbar stays above the notes (sticky when the window scrolls): bold, italic, strike, code, heading, bullet list, checklist, quote, link, image, table. Empty note: "Ajoutez des notes… Tapez « / » pour insérer un bloc.". Autosave 500 ms after the last keystroke; a discreet "Enregistré" shows right of the toolbar, then fades. Markdown shortcuts (#, -, [ ], >, ```) and the "/" menu |
| Links | `NoteLinks.dc.html` | **A** | The Link button (or ⌘/Ctrl + K inside the notes) opens a small popover under the selection: address field, Enter applies, Escape cancels. Hover or focus of a link shows a bubble with the address and Ouvrir (default browser), Modifier, Retirer. ⌘/Ctrl + click opens the link |
| Image and table | `NoteBlocks.dc.html` | **B** | A pasted, dropped or picked image is copied into the attachments and shown in the note; selected, it gets two handles to resize it (percentage of the note width). Tables show "+" bands on hover: right to add a column, bottom to add a row; deletions through a right-click menu. Tab moves to the next cell |
| Attachments | `Attachments.dc.html` | **A** | The approved tiles (thumbnail for images). On hover or focus a ⋯ opens Ouvrir (default app; also double-click or Enter), Afficher dans le Finder / l'Explorateur, Supprimer…. Deleting is permanent, after a confirmation bubble ("Le fichier sera effacé définitivement…", Annuler focused). Dropping files anywhere on the window shows a drop overlay. Copying runs in the background on a tile with progress; a failure stays as a red tile with Réessayer and × |

The "deleted image" state of `NoteBlocks.dc.html` variant A (dashed box "Image supprimée des pièces jointes") also applies to the chosen variant B. Decided with the user: pasted images are attachments listed in "Pièces jointes"; no size limit; the copy tile shows an indeterminate "Copie…" bar (no percentage).
