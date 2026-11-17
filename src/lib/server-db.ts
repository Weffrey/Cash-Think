import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { openDb, type Db } from "./db";
import { syncSeedQuestions } from "./seed";

// One connection per server process. Kept on globalThis so dev hot reloads reuse it.
const holder = globalThis as unknown as { __dqtDb?: Db };

/** The app database. Path comes from DB_PATH (default data/app.db). Seeds itself on first open. */
export function getDb(): Db {
  if (!holder.__dqtDb) {
    const path = process.env.DB_PATH ?? "data/app.db";
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = openDb(path);
    syncSeedQuestions(db);
    holder.__dqtDb = db;
  }
  return holder.__dqtDb;
}

/** Tests only: drop the cached connection so the next getDb() opens a fresh database. */
export function resetDbForTests(): void {
  holder.__dqtDb?.close();
  holder.__dqtDb = undefined;
}
