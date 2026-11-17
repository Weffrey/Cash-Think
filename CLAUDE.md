# Daily Quant Trader

Personal quant and finance question trainer. Design notes live in the Obsidian vault at
`C:\Users\Jeffrey\Obsidian Vault\blublublu\Daily Quant Trader\` (Overview.md, Question Pages.md).

## Stack
Next.js (App Router, TypeScript, Tailwind v4), SQLite via better-sqlite3, vitest for tests. No UI or AI libraries.
Read AGENTS.md before writing Next.js code: `cacheComponents` is on, so every GET route handler starts with `await connection()` and no route exports `runtime` or `dynamic`.

## Commands
- `npm test` runs the test suite
- `npm run seed` creates `data/app.db` and adds any seed question that is missing (matched by prompt; safe to rerun, never touches history)
- `npm run dev` starts the app; `npm run build` then `npm start` for the production build
- `npm run lint`, `npx tsc --noEmit`

## Decisions already made (do not re-ask)
- Selector is pure code with no AI: `src/lib/selector.ts`. Picks the category furthest behind its weighted target share, then a difficulty (base level plus stretch, one level up only), then an unseen question.
- Category counters are derived from attempts, never stored. Giving up and showing the solution before answering (help level 3) do not count. Counters cannot be reset for now.
- Help tray (Reference, Hint, Show solution) shows stored text only, no AI. Reference card exists on every question. Hints have no cap. Opening the chat never changes the help level.
- Solutions stay on the server until the user answers, shows the solution, or gives up.
- First question formats: mcq, numeric, long (self-check by default).
- AI provider: start on Groq's free tier behind a single function so it is swappable. Log every AI call in `ai_calls`.
- Unverified (generated) questions are never served by the selector.

## Conventions added with version 1
- Attempt state lives on the server in `attempt_sessions`. The only way to change it is `applyAction` in `src/lib/practice.ts`. The browser gets an `AttemptState`, which holds answers, breakdown, reference card, and hints only after the action that reveals them. Never add a stored answer field to `PublicQuestion`. The no-leak tests in `practice.test.ts` and `api.test.ts` must keep passing.
- Help level is derived on the server (`helpLevelOf`) and frozen in the `attempts` row when the attempt finishes. Nothing the client sends can set it.
- Outcomes: submitting an answer records `completed` (right or wrong, with `correct` set). Give up records `gave_up` at the current help level. Show solution records `gave_up` with help level 3. Long answers record `completed` on submit with `correct` null, then the self-check sets `correct` (two thirds of the rubric, rounded up).
- Numeric checking: relative tolerance; when the correct value is 0 the tolerance is an absolute band (`src/lib/checking.ts`).
- Time per attempt: server clock from open to finish, or the browser's visible time when that is smaller.
- AI: `src/lib/ai.ts` is the only provider-aware file (plain fetch, non-streaming, key from `GROQ_API_KEY`). Without a key every AI route answers 503 with code `ai_disabled` and the UI shows a notice. Chat history is stored in `chat_messages` and trimmed to the last 10 messages per call.
- Upgrade: output is validated by `parseGeneratedQuestion` and saved with `parent_id`, `verified = false`, difficulty + 1. One child per question; pressing Upgrade again opens it.
- Seed content: every numeric and multiple choice question needs an independent recomputation in `src/data/seed-questions.test.ts`; a test fails if one is missing.
- UI: colors are CSS variables in `src/app/globals.css` (light, dark, and a saved override on `<html data-theme>`). Reusable classes (`btn`, `chip`, `card`, `field`, `label`) are in `@layer components` so Tailwind utilities can override them. Stored text is rendered with `RichText` (plain text math, no KaTeX).

## Layout
- `src/lib/selector.ts` selector, `src/lib/db.ts` schema and queries, `src/lib/types.ts`, `src/lib/categories.ts`
- `src/lib/practice.ts` attempt state machine, `src/lib/checking.ts` answer checking, `src/lib/balance.ts`, `src/lib/stats.ts`
- `src/lib/ai.ts`, `src/lib/tutor.ts`, `src/lib/upgrade.ts` AI wrapper, chat, upgrade
- `src/lib/server-db.ts` shared connection (`DB_PATH`, default `data/app.db`), `src/lib/seed.ts`
- `src/app/api/**/route.ts` API routes (thin; logic is in `src/lib`), `src/app/*/page.tsx` pages, `src/components/` UI
- `src/data/seed-questions.ts` and `seed-questions-extra.ts` hand-checked seed questions, with independent recomputation in `seed-questions.test.ts`
