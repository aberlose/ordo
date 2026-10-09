---
description: Produce 2–3 HTML mockup variants of a screen, light and dark, for review
argument-hint: <screen or state>
---

Create mockups for: $ARGUMENTS

- Read `docs/design/README.md` and any approved mockups in `docs/design/mockups/` first; stay consistent with them.
- Produce 2–3 genuinely different variants (layout or density, not just colour), each as one self-contained HTML file, with a light/dark toggle and realistic French data.
- Use only the semantic tokens (CSS variables). Bundle nothing from the network except fonts if needed for preview.
- Save under `docs/design/mockups/<screen>/variant-a.html`, `variant-b.html`, … and show them to the user.
- Ask which variant (or combination) to keep. Iterate. When approved, write `docs/design/mockups/<screen>/README.md` with the decision and delete rejected variants only if the user agrees.
