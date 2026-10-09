# Renderer — rules

- Organised by feature: `features/<feature>/{components,hooks}/`, `store.ts` (Zustand, ephemeral UI state only), `index.ts` (public API). Import other features only through their `index.ts`.
- Data goes through TanStack Query hooks calling `window.api`. Mutations that the user sees (move, rename, toggle) are optimistic with rollback.
- No direct Node / Electron / DB access, ever.
- Styling: shadcn components from `shared/ui/`, Tailwind classes mapped to design tokens. No raw colours or arbitrary pixel values in feature code.
- Text: every user-facing string is an i18n key present in both `fr.json` and `en.json`.
- No new screen or state without an approved mockup in `docs/design/mockups/` — ask, or run `/mockup`.
- Performance: memoise cards, virtualise columns, lazy-load the editor and secondary views. Check the budgets in `docs/architecture.md`.
- Accessibility: focus visible, keyboard paths for every pointer action (including drag and drop).
- Each new component gets a Storybook story in light and dark.
