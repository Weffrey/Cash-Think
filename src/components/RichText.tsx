import { Fragment, type ReactNode } from "react";

/**
 * Renders stored plain text so formulas stay readable without a math library:
 *   x^2, e^(-rT)      superscripts
 *   S_T, payoff_up    subscripts
 *   sqrt(N), <=, >=   math symbols
 *   0.5 x 20          multiplication sign (only between two operands)
 *   `code`            monospace, left untouched
 * Lines that start with "1. " become numbered steps.
 */

const INLINE = /\^(\([^()]*\)|[-+]?[A-Za-z0-9]+(?:\.[0-9]+)?)|(?<=[A-Za-z])_([A-Za-z0-9]+)/g;

function symbols(text: string): string {
  return text
    .replace(/sqrt\(/g, "√(")
    .replace(/<=/g, "≤")
    .replace(/>=/g, "≥")
    .replace(/(?<=[A-Za-z0-9)%$]) x (?=[A-Za-z0-9(.$-])/g, " × ")
    .replace(/(?<=\d) - (?=\d)/g, " − ");
}

function formatMath(raw: string, keyPrefix: string): ReactNode[] {
  const text = symbols(raw);
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (m[1] !== undefined) {
      const inner = m[1].startsWith("(") ? m[1].slice(1, -1) : m[1];
      out.push(<sup key={`${keyPrefix}s${n++}`}>{inner.replace(/-/g, "−")}</sup>);
    } else {
      out.push(<sub key={`${keyPrefix}s${n++}`}>{m[2]}</sub>);
    }
    last = index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function formatLine(line: string, key: string): ReactNode[] {
  // odd segments are inside backticks
  return line.split("`").map((seg, i) =>
    i % 2 === 1 ? <code key={`${key}c${i}`}>{seg}</code> : <Fragment key={`${key}t${i}`}>{formatMath(seg, `${key}t${i}`)}</Fragment>,
  );
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={`rich ${className}`}>
      {lines.map((line, i) => {
        const key = `l${i}`;
        if (line.trim() === "") return <div key={key} className="h-3" />;
        const step = line.match(/^(\d+)\.\s+(.*)$/);
        if (step) {
          return (
            <div key={key} className="flex gap-3 py-[0.2em]">
              <span className="w-5 shrink-0 pt-[0.25em] text-right font-mono text-[0.72em] text-ink-3">{step[1]}</span>
              <span className="min-w-0 flex-1">{formatLine(step[2], key)}</span>
            </div>
          );
        }
        const codeOnly = /^`[^`]*`$/.test(line.trim());
        return (
          <div key={key} className={codeOnly ? "codeline" : i > 0 ? "mt-[0.35em]" : ""}>
            {formatLine(line, key)}
          </div>
        );
      })}
    </div>
  );
}
