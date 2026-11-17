# Cash in Cash out

A personal trainer for quant trading and finance interview questions. It keeps your completed questions even across 12 categories, serves questions at the difficulty you choose, and breaks every solution down into short answer, steps, theory, and intuition.

It is a single-user app with no login. Data lives in a local SQLite file.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run seed     # creates data/app.db and loads the question bank
npm run dev      # then open http://localhost:3000
```

`npm run seed` is safe to run again at any time: it only adds seed questions that are missing and never touches your history. The app also seeds itself the first time it opens an empty database.

To start from scratch, stop the app, delete the `data` folder, and seed again.

### On a phone

Put the phone on the same Wi-Fi as the laptop and use the production build, which is also faster:

```bash
npm run build
npm start        # prints a Network address such as http://192.168.1.20:3000
```

Open the Network address on the phone. Windows may ask once to allow Node.js through the firewall.

The dev server (`npm run dev`) can refuse requests from other devices. If you want to use dev mode from the phone, add the laptop's address to `allowedDevOrigins` in `next.config.ts`.

## AI chat and Upgrade (optional)

Everything except the tutor chat and the Upgrade button works without an AI key. Hints, reference cards, and solutions are stored text.

To turn the AI features on:

1. Create a free key at https://console.groq.com/keys
2. Copy `.env.example` to `.env.local`
3. Set `GROQ_API_KEY=your_key` in `.env.local`
4. Restart the app

`GROQ_MODEL` changes the model (default `openai/gpt-oss-120b`). The key is only read on the server and is never sent to the browser. `.env.local` is ignored by git.

Questions written by the Upgrade button are marked **Unverified**: the AI may get the answer wrong. They are never picked by the selector; you only reach them through the Upgrade button on their original question.

## Checks

```bash
npm test          # unit and API tests
npm run lint
npx tsc --noEmit
npm run build
```

## How it works

- **Practice** (`/`): the selector picks the category furthest behind its target share, then a difficulty, then a question you have not seen. The strip at the top shows the counter for each category.
- **Help tray**: Reference (formula card), Hint (one at a time), Show solution. All stored text, no AI. The highest help used is recorded as the help level: 0 none, 1 reference, 2 hint, 3 solution shown.
- **Counting rule**: an attempt counts toward its category when you submit an answer and did not show the solution first. Giving up and Show solution do not count. A wrong answer still counts as a completed question; the Stats page shows right and wrong separately.
- **Written answers** are self-checked: after you submit, tick the key points you covered. Two thirds of them (rounded up) marks the answer as correct.
- **Numeric answers** are checked with a relative tolerance. You can type decimals, fractions like `1/6`, or values with `$`, `%`, and thousands separators.
- **Settings** (`/settings`): base difficulty, stretch percentage (one level above base), weight per category (0 excludes it), pins, and the read-only counters.
- **Stats** (`/stats`): independent versus assisted work per category, and every attempt with its result, help level, and time.
- **Favorites** (`/favorites`): starred questions, each can be practiced again.

Answers, solutions, reference cards, and hints stay on the server. The browser receives each one only after the action that reveals it. Tests in `src/lib/practice.test.ts` and `src/app/api/api.test.ts` check this for every question in the bank.

## Where things are

| Path | What |
|------|------|
| `src/lib/selector.ts` | Question selector (pure, no AI) |
| `src/lib/practice.ts` | Attempt state machine: help level, reveal rules, recording results |
| `src/lib/checking.ts` | Answer checking for multiple choice, numeric, and self-checked answers |
| `src/lib/db.ts`, `src/lib/server-db.ts` | SQLite schema, queries, and the shared connection |
| `src/lib/ai.ts` | The only file that knows the AI provider (Groq) |
| `src/lib/tutor.ts`, `src/lib/upgrade.ts` | Chat prompt, and Upgrade generation with strict validation |
| `src/lib/balance.ts`, `src/lib/stats.ts` | Counters against targets, and stats |
| `src/data/seed-questions*.ts` | The question bank; every numeric and multiple choice answer is recomputed in `seed-questions.test.ts` |
| `src/app/api/` | API routes |
| `src/app/`, `src/components/` | Pages and UI |

Design notes are in the Obsidian vault under `blublublu/Daily Quant Trader/`.

## Adding questions

Add entries to `src/data/seed-questions-extra.ts` using the `mcq`, `numeric`, or `long` helpers, add a test in `src/data/seed-questions.test.ts` that recomputes the answer independently (the suite fails if a numeric or multiple choice question has no such test), then run `npm test` and `npm run seed`.

Text formatting in questions is plain text: `x^2` and `e^(-rT)` become superscripts, `S_T` becomes a subscript, and text in backticks is shown as code.
