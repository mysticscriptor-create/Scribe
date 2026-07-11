# Scribe — Writer

A distraction-free Markdown writing app for Android, imported from an existing GitHub project (xyrvok/Scribe) for further bug fixes and feature work.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/scribe` — the Scribe Expo (React Native) app, imported from the user's GitHub repo. This is the primary artifact.
- `artifacts/api-server` — Express API server (currently unused by Scribe — the app is fully local/offline, no backend calls).
- `artifacts/mockup-sandbox` — Vite component preview server (design canvas), unrelated to Scribe.

## Architecture decisions

- Scribe is local-only: no backend, no network calls, all state persisted via AsyncStorage/safStorage. Do not wire it to `api-server` unless explicitly asked.
- Document export (txt/md/html/pdf/docx/epub) is done without an external conversion service — see `.agents/memory/scribe-app.md`.

## Product

**Scribe — Writer**: a distraction-free Markdown editor for Android, inspired by Writer Lite + Pure Writer.
- Multiple notes organized in folders (in-app vault, persisted via AsyncStorage)
- Customizable shortcut bar above the keyboard (insert / wrap / paired chars)
- Right-edge swipe opens a Files & Pinned side panel; long-press a file for actions (open, floating window, pin, delete)
- Left-edge swipe (or menu button) opens a drawer with theme picker, stats, theme editor, shortcut editor
- 5 built-in themes (Paper, Midnight, Sepia, Typewriter, Focus) plus a full theme editor
- Zen mode hides chrome for full focus
- Routes: `/` (editor), `/themes`, `/theme-edit`, `/shortcuts`, `/about`, `/history`, `/settings`, `/sheets`
- Key contexts: `ThemeContext`, `NotesContext`, `ShortcutsContext`, `PanelsContext`, `NovelProjectsContext`, `CharactersContext`, `WritingStatsContext`

## User preferences

- The app was originally built outside Replit and imported via GitHub. The user is non-technical — explain changes in terms of what they'll see/experience, not code.

## Gotchas

- Native deps (expo-print, expo-sharing, react-native-reanimated, Hermes) require a full EAS/Expo Launch build — pure JS/TS changes are OTA-safe. See `.agents/memory/scribe-build.md`.
- Google Play (Android) publishing is not supported by Replit's Expo Launch — only iOS App Store submission is. Let the user know if they ask about publishing to Android.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
