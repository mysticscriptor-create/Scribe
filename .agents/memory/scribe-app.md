---
name: Scribe app conventions
description: Patterns used in the Scribe writer Expo app worth staying consistent with.
---

- New features follow the existing Context pattern (one Context per feature area, e.g. `NotesContext`, `PanelsContext`, `WritingStatsContext`, `CharactersContext`), hydrated from AsyncStorage/safStorage and exposed via a `use*` hook.
- Export (txt/md/html/pdf/docx/epub) is done with no external conversion service: docx via manual OOXML + jszip, epub via manual OPF/NCX + jszip, pdf via `expo-print`. Sharing via `expo-sharing`.
  **Why:** keeps the app fully offline/local-only per its design goal (no backend, no network calls).
- `expo-haptics` (`Haptics.selectionAsync` / `notificationAsync`) is the established feedback mechanism for discrete actions (shortcut taps, undo/redo, export success/failure, daily-goal-reached). Use it for new interactive actions rather than introducing a different feedback library.
- Editor-adjacent components should lean on `useMemo`/`useCallback` (the main `Editor.tsx` already has ~20 of these) — new editor features should follow this rather than causing unmemoized re-renders on every keystroke.
