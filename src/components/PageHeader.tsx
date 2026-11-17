import type { ReactNode } from "react";

export function PageHeader({ title, lead, aside }: { title: string; lead: string; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-[2rem] leading-tight sm:text-[2.4rem]">{title}</h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">{lead}</p>
      </div>
      {aside}
    </div>
  );
}

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-ink-2">{message}</p>
      <button type="button" className="btn mt-4" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
