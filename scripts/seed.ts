import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { listQuestions, openDb } from "../src/lib/db";
import { syncSeedQuestions } from "../src/lib/seed";

const dbPath = process.env.DB_PATH ?? "data/app.db";
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);

const added = syncSeedQuestions(db);
const total = listQuestions(db).length;
console.log(
  added === 0
    ? `Nothing to add: ${dbPath} already has every seed question (${total} questions).`
    : `Added ${added} seed questions to ${dbPath} (${total} questions in total).`,
);
db.close();
