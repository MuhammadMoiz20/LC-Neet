"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { BrandMark } from "@/components/app-shell/brand-mark";

// idle ──► submitting ──► (redirect) | error ──► submitting …
type Phase = { name: "idle" } | { name: "submitting" } | { name: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const submitting = phase.name === "submitting";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setPhase({ name: "submitting" });
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) setPhase({ name: "error", message: "Invalid credentials" });
      else window.location.href = "/"; // stays "submitting" until the page changes
    } catch {
      setPhase({ name: "error", message: "Couldn't reach the server. Try again." });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="glass col"
        style={{ width: "100%", maxWidth: 360, padding: 28, borderRadius: 16, gap: 12 }}
      >
        <BrandMark />
        <h1 style={{ margin: "6px 0 4px", fontSize: 20, fontWeight: 600 }}>Sign in</h1>
        <input
          className="input"
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {phase.name === "error" && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--rose)" }}>
            {phase.message}
          </p>
        )}
        <button
          className="btn btn-primary btn-lg"
          style={{ justifyContent: "center" }}
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
