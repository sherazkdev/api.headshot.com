"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { api, setToken } from "@/lib/api";
import { useTheme } from "@/components/theme-provider";
import { HeadshotMark } from "@/components/logo";
import { clsx } from "@/components/clsx";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid admin email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      const res = await api<{ data: { token: string } }>("/admin/login", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      setToken(res.data.token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="grid min-h-screen bg-page lg:grid-cols-2">
      <div
        className={clsx(
          "relative hidden flex-col justify-between p-12 lg:flex",
          theme === "dark" ? "bg-[#0a0a0a] text-white" : "bg-[#F3F4F6] text-ink",
        )}
      >
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <HeadshotMark className="h-9 w-9" />
          Headshot <span className="text-[#A78BFA]">AI</span>
        </div>
        <div className="relative mx-auto h-72 w-full max-w-md">
          {["left-0 top-8", "left-[28%] top-0", "left-[56%] top-10"].map((pos, i) => (
            <div
              key={pos}
              className={clsx(
                "absolute aspect-[3/4] w-36 overflow-hidden rounded-3xl shadow-card ring-1",
                theme === "dark" ? "bg-[#1f1f1f] ring-white/10" : "bg-white ring-black/5",
                pos,
              )}
            >
              <div className={clsx("h-full w-full", ["bg-gradient-to-br from-slate-400 to-slate-700", "bg-gradient-to-br from-zinc-300 to-zinc-600", "bg-gradient-to-br from-neutral-400 to-neutral-800"][i])} />
            </div>
          ))}
        </div>
        <div className="text-center text-4xl font-semibold tracking-tight">
          Create. Manage. <span className="text-[#A78BFA]">Scale.</span>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24">
        <button
          onClick={toggle}
          className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full border border-line bg-card p-1"
          aria-label="Toggle theme"
        >
          <span className={clsx("rounded-full p-1.5", theme === "light" ? "bg-muted text-ink" : "text-faint")}>
            <Sun size={14} />
          </span>
          <span className={clsx("rounded-full p-1.5", theme === "dark" ? "bg-muted text-ink" : "text-faint")}>
            <Moon size={14} />
          </span>
        </button>
        <form
          onSubmit={onSubmit}
          className={clsx("mx-auto w-full max-w-md", theme === "dark" && "rounded-card border border-line bg-card p-8 shadow-card")}
        >
          <h1 className="text-[32px] font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-subtle">Sign in to manage Headshot AI</p>
          <label className="mt-8 block text-sm font-medium">Email address</label>
          <div className="mt-1.5 flex h-11 items-center gap-2 rounded-input border border-line bg-card px-3">
            <Mail size={16} className="text-faint" />
            <input
              type="email"
              autoComplete="off"
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <label className="mt-4 block text-sm font-medium">Password</label>
          <div className="mt-1.5 flex h-11 items-center gap-2 rounded-input border border-line bg-card px-3">
            <Lock size={16} className="text-faint" />
            <input
              type={show ? "text" : "password"}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-subtle">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <span className="text-accent">Forgot password?</span>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <button
            className={clsx(
              "mt-6 h-11 w-full rounded-btn text-sm font-semibold",
              theme === "dark" ? "bg-[#DBEAFE] text-black hover:bg-sky-100" : "bg-ink text-white hover:opacity-90",
            )}
          >
            Sign in
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" className="h-11 w-full rounded-btn border border-line bg-card text-sm">
            Continue with Google
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-faint">Protected admin access</p>
      </div>
    </div>
  );
}
