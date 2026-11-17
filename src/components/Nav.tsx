"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Practice", icon: "practice" },
  { href: "/favorites", label: "Favorites", icon: "star" },
  { href: "/stats", label: "Stats", icon: "stats" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Daily Quant Trader, practice">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-ink font-mono text-[11px] font-semibold tracking-tight text-bg">
        dq
      </span>
      <span className="font-serif text-[1.15rem] leading-none italic">Daily Quant Trader</span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark />
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${
                    active(l.href) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
                  }`}
                >
                  <Icon name={l.icon} size={16} />
                  {l.label}
                </Link>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Phone: bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`relative flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[11px] ${
                active(l.href) ? "font-medium text-accent" : "text-ink-3"
              }`}
            >
              {active(l.href) && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
              <Icon name={l.icon} size={20} />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
