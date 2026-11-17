import Database from "better-sqlite3";
import { computeCounters } from "./selector";
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type Counters,
  type HelpLevel,
  type NewQuestion,
  type Outcome,
  type Question,
  type Settings,
} from "./types";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('mcq','numeric','long')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt TEXT NOT NULL,
  options TEXT,
  correct_option INTEGER,
  option_reasons TEXT,
  correct_value REAL,
  tolerance REAL,
  unit TEXT,
  rubric TEXT,
  reference_card TEXT NOT NULL,
  hints TEXT NOT NULL DEFAULT '[]',
  short_answer TEXT NOT NULL,
  steps TEXT NOT NULL,
  theory TEXT NOT NULL,
  intuition TEXT NOT NULL,
  parent_id INTEGER REFERENCES questions(id),
  verified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  category_id INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed','gave_up')),
  help_level INTEGER NOT NULL CHECK (help_level BETWEEN 0 AND 3),
  duration_ms INTEGER,
  correct INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_category ON attempts(category_id);

CREATE TABLE IF NOT EXISTS favorites (
  question_id INTEGER PRIMARY KEY REFERENCES questions(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- One row per question page opened. Holds the server-side state of an attempt in
-- progress: which help was used and what has been revealed. The final result is
-- written to attempts when the user answers, gives up, or shows the solution.
CREATE TABLE IF NOT EXISTS attempt_sessions (
  id TEXT PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  started_at INTEGER NOT NULL,
  reference_opened INTEGER NOT NULL DEFAULT 0,
  hints_revealed INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'open' CHECK (phase IN ('open','self_check','done')),
  submitted TEXT,
  ticks TEXT,
  attempt_id INTEGER REFERENCES attempts(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attempt_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
`;

export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

const json = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));
const parse = <T>(v: string | null): T | null => (v === null ? null : (JSON.parse(v) as T));

interface QuestionRow {
  id: number;
  category_id: number;
  format: Question["format"];
  difficulty: number;
  prompt: string;
  options: string | null;
  correct_option: number | null;
  option_reasons: string | null;
  correct_value: number | null;
  tolerance: number | null;
  unit: string | null;
  rubric: string | null;
  reference_card: string;
  hints: string;
  short_answer: string;
  steps: string;
  theory: string;
  intuition: string;
  parent_id: number | null;
  verified: number;
}

function toQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    categoryId: r.category_id,
    format: r.format,
    difficulty: r.difficulty,
    prompt: r.prompt,
    options: parse<string[]>(r.options),
    correctOption: r.correct_option,
    optionReasons: parse<string[]>(r.option_reasons),
    correctValue: r.correct_value,
    tolerance: r.tolerance,
    unit: r.unit,
    rubric: parse<string[]>(r.rubric),
    referenceCard: r.reference_card,
    hints: JSON.parse(r.hints) as string[],
    shortAnswer: r.short_answer,
    steps: r.steps,
    theory: r.theory,
    intuition: r.intuition,
    parentId: r.parent_id,
    verified: r.verified === 1,
  };
}

export function insertQuestion(db: Db, q: NewQuestion): number {
  const info = db
    .prepare(
      `INSERT INTO questions (category_id, format, difficulty, prompt, options, correct_option,
        option_reasons, correct_value, tolerance, unit, rubric, reference_card, hints,
        short_answer, steps, theory, intuition, parent_id, verified)
       VALUES (@category_id, @format, @difficulty, @prompt, @options, @correct_option,
        @option_reasons, @correct_value, @tolerance, @unit, @rubric, @reference_card, @hints,
        @short_answer, @steps, @theory, @intuition, @parent_id, @verified)`,
    )
    .run({
      category_id: q.categoryId,
      format: q.format,
      difficulty: q.difficulty,
      prompt: q.prompt,
      options: json(q.options),
      correct_option: q.correctOption,
      option_reasons: json(q.optionReasons),
      correct_value: q.correctValue,
      tolerance: q.tolerance,
      unit: q.unit,
      rubric: json(q.rubric),
      reference_card: q.referenceCard,
      hints: JSON.stringify(q.hints),
      short_answer: q.shortAnswer,
      steps: q.steps,
      theory: q.theory,
      intuition: q.intuition,
      parent_id: q.parentId,
      verified: q.verified ? 1 : 0,
    });
  return Number(info.lastInsertRowid);
}

export function listQuestions(db: Db, opts: { verifiedOnly?: boolean } = {}): Question[] {
  const sql = opts.verifiedOnly ? "SELECT * FROM questions WHERE verified = 1" : "SELECT * FROM questions";
  return (db.prepare(sql).all() as QuestionRow[]).map(toQuestion);
}

export function getQuestion(db: Db, id: number): Question | null {
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRow | undefined;
  return row ? toQuestion(row) : null;
}

export interface NewAttempt {
  questionId: number;
  outcome: Outcome;
  helpLevel: HelpLevel;
  durationMs?: number | null;
  correct?: boolean | null;
  createdAt?: number;
}

export function recordAttempt(db: Db, a: NewAttempt): number {
  const q = getQuestion(db, a.questionId);
  if (!q) throw new Error(`Unknown question ${a.questionId}`);
  const info = db
    .prepare(
      `INSERT INTO attempts (question_id, category_id, outcome, help_level, duration_ms, correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a.questionId,
      q.categoryId,
      a.outcome,
      a.helpLevel,
      a.durationMs ?? null,
      a.correct === undefined || a.correct === null ? null : a.correct ? 1 : 0,
      a.createdAt ?? Date.now(),
    );
  return Number(info.lastInsertRowid);
}

export function listAttempts(db: Db): Attempt[] {
  const rows = db.prepare("SELECT * FROM attempts ORDER BY id").all() as Array<{
    id: number;
    question_id: number;
    category_id: number;
    outcome: Outcome;
    help_level: HelpLevel;
    duration_ms: number | null;
    correct: number | null;
    created_at: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    questionId: r.question_id,
    categoryId: r.category_id,
    outcome: r.outcome,
    helpLevel: r.help_level,
    durationMs: r.duration_ms,
    correct: r.correct === null ? null : r.correct === 1,
    createdAt: r.created_at,
  }));
}

/** Category counters, derived from attempts using the counting rule in selector.ts. */
export function getCounters(db: Db): Counters {
  return computeCounters(listAttempts(db));
}

/** questionId to timestamp of its latest attempt of any kind (including give-ups). */
export function getLastSeen(db: Db): Map<number, number> {
  const rows = db
    .prepare("SELECT question_id, MAX(created_at) AS last FROM attempts GROUP BY question_id")
    .all() as Array<{ question_id: number; last: number }>;
  return new Map(rows.map((r) => [r.question_id, r.last]));
}

export function getSettings(db: Db): Settings {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'main'").get() as { value: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS, weights: {}, pinnedCategories: [] };
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) };
}

export function saveSettings(db: Db, settings: Settings): void {
  db.prepare("INSERT INTO settings (key, value) VALUES ('main', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(settings),
  );
}

export function setFavorite(db: Db, questionId: number, on: boolean): void {
  if (on) {
    db.prepare("INSERT OR IGNORE INTO favorites (question_id, created_at) VALUES (?, ?)").run(questionId, Date.now());
  } else {
    db.prepare("DELETE FROM favorites WHERE question_id = ?").run(questionId);
  }
}

export function listFavoriteIds(db: Db): number[] {
  return (db.prepare("SELECT question_id FROM favorites ORDER BY created_at").all() as Array<{ question_id: number }>).map(
    (r) => r.question_id,
  );
}

export function isFavorite(db: Db, questionId: number): boolean {
  return db.prepare("SELECT 1 FROM favorites WHERE question_id = ?").get(questionId) !== undefined;
}

/** The first upgraded (harder) version of a question, if one was generated. */
export function getChildQuestionId(db: Db, parentId: number): number | null {
  const row = db.prepare("SELECT id FROM questions WHERE parent_id = ? ORDER BY id LIMIT 1").get(parentId) as
    | { id: number }
    | undefined;
  return row ? row.id : null;
}

export function getAttempt(db: Db, id: number): Attempt | null {
  return listAttempts(db).find((a) => a.id === id) ?? null;
}

export function setAttemptCorrect(db: Db, attemptId: number, correct: boolean): void {
  db.prepare("UPDATE attempts SET correct = ? WHERE id = ?").run(correct ? 1 : 0, attemptId);
}

export type SessionPhase = "open" | "self_check" | "done";

/** What the user submitted. Only one of the fields is set, by question format. */
export interface Submission {
  option?: number;
  value?: number;
  text?: string;
}

export interface AttemptSession {
  id: string;
  questionId: number;
  startedAt: number;
  referenceOpened: boolean;
  hintsRevealed: number;
  phase: SessionPhase;
  submitted: Submission | null;
  ticks: boolean[] | null;
  attemptId: number | null;
}

interface SessionRow {
  id: string;
  question_id: number;
  started_at: number;
  reference_opened: number;
  hints_revealed: number;
  phase: SessionPhase;
  submitted: string | null;
  ticks: string | null;
  attempt_id: number | null;
}

export function createSession(db: Db, id: string, questionId: number, startedAt: number): void {
  db.prepare("INSERT INTO attempt_sessions (id, question_id, started_at) VALUES (?, ?, ?)").run(id, questionId, startedAt);
}

export function getSession(db: Db, id: string): AttemptSession | null {
  const r = db.prepare("SELECT * FROM attempt_sessions WHERE id = ?").get(id) as SessionRow | undefined;
  if (!r) return null;
  return {
    id: r.id,
    questionId: r.question_id,
    startedAt: r.started_at,
    referenceOpened: r.reference_opened === 1,
    hintsRevealed: r.hints_revealed,
    phase: r.phase,
    submitted: parse<Submission>(r.submitted),
    ticks: parse<boolean[]>(r.ticks),
    attemptId: r.attempt_id,
  };
}

export function saveSession(db: Db, s: AttemptSession): void {
  db.prepare(
    `UPDATE attempt_sessions SET reference_opened = ?, hints_revealed = ?, phase = ?, submitted = ?, ticks = ?, attempt_id = ?
     WHERE id = ?`,
  ).run(s.referenceOpened ? 1 : 0, s.hintsRevealed, s.phase, json(s.submitted), json(s.ticks), s.attemptId, s.id);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function addChatMessage(db: Db, sessionId: string, m: ChatMessage): void {
  db.prepare("INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)").run(
    sessionId,
    m.role,
    m.content,
    Date.now(),
  );
}

export function listChatMessages(db: Db, sessionId: string): ChatMessage[] {
  return db.prepare("SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id").all(sessionId) as ChatMessage[];
}

export interface AiCall {
  purpose: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function logAiCall(db: Db, c: AiCall): void {
  db.prepare(
    "INSERT INTO ai_calls (purpose, provider, model, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(c.purpose, c.provider, c.model, c.inputTokens, c.outputTokens, Date.now());
}

export function listAiCalls(db: Db): AiCall[] {
  const rows = db.prepare("SELECT * FROM ai_calls ORDER BY id").all() as Array<{
    purpose: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
  }>;
  return rows.map((r) => ({
    purpose: r.purpose,
    provider: r.provider,
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
  }));
}
