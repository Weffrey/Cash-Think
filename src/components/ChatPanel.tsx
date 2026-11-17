"use client";

import { useEffect, useRef, useState } from "react";
import type { AiStatus } from "@/lib/ai";
import { api, ApiError } from "@/lib/client";
import type { ChatMessage } from "@/lib/db";
import { Icon } from "./Icon";
import { RichText } from "./RichText";

const STARTERS = ["Clarify what the question is asking", "Which concept is this testing?", "Check my approach so far"];

export function AiOffNotice({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/60 p-4 text-sm leading-relaxed text-ink-2">
      <p className="font-medium text-ink">{what} is switched off</p>
      <p className="mt-1">
        It needs a free Groq API key. Add <code className="rounded bg-surface px-1 font-mono text-[0.85em]">GROQ_API_KEY=...</code> to{" "}
        <code className="rounded bg-surface px-1 font-mono text-[0.85em]">.env.local</code> and restart the app to enable it.
      </p>
      <p className="mt-1 text-ink-3">Everything else works without it: questions, hints, reference cards, and solutions are all stored.</p>
    </div>
  );
}

/**
 * Per-question tutor chat. The server holds the conversation and gives the model the
 * question and its stored solution; this panel only sends messages and shows replies.
 */
export function ChatPanel({
  attemptId,
  ai,
  initial,
  onMessages,
  onClose,
}: {
  attemptId: string;
  ai: AiStatus;
  initial: ChatMessage[];
  /** keeps the conversation with the parent so it survives closing the panel */
  onMessages: (messages: ChatMessage[]) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (message === "" || pending) return;
    setError(null);
    setPending(true);
    setDraft("");
    const before = messages;
    setMessages([...before, { role: "user", content: message }]);
    try {
      const res = await api<{ chat: ChatMessage[] }>(`/api/attempts/${attemptId}/chat`, { method: "POST", body: { message } });
      setMessages(res.chat);
      onMessages(res.chat);
    } catch (e) {
      setMessages(before);
      setDraft(message);
      setError(e instanceof ApiError ? e.message : "The message could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Tutor chat">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="chat" size={16} className="text-accent" />
            Tutor chat
          </h2>
          <p className="mt-0.5 truncate text-xs text-ink-3">Knows this question. Never changes your help level.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close chat">
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="scroll-slim min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {!ai.enabled ? (
          <AiOffNotice what="AI chat" />
        ) : messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-2">
              Ask anything about this question. The tutor guides with small steps and will not hand over the answer before you finish.
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink-2 hover:border-line-strong hover:text-ink"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-relaxed ${
                m.role === "user" ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md border border-line bg-surface-2"
              }`}
            >
              <RichText text={m.content} />
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start" aria-label="The tutor is typing">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-surface-2 px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-ink-2"
                  style={{ animation: `pulse-dot 1.2s ${i * 0.18}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          className="field max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5"
          rows={1}
          value={draft}
          disabled={!ai.enabled}
          placeholder={ai.enabled ? "Ask the tutor…" : "Chat needs GROQ_API_KEY"}
          aria-label="Message to the tutor"
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon shrink-0"
          disabled={!ai.enabled || pending || draft.trim() === ""}
          aria-label="Send"
        >
          <Icon name="send" size={17} />
        </button>
      </form>
    </section>
  );
}
