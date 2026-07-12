---
name: Scribe left/right panel split (Macro/Micro)
description: How the two drawers in Scribe divide responsibility — check this before adding navigation, browsing, or reference UI.
---

- Left drawer (`Menu.tsx`, "Macro") owns everything about *finding/managing* content: file tree/list/folders, Projects mode, vault connect/disconnect, Settings, Characters & Locations, Guide, About, global search. It has an internal `view: "main" | "files"` toggle rather than being a separate route.
- Right drawer (`SidePanel.tsx`, "Micro") is reference-only while writing: Pinned notes (top/bottom slots, each with its own pick/replace/unpin) and a document Outline (headings parsed live from the active note's markdown). It intentionally does NOT contain file browsing.
  **Why:** earlier versions mixed file browsing, projects, and pinned notes all into the right drawer, which made "where do I do X" ambiguous. Splitting by intent (manage vs. reference-while-writing) removed that ambiguity.
- Shared file-action UI (`ViewModeToggle` incl. a "projects" mode, `NoteActionSheet` for open/float/pin/history/export/delete) lives in `components/FilesTab.tsx` so both the Menu and any future consumer can reuse it without duplicating logic.
- Jumping the editor to an arbitrary line (used by Outline tap-to-jump) goes through `EditorHandle.jumpToLine(lineIndex)`, which always scrolls once — distinct from the typewriter-mode auto-scroll (`runTypewriterScroll`) which is gated on `typewriterMode` and skips no-op same-line calls. Don't conflate the two; jumpToLine is an explicit nav action and must not depend on the typewriter setting.
