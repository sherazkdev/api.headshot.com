"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, BookOpen, Home, LogOut, Menu, Search, Settings, Sun, Moon, X } from "lucide-react";
import { getToken, setToken } from "@/lib/api";
import { crumbs, isActive, NAV } from "@/lib/nav";
import { useTheme } from "./theme-provider";
import { HeadshotMark } from "./logo";
import { clsx } from "./clsx";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true);
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (!ready) return <div className="p-10 text-sm text-subtle">Loading…</div>;

  return (
    <div className="min-h-screen bg-page text-ink">
      {open ? <button className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-line bg-sidebar",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-header items-center gap-2.5 px-4">
          <HeadshotMark className="h-8 w-8 shrink-0" />
          <div>
            <div className="text-sm font-semibold leading-tight">Headshot AI</div>
            <div className="text-[11px] text-[#A78BFA]">Admin</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="scrollable min-h-0 flex-1 space-y-5 px-3 pb-6">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.group}</div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isActive(path, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                        active ? "bg-[var(--nav-active)] font-medium text-ink" : "text-subtle hover:bg-muted",
                      )}
                    >
                      {active ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--nav-indicator)]" /> : null}
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">AU</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">Admin User</div>
              <div className="truncate text-[11px] text-faint">admin@headshotapi.com</div>
            </div>
          </div>
          <Link href="/remote-config" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-subtle hover:bg-muted">
            <Settings size={16} /> Settings
          </Link>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-subtle hover:bg-muted"
            onClick={() => {
              setToken("");
              router.replace("/login");
            }}
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-20 flex h-header items-center gap-3 border-b border-line bg-header px-4 lg:px-6">
          <button className="rounded-btn p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </button>
          <div className="hidden items-center gap-1.5 text-sm text-subtle md:flex">
            <Home size={14} />
            <span>/</span>
            <span>{crumbs(path).join(" / ")}</span>
          </div>
          <div className="mx-auto hidden w-full max-w-md md:block">
            <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-muted px-3 text-sm text-faint">
              <Search size={14} />
              <input className="w-full bg-transparent outline-none placeholder:text-faint" placeholder="Search..." />
              <kbd className="rounded border border-line px-1.5 text-[10px]">⌘K</kbd>
            </label>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <a
              href="http://127.0.0.1:3000/docs"
              target="_blank"
              rel="noreferrer"
              className="rounded-btn p-2 hover:bg-muted"
              aria-label="API docs"
              title="Swagger API docs"
            >
              <BookOpen size={18} />
            </a>
            <button className="rounded-btn p-2 hover:bg-muted" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="relative rounded-btn p-2 hover:bg-muted" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">AU</div>
          </div>
        </header>
        <main className="scrollable mx-auto max-w-[1400px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
