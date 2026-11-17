/**
 * The attempt state machine. Everything about an attempt in progress lives on the
 * server in attempt_sessions: which help was used, what has been revealed, and the
 * final result. The browser only ever receives an AttemptState, which is built here
 * and contains stored answers and solutions only after the action that reveals them.
 *
 * Phases: open -> done            (mcq, numeric, give up, show solution)
 *         open -> self_check -> done   (long answers: submit, then tick the rubric)
 */
import { randomUUID } from "node:crypto";
import { aiStatus, type AiStatus } from "./ai";
import { checkMcq, checkNumeric, checkSelfTicks, parseNumericInput, ticksNeeded } from "./checking";
import {
  createSession,
  getAttempt,
  getChildQuestionId,
  getCounters,
  getLastSeen,
  getQuestion,
  getSession,
  getSettings,
  isFavorite,
  listChatMessages,
  listQuestions,
  recordAttempt,
  saveSession,
  setAttemptCorrect,
  type AttemptSession,
  type ChatMessage,
  type Db,
  type SessionPhase,
  type Submission,
} from "./db";
import { countsTowardCategory, selectNext, type Rng } from "./selector";
import type { Format, HelpLevel, Outcome, Question } from "./types";

/** The part of a question that is safe to send before anything is revealed. */
export interface PublicQuestion {
  id: number;
  categoryId: number;
  format: Format;
  difficulty: number;
  prompt: string;
  /** MCQ option texts, without the correct one marked */
  options: string[] | null;
  unit: string | null;
  /** relative tolerance for numeric answers; says how precise to be, not what the answer is */
  tolerance: number | null;
  parentId: number | null;
  verified: boolean;
}

/** Stored content that is only sent once the attempt is finished (or the solution was shown). */
export interface Reveal {
  correctOption: number | null;
  optionReasons: string[] | null;
  correctValue: number | null;
  rubric: string[] | null;
  /** how many rubric ticks make a long answer count as correct */
  ticksNeeded: number | null;
  shortAnswer: string;
  steps: string;
  theory: string;
  intuition: string;
}

export interface AttemptResult {
  outcome: Outcome;
  /** null for a long answer that has not been self-checked yet, and for give-ups */
  correct: boolean | null;
  helpLevel: HelpLevel;
  durationMs: number | null;
  /** whether this attempt counted toward the category counter */
  counted: boolean;
}

export interface AttemptState {
  attemptId: string;
  question: PublicQuestion;
  phase: SessionPhase;
  startedAt: number;
  favorite: boolean;
  /** highest help used so far: 0 none, 1 reference, 2 hint, 3 solution shown before answering */
  helpLevel: HelpLevel;
  /** the reference card, once opened */
  reference: string | null;
  /** hints revealed so far, in order */
  hints: string[];
  hintsTotal: number;
  submitted: Submission | null;
  ticks: boolean[] | null;
  reveal: Reveal | null;
  result: AttemptResult | null;
  /** id of the harder version made by Upgrade, if one exists */
  childId: number | null;
  chat: ChatMessage[];
  ai: AiStatus;
}

export class PracticeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PracticeError";
  }
}

export function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    categoryId: q.categoryId,
    format: q.format,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    unit: q.unit,
    tolerance: q.format === "numeric" ? q.tolerance : null,
    parentId: q.parentId,
    verified: q.verified,
  };
}

/** Help level while the attempt is still open. Level 3 is only ever set by showing the solution. */
export function helpLevelOf(s: Pick<AttemptSession, "referenceOpened" | "hintsRevealed">): HelpLevel {
  if (s.hintsRevealed > 0) return 2;
  if (s.referenceOpened) return 1;
  return 0;
}

function toReveal(q: Question): Reveal {
  return {
    correctOption: q.correctOption,
    optionReasons: q.optionReasons,
    correctValue: q.correctValue,
    rubric: q.rubric,
    ticksNeeded: q.rubric ? ticksNeeded(q.rubric.length) : null,
    shortAnswer: q.shortAnswer,
    steps: q.steps,
    theory: q.theory,
    intuition: q.intuition,
  };
}

function mustGetSession(db: Db, sessionId: string): { session: AttemptSession; question: Question } {
  const session = typeof sessionId === "string" ? getSession(db, sessionId) : null;
  if (!session) throw new PracticeError("This attempt no longer exists. Load a new question.", 404);
  const question = getQuestion(db, session.questionId);
  if (!question) throw new PracticeError("The question for this attempt is missing.", 404);
  return { session, question };
}

function buildState(db: Db, session: AttemptSession, q: Question): AttemptState {
  const attempt = session.attemptId === null ? null : getAttempt(db, session.attemptId);
  const revealed = session.phase !== "open";
  return {
    attemptId: session.id,
    question: toPublicQuestion(q),
    phase: session.phase,
    startedAt: session.startedAt,
    favorite: isFavorite(db, q.id),
    helpLevel: attempt ? attempt.helpLevel : helpLevelOf(session),
    reference: session.referenceOpened ? q.referenceCard : null,
    hints: q.hints.slice(0, session.hintsRevealed),
    hintsTotal: q.hints.length,
    submitted: session.submitted,
    ticks: session.ticks,
    reveal: revealed ? toReveal(q) : null,
    result: attempt
      ? {
          outcome: attempt.outcome,
          correct: attempt.correct,
          helpLevel: attempt.helpLevel,
          durationMs: attempt.durationMs,
          counted: countsTowardCategory(attempt),
        }
      : null,
    childId: getChildQuestionId(db, q.id),
    chat: listChatMessages(db, session.id),
    ai: aiStatus(),
  };
}

export function getAttemptState(db: Db, sessionId: string): AttemptState {
  const { session, question } = mustGetSession(db, sessionId);
  return buildState(db, session, question);
}

/** Open a specific question (favorites, upgraded questions). Starts the clock. */
export function startAttempt(db: Db, questionId: number, now: number = Date.now()): AttemptState {
  const q = Number.isInteger(questionId) ? getQuestion(db, questionId) : null;
  if (!q) throw new PracticeError("That question does not exist.", 404);
  const id = randomUUID();
  createSession(db, id, q.id, now);
  return getAttemptState(db, id);
}

/** Ask the selector for the next question and open it. Null when no question is eligible. */
export function startNextAttempt(db: Db, rng: Rng = Math.random, now: number = Date.now()): AttemptState | null {
  const pick = selectNext(
    {
      questions: listQuestions(db, { verifiedOnly: true }),
      counters: getCounters(db),
      settings: getSettings(db),
      lastSeen: getLastSeen(db),
    },
    rng,
  );
  if (!pick) return null;
  return startAttempt(db, pick.question.id, now);
}

export type AttemptAction =
  | { type: "reference" }
  | { type: "hint" }
  | { type: "solution"; activeMs?: number }
  | { type: "give_up"; activeMs?: number }
  | { type: "answer"; option?: unknown; value?: unknown; text?: unknown; activeMs?: number }
  | { type: "self_check"; ticks?: unknown };

/**
 * Time spent. The server clock is the upper bound; the browser may report a smaller
 * figure (time the page was actually visible), which is used when it is plausible.
 */
function durationOf(session: AttemptSession, now: number, activeMs: unknown): number {
  const wall = Math.max(0, now - session.startedAt);
  if (typeof activeMs === "number" && Number.isFinite(activeMs) && activeMs >= 0) return Math.round(Math.min(wall, activeMs));
  return wall;
}

function requireOpen(session: AttemptSession) {
  if (session.phase !== "open") throw new PracticeError("This attempt is already finished.", 409);
}

/** Apply one user action to an attempt and return the new state. The only way state changes. */
export function applyAction(db: Db, sessionId: string, action: AttemptAction, now: number = Date.now()): AttemptState {
  const run = db.transaction((): AttemptState => {
    const { session, question: q } = mustGetSession(db, sessionId);
    const finish = (outcome: Outcome, helpLevel: HelpLevel, correct: boolean | null, phase: SessionPhase, activeMs: unknown) => {
      session.attemptId = recordAttempt(db, {
        questionId: q.id,
        outcome,
        helpLevel,
        correct,
        durationMs: durationOf(session, now, activeMs),
        createdAt: now,
      });
      session.phase = phase;
    };

    switch (action.type) {
      case "reference":
        // After the attempt is finished the level is frozen in the attempts row, so this is harmless then.
        session.referenceOpened = true;
        break;
      case "hint":
        if (session.hintsRevealed < q.hints.length) session.hintsRevealed += 1;
        break;
      case "solution":
        requireOpen(session);
        finish("gave_up", 3, null, "done", action.activeMs);
        break;
      case "give_up":
        requireOpen(session);
        finish("gave_up", helpLevelOf(session), null, "done", action.activeMs);
        break;
      case "answer": {
        requireOpen(session);
        const level = helpLevelOf(session);
        if (q.format === "mcq") {
          const option = action.option;
          if (typeof option !== "number" || !Number.isInteger(option) || option < 0 || option >= (q.options?.length ?? 0)) {
            throw new PracticeError("Select one of the options first.", 400);
          }
          session.submitted = { option };
          finish("completed", level, checkMcq(q.correctOption as number, option), "done", action.activeMs);
        } else if (q.format === "numeric") {
          const value =
            typeof action.value === "number"
              ? action.value
              : typeof action.value === "string"
                ? parseNumericInput(action.value, q.unit)
                : null;
          if (value === null || !Number.isFinite(value)) {
            throw new PracticeError("Enter a number, for example 0.25 or 1/4.", 400);
          }
          session.submitted = { value };
          finish(
            "completed",
            level,
            checkNumeric(q.correctValue as number, q.tolerance ?? 0.01, value),
            "done",
            action.activeMs,
          );
        } else {
          const text = typeof action.text === "string" ? action.text.trim() : "";
          if (text === "") throw new PracticeError("Write your answer first, or give up.", 400);
          session.submitted = { text: text.slice(0, 20_000) };
          // Completed as soon as it is submitted; right or wrong is filled in by the self-check.
          finish("completed", level, null, "self_check", action.activeMs);
        }
        break;
      }
      case "self_check": {
        if (session.phase !== "self_check" || session.attemptId === null) {
          throw new PracticeError("There is nothing to self-check on this attempt.", 409);
        }
        const n = q.rubric?.length ?? 0;
        const ticks = action.ticks;
        if (!Array.isArray(ticks) || ticks.length !== n || ticks.some((t) => typeof t !== "boolean")) {
          throw new PracticeError("The self-check list does not match this question.", 400);
        }
        session.ticks = ticks as boolean[];
        setAttemptCorrect(db, session.attemptId, checkSelfTicks(session.ticks));
        session.phase = "done";
        break;
      }
      default:
        throw new PracticeError("Unknown action.", 400);
    }
    saveSession(db, session);
    return buildState(db, session, q);
  });
  return run();
}
