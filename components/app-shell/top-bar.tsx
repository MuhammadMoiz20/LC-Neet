"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, IconButton, Kbd } from "@/components/ui";
import { useTheme } from "@/components/theme-provider";
import { BrandMark } from "./brand-mark";

// Primary navigation. `sections` are the first URL segments that count as
// being "in" that destination (a problem's workspace belongs to Problems).
const NAV: { href: string; label: string; sections: string[] }[] = [
  { href: "/", label: "Dashboard", sections: [""] },
  { href: "/problems", label: "Problems", sections: ["problems", "problem"] },
  { href: "/board", label: "Board", sections: ["board"] },
  { href: "/interview", label: "Interview", sections: ["interview"] },
];

export type TopBarProps = {
  onOpenPalette: () => void;
  onOpenCheatsheet: () => void;
  avatarInitials?: string;
};

export function TopBar({ onOpenPalette, onOpenCheatsheet, avatarInitials = "?" }: TopBarProps) {
  const pathname = usePathname() ?? "/";
  const section = pathname.split("/").filter(Boolean)[0] ?? "";
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
      <Link href="/" aria-label="lc-neet home" style={{ textDecoration: "none" }}>
        <BrandMark />
      </Link>
      <nav aria-label="Primary" className="row" style={{ gap: 2, marginLeft: 6 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-lnk"
            aria-current={item.sections.includes(section) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

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
          minWidth: 0,
          flex: "0 1 280px",
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
            minWidth: 0,
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
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
