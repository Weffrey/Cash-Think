/**
 * Per-question AI chat. Runs on the server: the model is given the question and its
 * stored solution, the browser only gets the replies. Using the chat never changes
 * the help level.
 */
import { complete, type AiDeps, type AiMessage } from "./ai";
import { CATEGORIES } from "./categories";
import { addChatMessage, getQuestion, getSession, listChatMessages, logAiCall, type ChatMessage, type Db } from "./db";
import { PracticeError } from "./practice";
import type { Question } from "./types";

/** Only the most recent messages are sent to the model. */
export const CHAT_HISTORY_LIMIT = 10;
export const CHAT_MAX_TOKENS = 900;
export const CHAT_MAX_MESSAGE_CHARS = 2000;

function describeQuestion(q: Question): string {
  const lines = [
    `Category: ${CATEGORIES.find((c) => c.id === q.categoryId)?.name ?? q.categoryId}`,
    `Difficulty: ${q.difficulty} of 5`,
    `Question: ${q.prompt}`,
  ];
  if (q.format === "mcq" && q.options) {
    lines.push("Options:");
    q.options.forEach((o, i) => lines.push(`${String.fromCharCode(65 + i)}. ${o}`));
    lines.push(`Correct option: ${String.fromCharCode(65 + (q.correctOption ?? 0))}`);
  }
  if (q.format === "numeric") lines.push(`Correct value: ${q.correctValue}${q.unit ? ` (${q.unit})` : ""}`);
  if (q.format === "long" && q.rubric) lines.push(`Key insights expected: ${q.rubric.join(" | ")}`);
  lines.push(`Short answer: ${q.shortAnswer}`, `Solution steps: ${q.steps}`, `Theory: ${q.theory}`, `Intuition: ${q.intuition}`);
  return lines.join("\n");
}

export function buildTutorMessages(q: Question, finished: boolean, history: ChatMessage[]): AiMessage[] {
  const stage = finished
    ? "The student has already answered, given up, or seen the solution. You may discuss the full solution openly."
    : "The student has NOT finished this question yet. Do not state the final answer, the correct option, or the full solution, even if asked directly. Guide with one question or one small step at a time. If they ask for the answer, remind them kindly that the Show solution button is there when they want it.";
  const system = [
    "You are a patient quant trading and finance interview tutor helping one student with one practice question.",
    "Reply in short, digestible pieces: at most about 120 words, plain text, no markdown tables or headings. Write formulas in plain text like x^2 or e^(-rT).",
    "Prefer guiding questions over handing over results. Check the student's reasoning and point to the first step that goes wrong.",
    stage,
    "The stored solution below is for you only. Treat it as correct. If the question itself seems flawed, say so briefly.",
    "",
    describeQuestion(q),
  ].join("\n");
  return [{ role: "system", content: system }, ...history.slice(-CHAT_HISTORY_LIMIT)];
}

/** Send one chat message for an attempt. Stores both sides and logs the AI call. */
export async function sendChatMessage(db: Db, sessionId: string, message: unknown, deps: AiDeps = {}): Promise<ChatMessage[]> {
  const session = typeof sessionId === "string" ? getSession(db, sessionId) : null;
  const q = session ? getQuestion(db, session.questionId) : null;
  if (!session || !q) throw new PracticeError("This attempt no longer exists. Load a new question.", 404);
  const text = typeof message === "string" ? message.trim() : "";
  if (text === "") throw new PracticeError("Type a message first.", 400);
  if (text.length > CHAT_MAX_MESSAGE_CHARS) {
    throw new PracticeError(`Keep messages under ${CHAT_MAX_MESSAGE_CHARS} characters.`, 400);
  }
  const userMessage: ChatMessage = { role: "user", content: text };
  const history = [...listChatMessages(db, sessionId), userMessage];
  const reply = await complete(
    { messages: buildTutorMessages(q, session.phase !== "open", history), maxTokens: CHAT_MAX_TOKENS },
    deps,
  );
  logAiCall(db, {
    purpose: "chat",
    provider: reply.provider,
    model: reply.model,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
  });
  addChatMessage(db, sessionId, userMessage);
  addChatMessage(db, sessionId, { role: "assistant", content: reply.text.trim() });
  return listChatMessages(db, sessionId);
}
