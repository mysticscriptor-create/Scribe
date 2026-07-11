---
name: Scribe context pattern
description: All Scribe contexts follow the same AsyncStorage hydration pattern with a hydrated flag.
---

## Pattern
Every context in Scribe:
1. Has a `hydrated: boolean` state, initially `false`
2. Loads from AsyncStorage in a single `useEffect` on mount
3. Sets `hydrated = true` in the `finally` block (even on error)
4. Exposes `hydrated` in the context value

## Why
Race conditions happen if effects run before AsyncStorage resolves. Always gate side effects on `hydrated`.

## How to apply
- In `useFocusEffect` or any effect that depends on persisted state, check `hydrated` first.
- Example in `app/index.tsx`: `if (hydrated && !activeNote) createNote(...)` prevents creating a spurious note before the notes array is loaded.
- New contexts must follow this same pattern — see `NotesContext.tsx`, `PanelsContext.tsx`, `NovelProjectsContext.tsx`.
