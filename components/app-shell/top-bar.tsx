"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, IconButton, Kbd } from "@/components/ui";
import { useTheme } from "@/components/theme-provider";

const TITLE_MAP: Record<string, string> = {
  "": "Dashboard",
  dashboard: "Dashboard",
  problems: "Problems",
  problem: "Workspace",
  analysis: "Analysis",
  interview: "Interview",
  stats: "Stats",
};

export type TopBarProps = {
  onOpenPalette: () => void;
  onOpenCheatsheet: () => void;
  avatarInitials?: string;
};

export function TopBar({ onOpenPalette, onOpenCheatsheet, avatarInitials = "?" }: TopBarProps) {
  const pathname = usePathname() ?? "/";
  const segs = pathname.split("/").filter(Boolean);
  const route = segs[0] ?? "dashboard";
  const title = TITLE_MAP[route] ?? "Dashboard";
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="row nosel"
      style={{
        height: 52,
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-glass)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        position: "sticky",
        top: 0,
        zIndex: 30,
        gap: 12,
      }}
    >
      <div className="row" style={{ gap: 10 }}>
        <Link
          href="/"
          className="row"
          style={{ gap: 8, textDecoration: "none", color: "var(--text)" }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "linear-gradient(135deg, var(--accent), var(--accent-active))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 1px 0 rgba(255,255,255,.3) inset, 0 2px 8px rgba(20,184,166,.35)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 7l5 5-5 5M13 17h6" />
            </svg>
          </span>
          <span
            className="mono"
            style={{ fontWeight: 600, letterSpacing: "-.01em", fontSize: 13 }}
          >
            lc-neet
          </span>
        </Link>
        <div
          className="row mono"
          style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginLeft: 4 }}
        >
          <span style={{ color: "var(--text-faint)" }}>/</span>
          <Link
            className="lnk"
            href={route === "dashboard" || route === "" ? "/" : `/${route}`}
          >
            {title}
          </Link>
          {segs.length > 1 && segs[0] === "problem" && (
            <>
              <span style={{ color: "var(--text-faint)" }}>/</span>
              <span style={{ color: "var(--text)" }}>{segs[1]}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onOpenPalette}
        className="row glass"
        type="button"
        style={{
          gap: 8,
          padding: "0 10px",
          height: 32,
          borderRadius: 8,
          background: "var(--surface)",
          cursor: "text",
          minWidth: 280,
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        <Icon name="search" size={14} />
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: 12.5,
            flex: 1,
            textAlign: "left",
          }}
        >
          Search problems, run actions…
        </span>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </button>

      <div style={{ width: 1, height: 22, background: "var(--border)" }} />
      <IconButton
        icon={theme === "dark" ? "sun" : "moon"}
        title="Toggle theme"
        onClick={toggleTheme}
      />
      <IconButton icon="dots" title="Shortcuts (?)" onClick={onOpenCheatsheet} />
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 600,
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), 'Geist Mono', monospace",
          border: "1px solid var(--border)",
        }}
      >
        {avatarInitials}
      </div>
    </div>
  );
}
