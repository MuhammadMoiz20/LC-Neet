"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon, Kbd, toast, type IconName } from "@/components/ui";
import { useTheme } from "@/components/theme-provider";

export type PaletteProblem = {
  slug: string;
  name: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  problems: PaletteProblem[];
  onToggleCoach: () => void;
  onToggleAnalysis: () => void;
};

type Item = {
  id: string;
  group: string;
  icon: IconName;
  label: string;
  hint: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  problems,
  onToggleCoach,
  onToggleAnalysis,
}: CommandPaletteProps) {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const navs: Item[] = [
      { id: "n-d", group: "Navigate", icon: "home", label: "Dashboard", hint: "g d", run: () => router.push("/") },
      { id: "n-p", group: "Navigate", icon: "list", label: "All problems", hint: "g p", run: () => router.push("/problems") },
      { id: "n-i", group: "Navigate", icon: "briefcase", label: "Interview mode", hint: "g i", run: () => router.push("/interview") },
      { id: "n-a", group: "Navigate", icon: "spark", label: "Latest analysis", hint: "", run: () => router.push("/analysis/latest") },
    ];
    const acts: Item[] = [
      { id: "a-th", group: "Actions", icon: "sun", label: "Toggle theme", hint: "", run: toggleTheme },
      { id: "a-co", group: "Actions", icon: "sparkle", label: "Toggle coach panel", hint: "⌘J", run: () => { onToggleCoach(); toast("Toggled coach"); } },
      { id: "a-an", group: "Actions", icon: "beaker", label: "Toggle analysis panel", hint: "⌘I", run: () => { onToggleAnalysis(); toast("Toggled analysis"); } },
      { id: "a-so", group: "Actions", icon: "x", label: "Sign out", hint: "", run: () => { void signOut({ callbackUrl: "/login" }); } },
    ];
    const ai: Item[] = [
      { id: "ai-1", group: "Ask the coach", icon: "sparkle", label: "Explain my last submission", hint: "↵", run: () => { router.push("/problem/3sum"); toast("Coach: Explaining last submission…", { kind: "success" }); } },
      { id: "ai-2", group: "Ask the coach", icon: "sparkle", label: "Give me a hint", hint: "↵", run: () => { router.push("/problem/3sum"); toast("Coach: Hint queued", { kind: "success" }); } },
      { id: "ai-3", group: "Ask the coach", icon: "sparkle", label: "Quiz me on Sliding Window", hint: "↵", run: () => { router.push("/problem/3sum"); toast("Coach: Sliding-window quiz queued", { kind: "success" }); } },
      { id: "ai-4", group: "Ask the coach", icon: "target", label: "What should I do next?", hint: "↵", run: () => { router.push("/"); toast('Pulled "Do next" recommendation', { kind: "success" }); } },
      { id: "ai-5", group: "Ask the coach", icon: "sparkle", label: "Review my code", hint: "↵", run: () => { router.push("/problem/3sum"); toast("Coach: Code review queued", { kind: "success" }); } },
    ];
    const probs: Item[] = problems.map((p) => ({
      id: `p-${p.slug}`,
      group: "Problems",
      icon: "list",
      label: p.name,
      hint: p.difficulty,
      run: () => router.push(`/problem/${p.slug}`),
    }));
    const all = [...navs, ...acts, ...ai, ...probs];
    if (!q) return all.slice(0, 16);
    const t = q.toLowerCase();
    return all
      .filter((it) => it.label.toLowerCase().includes(t) || it.group.toLowerCase().includes(t))
      .slice(0, 30);
  }, [q, problems, router, toggleTheme, onToggleCoach, onToggleAnalysis]);

  const grouped = useMemo<[string, Item[]][]>(() => {
    const g = new Map<string, Item[]>();
    items.forEach((it) => {
      const list = g.get(it.group) ?? [];
      list.push(it);
      g.set(it.group, list);
    });
    return Array.from(g.entries());
  }, [items]);

  // Clamp selection to current item count (derived; avoids setState-in-effect).
  const clampedSel = items.length === 0 ? 0 : Math.min(sel, items.length - 1);

  const flatIds = items.map((i) => i.id);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[clampedSel];
      if (it) {
        it.run();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open) return null;
  return (
    <div
      className="anim-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,.32)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
      }}
      onMouseDown={onClose}
    >
      <div
        className="glass anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          boxShadow: "var(--shadow-pop)",
          background: "var(--surface-glass-strong)",
        }}
      >
        <div
          className="row"
          style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", gap: 10 }}
        >
          <Icon name="search" size={16} className="muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
            placeholder="Type a command, search problems…"
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              fontSize: 15,
              color: "var(--text)",
              fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
            }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div style={{ overflow: "auto", padding: "6px 6px 8px" }}>
          {grouped.length === 0 && (
            <div className="muted" style={{ padding: "24px 14px", fontSize: 13, textAlign: "center" }}>
              No matches.
            </div>
          )}
          {grouped.map(([group, list]) => (
            <div key={group}>
              <div
                style={{
                  padding: "8px 12px 4px",
                  fontSize: 10.5,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  fontWeight: 600,
                }}
              >
                {group}
              </div>
              {list.map((it) => {
                const idx = flatIds.indexOf(it.id);
                const active = idx === clampedSel;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => {
                      it.run();
                      onClose();
                    }}
                    className="row"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: active ? "var(--accent-soft)" : "transparent",
                      border: "none",
                      color: "var(--text)",
                      cursor: "default",
                      gap: 10,
                      marginBottom: 1,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "var(--bg-2)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: active ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      <Icon name={it.icon} size={14} />
                    </span>
                    <span style={{ flex: 1, fontSize: 13.5 }}>{it.label}</span>
                    {it.hint && (
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        {it.hint}
                      </span>
                    )}
                    {active && <Icon name="arrow-r" size={13} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div
          className="row"
          style={{
            height: 34,
            padding: "0 12px",
            borderTop: "1px solid var(--border)",
            fontSize: 11.5,
            color: "var(--text-muted)",
            gap: 12,
          }}
        >
          <span className="row" style={{ gap: 6 }}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="row" style={{ gap: 6 }}>
            <Kbd>↵</Kbd> open
          </span>
          <div style={{ flex: 1 }} />
          <span className="row" style={{ gap: 6 }}>
            powered by coach
            <span style={{ color: "var(--accent)", display: "inline-flex" }}>
              <Icon name="sparkle" size={11} />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
